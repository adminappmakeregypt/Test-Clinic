// ============ Patient Files (admin only) ============
(function () {
  const STORAGE_KEY = clinicKey('clinic_bookings_v1');
  const $ = (s) => document.querySelector(s);

  function loadBookings() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
    catch { return []; }
  }

  function normalizePhone(p) { return (p || '').toString().replace(/\D/g, ''); }

  function groupByPatient(list) {
    const map = new Map();
    list.forEach(b => {
      const key = (normalizePhone(b.phone) || '') + '|' + ((b.fullName || '').trim().toLowerCase());
      if (!map.has(key)) {
        map.set(key, {
          key,
          fullName: b.fullName || '-',
          phone: b.phone || '',
          idNumber: b.idNumber || '',
          birthDate: b.birthDate || '',
          gender: b.gender || '',
          email: b.email || '',
          visits: [],
        });
      }
      const p = map.get(key);
      p.visits.push(b);
      // fill missing profile fields from any record that has them
      ['idNumber','birthDate','gender','email'].forEach(f => { if (!p[f] && b[f]) p[f] = b[f]; });
    });
    // sort visits desc by date+time
    map.forEach(p => {
      p.visits.sort((a, b) => {
        const da = (a.appointmentDate || '') + ' ' + (a.appointmentTime || '');
        const db = (b.appointmentDate || '') + ' ' + (b.appointmentTime || '');
        return db.localeCompare(da);
      });
    });
    return Array.from(map.values());
  }

  function filterVisits(list) {
    const name = ($('#searchName').value || '').trim().toLowerCase();
    const phone = normalizePhone($('#searchPhone').value);
    const from = $('#searchDateFrom').value;
    const to = $('#searchDateTo').value;
    return list.filter(b => {
      if (name && !((b.fullName || '').toLowerCase().includes(name))) return false;
      if (phone && !normalizePhone(b.phone).includes(phone)) return false;
      const d = b.appointmentDate || '';
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    });
  }

  function escapeHtml(s) {
    return (s == null ? '' : String(s)).replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
  }

  function renderPatients(patients) {
    const tbody = $('#patientsTable tbody');
    tbody.innerHTML = '';
    patients.forEach(p => {
      const last = p.visits[0] ? (p.visits[0].appointmentDate || '') : '';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escapeHtml(p.fullName)}</td>
        <td>${escapeHtml(p.phone)}</td>
        <td>${escapeHtml(p.idNumber)}</td>
        <td>${escapeHtml(p.birthDate)}</td>
        <td>${escapeHtml(p.gender)}</td>
        <td>${p.visits.length}</td>
        <td>${escapeHtml(last)}</td>
        <td>
          <button class="btn primary small" data-key="${escapeHtml(p.key)}">📂 عرض السجل</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
    $('#emptyPatients').style.display = patients.length ? 'none' : '';
    $('#patientsTable').style.display = patients.length ? '' : 'none';

    tbody.querySelectorAll('button[data-key]').forEach(btn => {
      btn.addEventListener('click', () => showDetail(btn.getAttribute('data-key'), patients));
    });
  }

  function showDetail(key, patients) {
    const p = patients.find(x => x.key === key);
    if (!p) return;
    $('#pdName').textContent = p.fullName;
    $('#pdPhone').textContent = p.phone || '-';
    $('#pdId').textContent = p.idNumber || '-';
    $('#pdBirth').textContent = p.birthDate || '-';
    $('#pdGender').textContent = p.gender || '-';
    $('#pdEmail').textContent = p.email || '-';
    $('#pdCount').textContent = p.visits.length;

    const tbody = $('#visitsTable tbody');
    tbody.innerHTML = '';
    p.visits.forEach(v => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escapeHtml(v.appointmentDate)}</td>
        <td>${escapeHtml(v.appointmentTime)}</td>
        <td>${escapeHtml(v.doctor)}</td>
        <td>${escapeHtml(v.specialty)}</td>
        <td>${escapeHtml(v.condition)}</td>
        <td>${escapeHtml(v.paymentMethod)}</td>
        <td>${escapeHtml(v.amount)}</td>
        <td>${escapeHtml(v.status)}</td>
        <td>${escapeHtml(v.notes)}</td>
      `;
      tbody.appendChild(tr);
    });

    $('#patientDetailCard').style.display = '';
    $('#patientDetailCard').scrollIntoView({ behavior: 'smooth' });
  }

  function runSearch() {
    const all = loadBookings();
    const filtered = filterVisits(all);
    const patients = groupByPatient(filtered);
    renderPatients(patients);
    $('#patientDetailCard').style.display = 'none';
  }

  document.addEventListener('DOMContentLoaded', () => {
    $('#searchBtn').addEventListener('click', runSearch);
    $('#clearBtn').addEventListener('click', () => {
      $('#searchName').value = '';
      $('#searchPhone').value = '';
      $('#searchDateFrom').value = '';
      $('#searchDateTo').value = '';
      runSearch();
    });
    $('#closeDetailBtn').addEventListener('click', () => {
      $('#patientDetailCard').style.display = 'none';
    });
    ['#searchName','#searchPhone','#searchDateFrom','#searchDateTo'].forEach(sel => {
      $(sel).addEventListener('keydown', (e) => { if (e.key === 'Enter') runSearch(); });
    });

    runSearch();
  });
})();
