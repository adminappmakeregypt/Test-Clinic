// ============ ClinicManagement Auth (Firebase Authentication) ============
// Accounts must exist in Firebase Auth for the project bookmydoctor-6c93c.
// - Sign in uses Firebase email/password.
// - "نسيت كلمة المرور؟" sends a REAL password-reset email via Firebase; the
//   user clicks the link in their inbox and Firebase shows a hosted page to
//   set a new password. Nothing to store on our side.
// - Clinic/role mapping stays here (EMAIL_MAP) so each clinic's data stays
//   isolated in its own localStorage namespace (window.clinicKey).

import { auth } from "./firebase-config.js";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  sendPasswordResetEmail,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// 📧 email -> { clinicId, role }
// role: 'admin' = full access; 'user' = booking + reports only.
const EMAIL_MAP = {
  // Clinic 1
  "clinic1admin@appmakeregypt.com": { clinicId: "clinic1", role: "admin" },
  "clinic1usera@appmakeregypt.com": { clinicId: "clinic1", role: "user"  },
  "clinic1userb@appmakeregypt.com": { clinicId: "clinic1", role: "user"  },
  // Clinic 2
  "clinic2admin@appmakeregypt.com": { clinicId: "clinic2", role: "admin" },
  "clinic2usera@appmakeregypt.com": { clinicId: "clinic2", role: "user"  },
  "clinic2userb@appmakeregypt.com": { clinicId: "clinic2", role: "user"  },
  // Clinic 3
  "clinic3admin@appmakeregypt.com": { clinicId: "clinic3", role: "admin" },
  "clinic3usera@appmakeregypt.com": { clinicId: "clinic3", role: "user"  },
  "clinic3userb@appmakeregypt.com": { clinicId: "clinic3", role: "user"  },
  // Clinic 4
  "clinic4admin@appmakeregypt.com": { clinicId: "clinic4", role: "admin" },
  "clinic4usera@appmakeregypt.com": { clinicId: "clinic4", role: "user"  },
  "clinic4userb@appmakeregypt.com": { clinicId: "clinic4", role: "user"  },
  // Clinic 5
  "clinic5admin@appmakeregypt.com": { clinicId: "clinic5", role: "admin" },
  "clinic5usera@appmakeregypt.com": { clinicId: "clinic5", role: "user"  },
  "clinic5userb@appmakeregypt.com": { clinicId: "clinic5", role: "user"  },
  // Clinic 6
  "clinic6admin@appmakeregypt.com": { clinicId: "clinic6", role: "admin" },
  "clinic6usera@appmakeregypt.com": { clinicId: "clinic6", role: "user"  },
  "clinic6userb@appmakeregypt.com": { clinicId: "clinic6", role: "user"  },
  // Clinic 7
  "clinic7admin@appmakeregypt.com": { clinicId: "clinic7", role: "admin" },
  "clinic7usera@appmakeregypt.com": { clinicId: "clinic7", role: "user"  },
  "clinic7userb@appmakeregypt.com": { clinicId: "clinic7", role: "user"  },
  // Clinic 8
  "clinic8admin@appmakeregypt.com": { clinicId: "clinic8", role: "admin" },
  "clinic8usera@appmakeregypt.com": { clinicId: "clinic8", role: "user"  },
  "clinic8userb@appmakeregypt.com": { clinicId: "clinic8", role: "user"  },
  // Clinic 9
  "clinic9admin@appmakeregypt.com": { clinicId: "clinic9", role: "admin" },
  "clinic9usera@appmakeregypt.com": { clinicId: "clinic9", role: "user"  },
  "clinic9userb@appmakeregypt.com": { clinicId: "clinic9", role: "user"  },
  // Clinic 10
  "clinic10admin@appmakeregypt.com": { clinicId: "clinic10", role: "admin" },
  "clinic10usera@appmakeregypt.com": { clinicId: "clinic10", role: "user"  },
  "clinic10userb@appmakeregypt.com": { clinicId: "clinic10", role: "user"  },
  // Clinic 11
  "appmakeregypt@gmail.com":   { clinicId: "clinic11", role: "admin" },
  "mostafa.hegab83@gmail.com": { clinicId: "clinic11", role: "user"  },
  "mostafa.hegab@hotmail.com": { clinicId: "clinic11", role: "user"  },
  // Clinic 12
  "karimaismail1998@gmail.com": { clinicId: "clinic12", role: "admin" },
  "afiaclinic1@gmail.com":      { clinicId: "clinic12", role: "user"  },
  "afiaclinic2@gmail.com":      { clinicId: "clinic12", role: "user"  },
  // Clinic 13
  "ahmadarfa55555@gmail.com": { clinicId: "clinic13", role: "admin" },
  // Clinic 14
  "dr.markraouf2@gmail.com": { clinicId: "clinic14", role: "admin" },
  // Clinic 15
  "dr_yasoo83@yahoo.com": { clinicId: "clinic15", role: "admin" },
  // Clinic 16
  "magid.m@gmail.com": { clinicId: "clinic16", role: "admin" },
  // Clinic 17
  "dr.samy@ymail.com": { clinicId: "clinic17", role: "admin" },
    // Clinic 18
  "mohamed028483@gmail.com": { clinicId: "clinic18", role: "admin" },
  // Clinic 19
  "ibrahimarafa95@yahoo.com": { clinicId: "clinic19", role: "admin" },
};

