// ============ Electronic Prescription (الروشتة الإلكترونية) ============
// Stored in Firebase Firestore:  clinics/{clinicId}/prescriptions/{id}
// A local mirror (localStorage) keeps the list visible offline and is merged
// with Firestore on read. Nothing in the existing app is modified.
//
// Exposes window.RX (used by patients.js):
//   RX.open(visit, patient)        -> open the create form for a visit
//   RX.listFor(visitId)            -> Promise<array of prescriptions>
//   RX.view(prescription)          -> open a read-only preview
//   RX.pdf(prescription)           -> print / save as PDF (formatted, RTL)
//   RX.onChange(fn)                -> called after a prescription is saved

import { auth, db } from "./firebase-config.js?v=1";
import {
  collection,
  doc,
  getDocs,
  setDoc,
  query,
  where,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const LOCAL_KEY = (window.clinicKey || ((n) => n))("clinic_prescriptions_v1");
const CLINIC_ID = window.CLINIC_ID || "__anon__";
const listeners = [];

/* ---------- helpers ---------- */
const esc = (s) =>
  (s == null ? "" : String(s)).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));

function localAll() {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]"); }
  catch { return []; }
}
function localSave(list) {
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(list)); } catch {}
}
function localPut(rx) {
  const list = localAll().filter((x) => x.id !== rx.id);
  list.push(rx);
  localSave(list);
}

function clinicName() {
  try {
    const k = (window.clinicKey || ((n) => n))("clinic_admin_v1");
    const s = JSON.parse(localStorage.getItem(k) || "{}");
    if (s && s.clinicName) return s.clinicName;
  } catch {}
  return "ClinicManagement";
}

function nextNumber() {
  const y = new Date().getFullYear();
  const n = localAll().filter((x) => (x.number || "").includes("RX-" + y)).length + 1;
  return `RX-${y}-${String(n).padStart(4, "0")}`;
}

function toast(msg) {
  if (typeof window.toast === "function") { window.toast(msg); return; }
  alert(msg);
}

/* ---------- data ---------- */
async function save(rx) {
  localPut(rx);            // always keep a local copy
  try {
    if (!auth.currentUser) throw new Error("not-signed-in");
    await setDoc(doc(db, "clinics", CLINIC_ID, "prescriptions", rx.id), rx);
    rx.synced = true;
  } catch (e) {
    rx.synced = false;
    console.warn("Prescription saved locally only:", e && e.message);
  }
  localPut(rx);
  listeners.forEach((fn) => { try { fn(rx); } catch {} });
  return rx;
}

async function listFor(visitId) {
  const map = new Map();
  localAll().filter((x) => x.visitId === visitId).forEach((x) => map.set(x.id, x));
  try {
    if (auth.currentUser) {
      const q = query(
        collection(db, "clinics", CLINIC_ID, "prescriptions"),
        where("visitId", "==", visitId)
      );
      const snap = await getDocs(q);
      snap.forEach((d) => map.set(d.id, d.data()));
    }
  } catch (e) {
    console.warn("Prescriptions read from local cache:", e && e.message);
  }
  return Array.from(map.values()).sort((a, b) =>
    String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
  );
}

/* ---------- modal shell ---------- */
function modal(title, bodyHtml, footerHtml) {
  document.querySelectorAll(".rx-overlay").forEach((n) => n.remove());
  const ov = document.createElement("div");
  ov.className = "rx-overlay";
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
  document.addEventListener("keydown", function onEsc(e) {
    if (e.key === "Escape") { close(); document.removeEventListener("keydown", onEsc); }
  });
  return { el: ov, close };
}

/* ---------- create form ---------- */
function medRow(i, m) {
  m = m || {};
  return `
  <div class="rx-med" data-i="${i}">
    <div class="rx-med-head">
      <strong>دواء ${i + 1}</strong>
      <div class="rx-med-tools">
        <button type="button" class="btn ghost small rx-up" title="لأعلى">▲</button>
        <button type="button" class="btn ghost small rx-down" title="لأسفل">▼</button>
        <button type="button" class="btn ghost small rx-del" title="حذف">🗑</button>
      </div>
    </div>
    <div class="grid-2">
      <div class="field"><label>اسم الدواء *</label><input class="rx-name" value="${esc(m.name)}" placeholder="مثال: Augmentin" /></div>
      <div class="field"><label>التركيز</label><input class="rx-strength" value="${esc(m.strength)}" placeholder="مثال: 1g" /></div>
      <div class="field"><label>الشكل الدوائي</label><input class="rx-form" value="${esc(m.form)}" placeholder="أقراص / شراب / أمبول" /></div>
      <div class="field"><label>الجرعة</label><input class="rx-dose" value="${esc(m.dose)}" placeholder="قرص واحد" /></div>
      <div class="field"><label>التكرار</label><input class="rx-freq" value="${esc(m.frequency)}" placeholder="كل 12 ساعة" /></div>
      <div class="field"><label>المدة</label><input class="rx-dur" value="${esc(m.duration)}" placeholder="7 أيام" /></div>
    </div>
    <div class="field"><label>تعليمات الاستخدام</label><input class="rx-inst" value="${esc(m.instructions)}" placeholder="بعد الأكل" /></div>
  </div>`;
}

