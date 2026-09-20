// ============ Cloud Sync (مزامنة البيانات على Firebase) ============
// Keeps every clinic's data (الحجوزات / الأطباء / التخصصات / الإعدادات / السجل)
// in Firebase so it can be opened from any device.
//
// Storage layout (per clinic, fully isolated):
//   clinics/{clinicId}/appData/{key}   ->  { json, updatedAt, updatedBy }
//
// How it works:
//  1. localStorage stays the app's working copy — no other file needs changes.
//  2. Every write to a synced key is mirrored to Firebase (debounced).
//  3. A live listener pulls changes made on other devices into localStorage
//     and refreshes the page once so the new data appears.
//  4. On the first connection, local records are merged UP to the cloud so
//     reservations already saved on this device are not lost.

import { auth, db } from "./firebase-config.js?v=1";
import {
  doc, setDoc, onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const SHORT_KEYS = [
  "clinic_bookings_v1",   // الحجوزات
  "clinic_doctors_v1",    // الأطباء
  "clinic_majors_v1",     // التخصصات
  "clinic_admin_v1",      // إعدادات المواعيد
  "clinic_audit_v1",      // سجل العمليات
  "clinic_specialty_v1",  // تخصص العيادة (وحدات التخصصات)
];

const ARRAY_KEYS = ["clinic_bookings_v1", "clinic_doctors_v1", "clinic_majors_v1", "clinic_audit_v1"];

const CLINIC_ID = window.CLINIC_ID || "__anon__";
const full = (name) => (window.clinicKey ? window.clinicKey(name) : "bmd::" + CLINIC_ID + "::" + name);

const rawSetItem = localStorage.setItem.bind(localStorage);
const pending = {};      // shortKey -> timer
const applying = {};     // shortKey -> true while writing a remote value locally
const unsubs = [];
let started = false;

function docRef(shortKey) {
  return doc(db, "clinics", CLINIC_ID, "appData", shortKey);
}

function localValue(shortKey) {
  return localStorage.getItem(full(shortKey));
}

async function push(shortKey) {
  const json = localValue(shortKey);
  if (json == null) return;
  try {
    await setDoc(docRef(shortKey), {
      json,
      updatedAt: new Date().toISOString(),
      updatedBy: (auth.currentUser && auth.currentUser.email) || "",
    });
  } catch (e) {
    console.warn("Cloud sync: could not upload", shortKey, e && e.message);
  }
}

function schedulePush(shortKey) {
  clearTimeout(pending[shortKey]);
  pending[shortKey] = setTimeout(() => push(shortKey), 400);
}

// ---- mirror local writes to the cloud -------------------------------------
localStorage.setItem = function (key, value) {
  rawSetItem(key, value);
  if (!started) return;
  const short = SHORT_KEYS.find((k) => key === full(k));
  if (short && !applying[short]) schedulePush(short);
};

// ---- merge helpers --------------------------------------------------------
function parse(json, fallback) {
  try { const v = JSON.parse(json); return v == null ? fallback : v; } catch { return fallback; }
}

// Union by id (bookings / doctors / audit) or by value (majors).
function mergeArrays(localArr, remoteArr) {
  const out = [];
  const seen = new Map();
  const keyOf = (x) => (x && typeof x === "object" ? String(x.id ?? JSON.stringify(x)) : String(x));
  [...remoteArr, ...localArr].forEach((item) => {
    const k = keyOf(item);
    if (seen.has(k)) {
      const i = seen.get(k);
      if (item && typeof item === "object") out[i] = { ...out[i], ...item };
    } else {
      seen.set(k, out.length);
      out.push(item);
    }
  });
  return out;
}

function applyRemote(shortKey, remoteJson) {
  const localJson = localValue(shortKey);
  if (remoteJson === localJson) return false;

  let finalJson = remoteJson;

  if (ARRAY_KEYS.includes(shortKey)) {
    const localArr = parse(localJson, []);
    const remoteArr = parse(remoteJson, []);
    if (Array.isArray(localArr) && Array.isArray(remoteArr) && localArr.length) {
      const merged = mergeArrays(localArr, remoteArr);
      finalJson = JSON.stringify(merged);
    }
  }

  applying[shortKey] = true;
  rawSetItem(full(shortKey), finalJson);
  applying[shortKey] = false;

  // if the merge produced something the cloud doesn't have yet, upload it
  if (finalJson !== remoteJson) push(shortKey);

  return finalJson !== localJson;
}

function refreshOnce() {
  // the page already rendered from the old local copy — reload so the
  // freshly synced data (from the other device) shows up
  if (window.__cloudSyncReloading) return;
  window.__cloudSyncReloading = true;
  setTimeout(() => location.reload(), 150);
}

// ---- start / stop ---------------------------------------------------------
function start() {
  if (started) return;
  started = true;

  SHORT_KEYS.forEach((shortKey) => {
    const un = onSnapshot(
      docRef(shortKey),
      (snap) => {
        if (!snap.exists()) {
          // nothing in the cloud yet: seed it from this device
          if (localValue(shortKey) != null) push(shortKey);
          return;
        }
        const remoteJson = snap.data() && snap.data().json;
        if (typeof remoteJson !== "string") return;
        const changed = applyRemote(shortKey, remoteJson);
        if (changed) refreshOnce();
      },
      (err) => {
        console.warn("Cloud sync stopped for", shortKey, err && err.message);
        try { un(); } catch {}
      }
    );
    unsubs.push(un);
  });

  // make sure whatever is on this device reaches the cloud at least once
  SHORT_KEYS.forEach((k) => { if (localValue(k) != null) schedulePush(k); });
}

function stop() {
  started = false;
  unsubs.splice(0).forEach((un) => { try { un(); } catch {} });
}

onAuthStateChanged(auth, (user) => {
  if (user) start();
  else stop();
});

window.CloudSync = {
  pushAll: () => SHORT_KEYS.forEach(push),
  keys: SHORT_KEYS,
};
