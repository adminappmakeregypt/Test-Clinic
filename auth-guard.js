// ============ Auth Guard ============
// v7: 10 clinics × (1 admin + 2 users). admin = all pages; user = booking page only.

import { auth, db } from "./firebase-config.js?v=7";
import {
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// 🔑 Legacy UID map (kept for older test accounts).
const USER_MAP = {
  "FW6oQ1lxyVfFxpgBz9EJqGngzG02": { clinicId: "clinic1", role: "admin" },
  "bCkZhbwZV5gsxOOpF1WY8TnIY3a2": { clinicId: "clinic2", role: "admin" },
  "eJRdKk25eTS2WZHkLtJYgvSmoP13": { clinicId: "clinic2", role: "admin" },
  "oZM7Cet099gtqkwQenkkSMQOaux2": { clinicId: "clinic1", role: "admin" },
};

// 📧 Email map — primary source of truth. Each clinic has 1 admin + 2 users.
const EMAIL_MAP = {
  // legacy test accounts
  "admin1@test.com": { clinicId: "clinic1", role: "admin" },
  "admin2@test.com": { clinicId: "clinic2", role: "admin" },
  "user1@test.com":  { clinicId: "clinic1", role: "user"  },
  "user2@test.com":  { clinicId: "clinic2", role: "user"  },

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

// Pages a regular "user" is allowed to see. Everything else → redirect to index.html
const USER_ALLOWED_PAGES = ["index.html", ""];

function currentPageName() {
  const p = window.location.pathname.split("/").pop() || "";
  return p.toLowerCase();
}

function enforceRoleAccess(role) {
  const page = currentPageName();
  if (role === "user" && !USER_ALLOWED_PAGES.includes(page)) {
    window.location.replace("index.html");
    return false;
  }
  if (role === "user") {
    document.querySelectorAll('a[href$="home.html"], a[href$="admin.html"], a[href$="reports.html"]')
      .forEach(a => { a.style.display = "none"; });
  }
  return true;
}

window.currentUserProfile = null;
window.authReady = new Promise((resolve) => {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.replace("login.html");
      return;
    }

    let clinicId = null;
    let role = "staff";

    const mappedByUid = USER_MAP[user.uid];
    const mappedByEmail = user.email ? EMAIL_MAP[user.email.toLowerCase()] : null;

    if (mappedByUid) {
      clinicId = mappedByUid.clinicId;
      role = mappedByUid.role;
    } else if (mappedByEmail) {
      clinicId = mappedByEmail.clinicId;
      role = mappedByEmail.role;
    } else {
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists()) {
          const data = snap.data();
          clinicId = data.clinicId || null;
          role = data.role || "staff";
        }
      } catch (e) {
        console.error("Failed to load user profile:", e);
      }
    }

    if (!clinicId) {
      console.error("No clinicId for user", user.uid, user.email);
      alert("لم يتم العثور على بيانات العيادة لهذا المستخدم.\nUID: " + user.uid + "\nEmail: " + (user.email || ""));
      await signOut(auth);
      window.location.replace("login.html");
      return;
    }

    window.currentUserProfile = {
      uid: user.uid,
      email: user.email,
      clinicId,
      role,
    };

    if (!enforceRoleAccess(role)) return;

    const userInfo = document.getElementById("userInfo");
    if (userInfo) {
      userInfo.textContent = (user.email || user.uid) + (role === "user" ? "  (مستخدم)" : "  (مدير)");
    }

    const btn = document.getElementById("logoutBtn");
    if (btn && !btn.dataset.logoutReady) {
      btn.dataset.logoutReady = "true";
      btn.addEventListener("click", async (ev) => {
        ev.preventDefault();
        await signOut(auth);
        window.location.replace("login.html");
      });
    }

    document.dispatchEvent(
      new CustomEvent("auth:ready", { detail: window.currentUserProfile })
    );
    resolve(window.currentUserProfile);
  });
});