/* ---------- specialty exam section (progressive disclosure) ---------- */
function examSectionHtml() {
  const SP = window.ClinicSpecialty;
  if (!SP) return "";
  const sp = SP.current();
  return `
    <details class="rx-exam" style="margin-top:14px;">
      <summary style="cursor:pointer;font-weight:700;">${sp.icon} بيانات الفحص — ${esc(sp.label)} (اختياري)</summary>
      <div style="margin-top:10px;">${SP.formHtml({})}</div>
    </details>`;
}

function examHtml(exam) {
  const SP = window.ClinicSpecialty;
  if (!SP || !exam) return "";
  const rows = SP.summaryRows(exam);
  const extra = SP.detailHtml(exam);
  if (!rows.length && !extra) return "";
  const table = rows.length ? `
    <div class="table-wrap"><table><tbody>
      ${rows.map(([l, v]) => `<tr><td style="width:170px;font-weight:700;">${esc(l)}</td><td>${esc(v)}</td></tr>`).join("")}
    </tbody></table></div>` : "";
  return `
    <h3 style="margin-top:14px;">بيانات الفحص — ${esc(exam.label || "")}</h3>
    ${table}${extra}`;
}

function open(visit, patient) {
  visit = visit || {};
  patient = patient || {};
  const number = nextNumber();
  const today = new Date().toISOString().slice(0, 10);

  const body = `
    <div class="grid-2 rx-meta">
      <div><strong>رقم الروشتة:</strong> <span id="rxNumber">${esc(number)}</span></div>
      <div><strong>تاريخ الإصدار:</strong> <span>${esc(today)}</span></div>
      <div><strong>اسم المريض:</strong> <span>${esc(patient.fullName || visit.fullName || "-")}</span></div>
      <div><strong>الطبيب:</strong> <span>${esc(visit.doctor || "-")}</span></div>
      <div><strong>تاريخ الزيارة:</strong> <span>${esc(visit.appointmentDate || "-")}</span></div>
      <div><strong>التشخيص:</strong> <span>${esc(visit.condition || "-")}</span></div>
    </div>
    ${examSectionHtml()}
    <h3 style="margin-top:14px;">الأدوية</h3>
    <div id="rxMeds">${medRow(0, {})}</div>
    <div class="actions" style="margin-top:10px;">
      <button type="button" class="btn ghost" id="rxAddMed">+ إضافة دواء</button>
    </div>
    <div class="field" style="margin-top:12px;">
      <label>ملاحظات / تعليمات عامة</label>
      <textarea id="rxNotes" rows="3" placeholder="راحة، شرب سوائل، متابعة بعد أسبوع..."></textarea>
    </div>`;

  const foot = `
    <button type="button" class="btn primary" id="rxSave">💾 حفظ الروشتة</button>
    <button type="button" class="btn ghost rx-close">إلغاء</button>`;

  const m = modal("💊 إنشاء روشتة إلكترونية", body, foot);
  if (window.ClinicSpecialty) window.ClinicSpecialty.wire(m.el);
  const medsBox = m.el.querySelector("#rxMeds");

  function renumber() {
    medsBox.querySelectorAll(".rx-med").forEach((row, i) => {
      row.dataset.i = i;
      row.querySelector(".rx-med-head strong").textContent = "دواء " + (i + 1);
    });
  }
  m.el.querySelector("#rxAddMed").addEventListener("click", () => {
    medsBox.insertAdjacentHTML("beforeend", medRow(medsBox.children.length, {}));
    renumber();
  });
  medsBox.addEventListener("click", (e) => {
    const row = e.target.closest(".rx-med");
    if (!row) return;
    if (e.target.classList.contains("rx-del")) {
      if (medsBox.children.length === 1) { toast("لا يمكن حفظ روشتة بدون دواء واحد على الأقل"); return; }
      row.remove(); renumber();
    } else if (e.target.classList.contains("rx-up") && row.previousElementSibling) {
      medsBox.insertBefore(row, row.previousElementSibling); renumber();
    } else if (e.target.classList.contains("rx-down") && row.nextElementSibling) {
      medsBox.insertBefore(row.nextElementSibling, row); renumber();
    }
  });

  m.el.querySelectorAll(".rx-close").forEach((b) => b.addEventListener("click", m.close));

  m.el.querySelector("#rxSave").addEventListener("click", async () => {
    const meds = [];
    medsBox.querySelectorAll(".rx-med").forEach((row) => {
      const g = (c) => (row.querySelector(c).value || "").trim();
      const name = g(".rx-name");
      if (!name) return;
      meds.push({
        name,
        strength: g(".rx-strength"),
        form: g(".rx-form"),
        dose: g(".rx-dose"),
        frequency: g(".rx-freq"),
        duration: g(".rx-dur"),
        instructions: g(".rx-inst"),
      });
    });
    if (!meds.length) { toast("أضف دواءً واحداً على الأقل مع اسمه"); return; }

    const rx = {
      id: "rx_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      number,
      clinicId: CLINIC_ID,
      clinicName: clinicName(),
      visitId: visit.id || "",
      patientName: patient.fullName || visit.fullName || "",
      patientPhone: patient.phone || visit.phone || "",
      doctor: visit.doctor || "",
      visitDate: visit.appointmentDate || "",
      issueDate: today,
      diagnosis: visit.condition || "",
      notes: (m.el.querySelector("#rxNotes").value || "").trim(),
      medications: meds,
      exam: (window.ClinicSpecialty && window.ClinicSpecialty.collect(m.el)) || null,
      createdBy: (auth.currentUser && auth.currentUser.email) || "",
      createdAt: new Date().toISOString(),
    };
    const btn = m.el.querySelector("#rxSave");
    btn.disabled = true;
    btn.textContent = "جارٍ الحفظ...";
    await save(rx);
    m.close();
    toast(rx.synced === false ? "تم حفظ الروشتة محلياً (تعذر الاتصال بالسحابة)" : "تم حفظ الروشتة");
  });
}

