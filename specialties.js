// ============ Specialty Module Layer (طبقة التخصصات) ============
// A lightweight configuration layer on top of the existing app.
// - The clinic's specialty is stored in localStorage under the SAME
//   per-clinic namespace used everywhere else: clinicKey('clinic_specialty_v1')
//   and is mirrored to Firebase by cloud-sync.js (same appData pattern).
// - No existing collection, document or field is changed.
// - Exam data captured by a module is saved INSIDE the prescription document
//   as an extra `exam` object (Firestore is schema-less, old documents stay valid).
//
// window.ClinicSpecialty API:
//   list()                     -> [{id,label,icon}]
//   currentId() / current()    -> active specialty
//   set(id)                    -> save active specialty
//   formHtml(values)           -> HTML for the exam fields of the active specialty
//   collect(rootEl)            -> { specialty, label, fields: {key: value} }
//   summaryRows(exam)          -> [[label, value], ...] for view / PDF

(function () {
  var KEY = (window.clinicKey || function (n) { return n; })('clinic_specialty_v1');

  var SPECIALTIES = [
    {
      id: 'general', label: 'طب عام', icon: '🩺',
      fields: [
        { k: 'bp',       l: 'ضغط الدم',           ph: '120/80' },
        { k: 'pulse',    l: 'النبض (ن/د)',        ph: '78' },
        { k: 'temp',     l: 'الحرارة (°م)',       ph: '37' },
        { k: 'weight',   l: 'الوزن (كجم)',        ph: '70' },
        { k: 'height',   l: 'الطول (سم)',         ph: '170' },
        { k: 'complaint',l: 'الشكوى الرئيسية',    ph: 'صداع منذ 3 أيام', wide: true },
        { k: 'exam',     l: 'الفحص الإكلينيكي',   ph: 'القلب والصدر طبيعي...', area: true }
      ]
    },
    {
      id: 'dental', label: 'أسنان', icon: '🦷',
      fields: [
        { k: 'tooth',    l: 'رقم السن / الأسنان',  ph: '16, 26' },
        { k: 'quadrant', l: 'الربع',               opts: ['', 'علوي أيمن', 'علوي أيسر', 'سفلي أيمن', 'سفلي أيسر'] },
        { k: 'finding',  l: 'الحالة',              opts: ['', 'تسوس', 'التهاب لثة', 'خراج', 'كسر', 'فقد سن', 'حشو قديم'] },
        { k: 'procedure',l: 'الإجراء',             opts: ['', 'حشو', 'علاج عصب', 'خلع', 'تنظيف', 'تركيبة', 'تقويم'] },
        { k: 'anesthesia', l: 'التخدير',           ph: 'موضعي' },
        { k: 'notes',    l: 'ملاحظات الفحص',       ph: 'ألم عند الطرق...', area: true }
      ]
    },
    {
      id: 'ophthalmology', label: 'رمد وعيون', icon: '👁️',
      fields: [
        { k: 'vaRight',  l: 'حدة الإبصار - يمين', ph: '6/6' },
        { k: 'vaLeft',   l: 'حدة الإبصار - يسار', ph: '6/9' },
        { k: 'sphR',     l: 'Sph يمين',           ph: '-1.25' },
        { k: 'sphL',     l: 'Sph يسار',           ph: '-1.50' },
        { k: 'cylR',     l: 'Cyl / Axis يمين',    ph: '-0.50 x 180' },
        { k: 'cylL',     l: 'Cyl / Axis يسار',    ph: '-0.75 x 170' },
        { k: 'iop',      l: 'ضغط العين (mmHg)',   ph: '15 / 16' },
        { k: 'exam',     l: 'فحص القاع / القرنية', ph: 'القرنية صافية...', area: true }
      ]
    },
    {
      id: 'pediatrics', label: 'أطفال', icon: '🧒',
      fields: [
        { k: 'ageMonths',l: 'العمر (شهور)',        ph: '18' },
        { k: 'weight',   l: 'الوزن (كجم)',         ph: '11' },
        { k: 'height',   l: 'الطول (سم)',          ph: '80' },
        { k: 'head',     l: 'محيط الرأس (سم)',     ph: '47' },
        { k: 'temp',     l: 'الحرارة (°م)',        ph: '37.5' },
        { k: 'vaccines', l: 'التطعيمات',           opts: ['', 'منتظمة', 'متأخرة', 'غير معروفة'] },
        { k: 'feeding',  l: 'التغذية',             opts: ['', 'رضاعة طبيعية', 'صناعية', 'مختلطة', 'طعام عادي'] },
        { k: 'exam',     l: 'الفحص الإكلينيكي',    ph: 'نشيط، صدر سليم...', area: true }
      ]
    },
    {
      id: 'dermatology', label: 'جلدية', icon: '🧴',
      fields: [
        { k: 'site',     l: 'موضع الإصابة',        ph: 'الوجه / الذراع' },
        { k: 'lesion',   l: 'نوع الآفة',           opts: ['', 'بقعة', 'حطاطة', 'بثرة', 'حويصلة', 'قشور', 'تقرح'] },
        { k: 'duration', l: 'مدة الشكوى',          ph: 'أسبوعان' },
        { k: 'itching',  l: 'الحكة',               opts: ['', 'لا يوجد', 'خفيفة', 'متوسطة', 'شديدة'] },
        { k: 'spread',   l: 'الانتشار',            opts: ['', 'موضعي', 'منتشر'] },
        { k: 'exam',     l: 'وصف الفحص',           ph: 'طفح حمامي متقشر...', area: true }
      ]
    }
  ];

  function esc(s) {
    return (s == null ? '' : String(s)).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function list() {
    return SPECIALTIES.map(function (s) { return { id: s.id, label: s.label, icon: s.icon }; });
  }

  function byId(id) {
    for (var i = 0; i < SPECIALTIES.length; i++) if (SPECIALTIES[i].id === id) return SPECIALTIES[i];
    return SPECIALTIES[0];
  }

  function currentId() {
    try { return localStorage.getItem(KEY) || 'general'; } catch (e) { return 'general'; }
  }
  function current() { return byId(currentId()); }

  function set(id) {
    try { localStorage.setItem(KEY, byId(id).id); } catch (e) {}
  }

  function fieldHtml(f, v) {
    var val = esc(v == null ? '' : v);
    var input;
    if (f.opts) {
      input = '<select class="sp-f" data-k="' + f.k + '">' +
        f.opts.map(function (o) {
          return '<option value="' + esc(o) + '"' + (o === v ? ' selected' : '') + '>' + (o ? esc(o) : '—') + '</option>';
        }).join('') + '</select>';
    } else if (f.area) {
      input = '<textarea class="sp-f" data-k="' + f.k + '" rows="2" placeholder="' + esc(f.ph || '') + '">' + val + '</textarea>';
    } else {
      input = '<input class="sp-f" data-k="' + f.k + '" value="' + val + '" placeholder="' + esc(f.ph || '') + '" />';
    }
    var style = (f.area || f.wide) ? ' style="grid-column:1 / -1;"' : '';
    return '<div class="field"' + style + '><label>' + esc(f.l) + '</label>' + input + '</div>';
  }

  function formHtml(values) {
    values = values || {};
    var s = current();
    return '<div class="grid-2 sp-form" data-specialty="' + s.id + '">' +
      s.fields.map(function (f) { return fieldHtml(f, values[f.k]); }).join('') +
      '</div>';
  }

  function collect(root) {
    var s = current();
    var out = {};
    var box = (root || document).querySelector('.sp-form');
    if (box) {
      box.querySelectorAll('.sp-f').forEach(function (el) {
        var v = (el.value || '').trim();
        if (v) out[el.dataset.k] = v;
      });
    }
    if (!Object.keys(out).length) return null;
    return { specialty: s.id, label: s.label, fields: out };
  }

  function summaryRows(exam) {
    if (!exam || !exam.fields) return [];
    var s = byId(exam.specialty);
    return s.fields
      .filter(function (f) { return exam.fields[f.k]; })
      .map(function (f) { return [f.l, exam.fields[f.k]]; });
  }

  window.ClinicSpecialty = {
    list: list, current: current, currentId: currentId, set: set,
    formHtml: formHtml, collect: collect, summaryRows: summaryRows, escape: esc
  };

  // ---- Admin page: self-wiring picker (only runs if the select exists) ----
  function wireAdmin() {
    var sel = document.getElementById('clinicSpecialty');
    if (!sel) return;
    sel.innerHTML = list().map(function (s) {
      return '<option value="' + s.id + '">' + s.icon + ' ' + esc(s.label) + '</option>';
    }).join('');
    sel.value = currentId();
    var hint = document.getElementById('clinicSpecialtyHint');
    function showHint(msg) { if (hint) hint.textContent = msg; }
    sel.addEventListener('change', function () {
      set(sel.value);
      showHint('تم حفظ التخصص: ' + current().label);
      if (typeof window.toast === 'function') window.toast('تم حفظ تخصص العيادة');
    });
    showHint('التخصص الحالي: ' + current().label);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wireAdmin, { once: true });
  } else {
    wireAdmin();
  }
})();