const LOGIN_PAGE = "login.html";
const HOME_PAGE  = "home.html";

const path = (location.pathname.split("/").pop() || "").toLowerCase();
const isLoginPage = path === LOGIN_PAGE;

// Resolve the clinic namespace SYNCHRONOUSLY at boot so page scripts that
// read localStorage at load time always hit their own clinic's bucket.
// A small inline bootstrap in the HTML creates window.clinicKey before this
// module finishes loading Firebase; keep the same logic here as a fallback.
const LAST_CLINIC_KEY = window.__BMD_LAST_CLINIC_KEY || "bmd::lastClinicId";
if (!window.clinicKey) {
  window.CLINIC_ID = localStorage.getItem(LAST_CLINIC_KEY) || "__anon__";
  window.clinicKey = (name) => "bmd::" + window.CLINIC_ID + "::" + name;
}

// Hide non-login pages until Firebase confirms who is signed in.
if (!isLoginPage) {
  const s = document.createElement("style");
  s.id = "bmd-boot-hide";
  s.textContent = "body{visibility:hidden}";
  document.head.appendChild(s);
}

function friendlyAuthError(err) {
  const code = err && err.code ? err.code : "";
  switch (code) {
    case "auth/invalid-email":         return "البريد الإلكتروني غير صالح";
    case "auth/user-disabled":         return "تم تعطيل هذا الحساب";
    case "auth/user-not-found":        return "هذا البريد غير مسجل";
    case "auth/wrong-password":
    case "auth/invalid-credential":    return "كلمة المرور غير صحيحة";
    case "auth/too-many-requests":     return "محاولات كثيرة، حاول لاحقاً";
    case "auth/network-request-failed":return "لا يوجد اتصال بالإنترنت";
    case "auth/missing-email":         return "أدخل البريد الإلكتروني";
    default: return (err && err.message) || "حدث خطأ";
  }
}

async function signIn(email, password) {
  email = (email || "").trim().toLowerCase();
  try {
    await signInWithEmailAndPassword(auth, email, password);
    return true;
  } catch (err) {
    throw new Error(friendlyAuthError(err));
  }
}

async function signOut() {
  window.CLINIC_ID = "__anon__";
  try { localStorage.removeItem(LAST_CLINIC_KEY); } catch {}
  try { await fbSignOut(auth); } catch {}
  location.href = LOGIN_PAGE;
}

async function resetPassword(email) {
  email = (email || "").trim().toLowerCase();
  if (!email) throw new Error("أدخل البريد الإلكتروني أولاً");
  try {
    await sendPasswordResetEmail(auth, email);
    return true;
  } catch (err) {
    throw new Error(friendlyAuthError(err));
  }
}

// Expose a simple API for the pages that already use window.BMDAuth
window.BMDAuth = {
  signIn,
  signOut,
  resetPassword,
  getSession: () => window.currentUserProfile || null,
  isAdmin: () => !!(window.currentUserProfile && window.currentUserProfile.role === "admin"),
};

window.currentUserProfile = null;