/* ---------- view ---------- */
function medsTable(rx) {
  return `
  <div class="table-wrap">
    <table>
      <thead><tr><th>#</th><th>الدواء</th><th>التركيز</th><th>الشكل</th><th>الجرعة</th><th>التكرار</th><th>المدة</th><th>التعليمات</th></tr></thead>
      <tbody>
        ${(rx.medications || []).map((m, i) => `
          <tr>
            <td>${i + 1}</td><td>${esc(m.name)}</td><td>${esc(m.strength)}</td><td>${esc(m.form)}</td>
            <td>${esc(m.dose)}</td><td>${esc(m.frequency)}</td><td>${esc(m.duration)}</td><td>${esc(m.instructions)}</td>
          </tr>`).join("")}
      </tbody>
    </table>
  </div>`;
}

function view(rx) {
  const body = `
    <div class="grid-2 rx-meta">
      <div><strong>رقم الروشتة:</strong> ${esc(rx.number)}</div>
      <div><strong>تاريخ الإصدار:</strong> ${esc(rx.issueDate)}</div>
      <div><strong>المريض:</strong> ${esc(rx.patientName)}</div>
      <div><strong>الطبيب:</strong> ${esc(rx.doctor)}</div>
      <div><strong>تاريخ الزيارة:</strong> ${esc(rx.visitDate)}</div>
      <div><strong>التشخيص:</strong> ${esc(rx.diagnosis || "-")}</div>
    </div>
    ${examHtml(rx.exam)}
    ${medsTable(rx)}
    ${rx.notes ? `<p style="margin-top:10px;"><strong>تعليمات عامة:</strong> ${esc(rx.notes)}</p>` : ""}`;
  const m = modal("💊 الروشتة " + esc(rx.number), body,
    `<button type="button" class="btn primary" id="rxPdf">📄 تحميل الروشتة PDF</button>
     <button type="button" class="btn ghost rx-close">إغلاق</button>`);
  m.el.querySelectorAll(".rx-close").forEach((b) => b.addEventListener("click", m.close));
  m.el.querySelector("#rxPdf").addEventListener("click", () => pdf(rx));
}

/* ---------- PDF (real text, RTL, print-ready — not a screenshot) ---------- */
function examPdfBlock(rx) {
  const SP = window.ClinicSpecialty;
  if (!SP || !rx.exam) return "";
  const rows = SP.summaryRows(rx.exam);
  const extra = SP.detailHtml(rx.exam);
  if (!rows.length && !extra) return "";
  const table = rows.length ? `
  <table class="meta">
    ${rows.map(([l, v]) => `<tr><td class="k">${esc(l)}</td><td>${esc(v)}</td></tr>`).join("")}
  </table>` : "";
  return `
  <h1>بيانات الفحص — ${esc(rx.exam.label || "")}</h1>
  ${table}${extra}`;
}

