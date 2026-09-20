// ============ Shared file uploads (Firebase Storage) ============
// Uses the EXISTING Firebase project/app — no new storage architecture.
// Path: clinics/{clinicId}/attachments/{folder}/{timestamp}_{filename}
//
// window.ClinicFiles.upload(file, folder) -> { name, url, path, size, type }

import { app, auth } from "./firebase-config.js?v=1";
import {
  getStorage, ref, uploadBytes, getDownloadURL,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

const storage = getStorage(app);
const CLINIC_ID = window.CLINIC_ID || "__anon__";

function safeName(n) {
  return String(n || "file").replace(/[^\w.\-\u0600-\u06FF]+/g, "_").slice(-80);
}

async function upload(file, folder) {
  if (!auth.currentUser) throw new Error("not-signed-in");
  const path = `clinics/${CLINIC_ID}/attachments/${folder || "general"}/${Date.now()}_${safeName(file.name)}`;
  const r = ref(storage, path);
  await uploadBytes(r, file, { contentType: file.type || "application/octet-stream" });
  const url = await getDownloadURL(r);
  return { name: file.name, url, path, size: file.size, type: file.type || "" };
}

window.ClinicFiles = { upload };