// ---- Firebase auth state → page guard + header bar ----
onAuthStateChanged(auth, (user) => {
  // 1) Not signed in
  if (!user) {
    if (!isLoginPage) location.replace(LOGIN_PAGE);
    else {
      const b = document.getElementById("bmd-boot-hide");
      if (b) b.remove();
    }
    return;
  }

  // 2) Signed in — resolve clinic + role
  const email = (user.email || "").toLowerCase();
  const mapped = EMAIL_MAP[email];
  if (!mapped) {
    alert("لم يتم العثور على بيانات العيادة لهذا المستخدم:\n" + email);
    fbSignOut(auth).finally(() => location.replace(LOGIN_PAGE));
    return;
  }

  // If the clinic bucket used at boot differs from the one this account
  // belongs to (e.g. a different user just signed in on the same browser),
  // persist the new clinicId and reload so all page scripts re-read
  // localStorage against the correct namespace instead of the previous
  // clinic's data.
  const bootClinicId = window.CLINIC_ID;
  let stored = null;
  try {
    localStorage.setItem(LAST_CLINIC_KEY, mapped.clinicId);
    stored = localStorage.getItem(LAST_CLINIC_KEY);
  } catch {}
  // Reload at most ONCE per page load, and only if the new clinicId actually
  // persisted. Without these guards a browser that blocks localStorage (private
  // mode / blocked cookies) would reload forever and the page would flicker.
  const RELOAD_FLAG = "bmd::reloadedForClinic";
  let alreadyReloaded = false;
  try { alreadyReloaded = sessionStorage.getItem(RELOAD_FLAG) === mapped.clinicId; } catch { alreadyReloaded = true; }
  if (
    bootClinicId !== mapped.clinicId &&
    !isLoginPage &&
    stored === mapped.clinicId &&
    !alreadyReloaded
  ) {
    try { sessionStorage.setItem(RELOAD_FLAG, mapped.clinicId); } catch {}
    location.reload();
    return;
  }
  try { sessionStorage.setItem(RELOAD_FLAG, mapped.clinicId); } catch {}
  window.CLINIC_ID = mapped.clinicId;
  window.currentUserProfile = {
    email,
    role: mapped.role,
    name: email.split("@")[0],
    clinicId: mapped.clinicId,
  };

  // On the login page: bounce to home once signed in
  if (isLoginPage) { location.replace(HOME_PAGE); return; }

  // Role guard for admin-only pages
  const adminOnlyPages = ["admin.html", "reports.html", "patients.html"];
  if (adminOnlyPages.includes(path) && mapped.role !== "admin") {
    alert("هذه الصفحة متاحة لمدير العيادة فقط");
    location.replace(HOME_PAGE);
    return;
  }

  // Reveal page + add header bar
  const reveal = () => {
    const b = document.getElementById("bmd-boot-hide");
    if (b) b.remove();
    injectHeaderBar();
    document.dispatchEvent(new CustomEvent("auth:ready", { detail: window.currentUserProfile }));
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", reveal, { once: true });
  } else {
    reveal();
  }
});

function injectHeaderBar() {
  const session = window.currentUserProfile;
  if (!session) return;
  const header = document.querySelector(".page-header") || document.body;
  const bar = document.createElement("div");
  bar.style.cssText =
    "display:flex;gap:8px;align-items:center;justify-content:center;padding:8px;font-size:14px;color:#555;flex-wrap:wrap;";
  const safeName = (session.name || session.email).replace(/[&<>"']/g, "");
  const roleLabel = session.role === "admin" ? "مدير" : "مستخدم";
  bar.innerHTML =
    "<span>👤 <strong>" + safeName + "</strong> — " + roleLabel +
    " — 🏥 " + session.clinicId + "</span>" +
    '<button type="button" class="btn small ghost" id="bmdChangePwBtn">🔑 إعادة تعيين كلمة المرور</button>' +
    '<button type="button" class="btn small ghost" id="bmdSignOutBtn">🚪 تسجيل الخروج</button>';
  header.parentNode.insertBefore(bar, header.nextSibling);

  const outBtn = document.getElementById("bmdSignOutBtn");
  if (outBtn) outBtn.addEventListener("click", () => window.BMDAuth.signOut());

  const pwBtn = document.getElementById("bmdChangePwBtn");
  if (pwBtn) pwBtn.addEventListener("click", async () => {
    if (!confirm("سنرسل رابط إعادة تعيين كلمة المرور إلى بريدك:\n" + session.email + "\nهل تريد المتابعة؟")) return;
    try {
      await window.BMDAuth.resetPassword(session.email);
      alert("تم إرسال رابط إعادة التعيين إلى بريدك الإلكتروني. افتح البريد واضغط الرابط لتعيين كلمة مرور جديدة.");
    } catch (err) { alert(err.message || "فشل الإرسال"); }
  });

  if (session.role !== "admin") {
    document.querySelectorAll(
      'a[href="admin.html"], a[href="reports.html"], a[href="patients.html"]'
    ).forEach(el => { el.style.display = "none"; });
  }
}
