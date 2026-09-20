// ============ Dental model (ملف الأسنان للمريض) ============
// Opened from ملفات المرضى next to إجراء. Shows the full dental examination:
//   A) dental exam fields   B) odontogram   C) treatment plan   D) attachments
// Stored in the EXISTING Firebase project (no new architecture):
//   Firestore: clinics/{clinicId}/dentalCharts/{patientId}
//   Files    : handled by attachments.js (Firebase Storage)
// A localStorage mirror keeps it visible offline.
//
// window.DentalChart.open(patient)

import { auth, db } from "./firebase-config.js?v=1";
import {
  doc, getDoc, setDoc,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const CLINIC_ID = window.CLINIC_ID || "__anon__";
const LOCAL_KEY = (window.clinicKey || ((n) => n))("clinic_dental_charts_v1");

const esc = (s) =>
  (s == null ? "" : String(s)).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));

function docId(patient) {
  const raw = (patient && (patient.key || patient.phone || patient.fullName)) || "unknown";
  return String(raw).replace(/[^\w\u0600-\u06FF]+/g, "_").slice(0, 120) || "unknown";
}

function localAll() {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || "{}"); } catch { return {}; }
}
function localPut(id, data) {
  const all = localAll();
  all[id] = data;
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(all)); } catch {}
}

async function load(id) {
  const cached = localAll()[id] || null;
  try {
    if (auth.currentUser) {
      const snap = await getDoc(doc(db, "clinics", CLINIC_ID, "dentalCharts", id));
      if (snap.exists()) {
        const data = snap.data();
        localPut(id, data);
        return data;
      }
    }
  } catch (e) {
    console.warn("Dental chart read from local cache:", e && e.message);
  }
  return cached;
}

async function save(id, data) {
  localPut(id, data);
  if (!auth.currentUser) throw new Error("not-signed-in");
  await setDoc(doc(db, "clinics", CLINIC_ID, "dentalCharts", id), data);
}

/* ---------- modal (same look as the prescription modal) ---------- */
function modal(title, bodyHtml, footerHtml) {
  document.querySelectorAll(".rx-overlay.dc-overlay").forEach((n) => n.remove());
  const ov = document.createElement("div");
  ov.className = "rx-overlay dc-overlay";
  ov.innerHTML = `
    <div class="rx-modal" role="dialog" aria-modal="true">
      <div class="rx-modal-head">
        <h2>${title}</h2>
        <button type="button" class="btn ghost small rx-close">✖</button>
      </div>
      <div class="rx-modal-body">${bodyHtml}</div>
      <div class="rx-modal-foot">${footerHtml || ""}</div>
    </div>`;
  document.body.appendChild(ov);
  const close = () => ov.remove();
  ov.querySelector(".rx-close").addEventListener("click", close);
  ov.addEventListener("click", (e) => { if (e.target === ov) close(); });
  return { el: ov, close };
}

/* ---------- open ---------- */
async function open(patient) {
  const SP = window.ClinicSpecialty;
  if (!SP) { alert("جارٍ تحميل وحدة الأسنان، حاول بعد لحظة."); return; }

  const id = docId(patient);
  const saved = await load(id);
  const exam = (saved && saved.exam) || {};

  const head =
    `<div class="dc-head">
       <div><strong>المريض:</strong> ${esc(patient.fullName || "-")}</div>
       <div><strong>الجوال:</strong> ${esc(patient.phone || "-")}</div>
       <div><strong>آخر تحديث:</strong> ${esc(saved && saved.updatedAt ? String(saved.updatedAt).slice(0, 16).replace("T", " ") : "—")}</div>
     </div>`;

  const m = modal(
    "🦷 ملف الأسنان — Dental model",
    head + `<div class="dc-form">${SP.formHtml(exam, "dental")}</div>`,
    `<span class="dc-status muted"></span>
     <button type="button" class="btn ghost small dc-cancel">إغلاق</button>
     <button type="button" class="btn primary small dc-save">💾 حفظ</button>`
  );

  SP.wire(m.el, "dental");
  m.el.querySelector(".dc-cancel").addEventListener("click", m.close);

  const status = m.el.querySelector(".dc-status");
  m.el.querySelector(".dc-save").addEventListener("click", async () => {
    const collected = SP.collect(m.el, "dental") || { specialty: "dental", label: "أسنان", fields: {}, sections: {} };
    const data = {
      id,
      patientKey: patient.key || "",
      patientName: patient.fullName || "",
      phone: patient.phone || "",
      exam: collected,
      updatedAt: new Date().toISOString(),
      updatedBy: (auth.currentUser && auth.currentUser.email) || "",
    };
    status.textContent = "جارٍ الحفظ...";
    try {
      await save(id, data);
      status.textContent = "تم الحفظ ✔";
      if (typeof window.toast === "function") window.toast("تم حفظ ملف الأسنان");
      setTimeout(m.close, 600);
    } catch (e) {
      console.warn(e);
      status.textContent = "تم الحفظ محلياً فقط (تعذر الاتصال).";
    }
  });
}

window.DentalChart = { open, load, docId };
document.dispatchEvent(new Event("dental-chart-ready"));