function pdf(rx) {
  const fileName =
    "Prescription_" +
    String(rx.patientName || "Patient").trim().replace(/\s+/g, "-") +
    "_" + (rx.number || "RX");

  const rows = (rx.medications || []).map((m, i) => `
    <tr>
      <td>${i + 1}</td>
      <td><b>${esc(m.name)}</b>${m.strength ? " — " + esc(m.strength) : ""}${m.form ? " (" + esc(m.form) + ")" : ""}</td>
      <td>${esc(m.dose)}</td><td>${esc(m.frequency)}</td><td>${esc(m.duration)}</td><td>${esc(m.instructions)}</td>
    </tr>`).join("");

  const html = `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8" />
<title>${esc(fileName)}</title>
<link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&display=swap" rel="stylesheet">
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Tajawal', 'Segoe UI', Tahoma, sans-serif; direction: rtl; color: #14213d; margin: 0; }
  .head { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid #0d6efd; padding-bottom:10px; }
  .clinic { font-size: 22px; font-weight: 700; }
  .doc { font-size: 13px; color:#555; }
  h1 { font-size: 18px; margin: 16px 0 10px; }
  .meta { width:100%; border-collapse:collapse; margin-bottom:14px; font-size:13px; }
  .meta td { padding:5px 6px; border:1px solid #dbe2ef; }
  .meta td.k { background:#f4f7fb; font-weight:700; width:110px; }
  table.meds { width:100%; border-collapse:collapse; font-size:12.5px; }
  table.meds th, table.meds td { border:1px solid #cfd8e6; padding:6px 7px; text-align:right; vertical-align:top; }
  table.meds th { background:#0d6efd; color:#fff; }
  .notes { margin-top:14px; font-size:13px; border:1px dashed #cfd8e6; padding:10px; border-radius:6px; }
  .sign { margin-top:34px; display:flex; justify-content:space-between; font-size:13px; }
  .sign div { border-top:1px solid #14213d; padding-top:6px; width:220px; text-align:center; }
  .foot { margin-top:18px; font-size:11px; color:#888; text-align:center; }
  h3.sp-detail-title { font-size:14px; margin:12px 0 6px; }
  .table-wrap table { width:100%; border-collapse:collapse; font-size:12.5px; margin-bottom:10px; }
  .table-wrap th, .table-wrap td { border:1px solid #cfd8e6; padding:5px 6px; text-align:right; }
  .table-wrap th { background:#eef3fb; }
  ul.sp-files-view { font-size:12.5px; padding-inline-start:18px; }
</style></head><body>
  <div class="head">
    <div>
      <div class="clinic">${esc(rx.clinicName || "ClinicManagement")}</div>
      <div class="doc">روشتة إلكترونية / Electronic Prescription</div>
    </div>
    <div class="doc">رقم: ${esc(rx.number)}<br />التاريخ: ${esc(rx.issueDate)}</div>
  </div>

  <h1>بيانات المريض والزيارة</h1>
  <table class="meta">
    <tr><td class="k">اسم المريض</td><td>${esc(rx.patientName)}</td><td class="k">رقم الجوال</td><td>${esc(rx.patientPhone || "-")}</td></tr>
    <tr><td class="k">الطبيب</td><td>${esc(rx.doctor || "-")}</td><td class="k">تاريخ الزيارة</td><td>${esc(rx.visitDate || "-")}</td></tr>
    <tr><td class="k">التشخيص</td><td colspan="3">${esc(rx.diagnosis || "-")}</td></tr>
  </table>

  ${examPdfBlock(rx)}

  <h1>الأدوية</h1>
  <table class="meds">
    <thead><tr><th>#</th><th>الدواء</th><th>الجرعة</th><th>التكرار</th><th>المدة</th><th>التعليمات</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>

  ${rx.notes ? `<div class="notes"><b>تعليمات عامة:</b> ${esc(rx.notes)}</div>` : ""}

  <div class="sign">
    <div>توقيع الطبيب: ${esc(rx.doctor || "")}</div>
    <div>ختم العيادة</div>
  </div>
  <div class="foot">${esc(fileName)}</div>
  <script>window.onload = function(){ setTimeout(function(){ window.focus(); window.print(); }, 400); };<\/script>
</body></html>`;

  const w = window.open("", "_blank");
  if (!w) { toast("اسمح بالنوافذ المنبثقة لتحميل الـPDF"); return; }
  w.document.open();
  w.document.write(html);
  w.document.close();
}

window.RX = {
  open,
  view,
  pdf,
  listFor,
  onChange: (fn) => listeners.push(fn),
};
document.dispatchEvent(new Event("rx-ready"));
