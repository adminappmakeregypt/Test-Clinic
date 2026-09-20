// ============ Firebase shared config ============
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCWsKLiMjUREhEpMZarud5j2K6rLDQqsSo",
  authDomain: "bookmydoctor-6c93c.firebaseapp.com",
  projectId: "bookmydoctor-6c93c",
  storageBucket: "bookmydoctor-6c93c.firebasestorage.app",
  messagingSenderId: "88063096613",
  appId: "1:88063096613:web:293c77b09078d943964ccc",
  measurementId: "G-VJ2PE37JSJ"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
// Firestore — used by auth-guard.js and by the electronic prescription feature.
export const db = getFirestore(app);
