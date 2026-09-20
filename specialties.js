// ============ Specialty Module Layer (طبقة التخصصات) ============
// The clinic picks ONE specialty in لوحة المدير. Everything clinical that the
// doctor sees (exam fields + extra specialty sections) follows that choice.
//
// Storage (unchanged architecture):
//   - active specialty  -> localStorage clinicKey('clinic_specialty_v1')
//                          (mirrored to Firebase by cloud-sync.js, same appData pattern)
//   - booking specialty list (clinic_majors_v1) is now DERIVED from the chosen
//     specialty, so the old "إدارة التخصصات" screen is no longer needed.
//   - exam data is saved INSIDE the prescription document as an `exam` object.
//
// window.ClinicSpecialty API:
//   list() / current() / currentId() / set(id)
//   addSection(specialtyId, section)   <- used by dental.js, ophthalmology.js, ...
//   filesSection(opts)                 <- ready-made attachments section
//   formHtml(values) / wire(root) / collect(root)
//   summaryRows(exam) / detailHtml(exam)

(function () {
  var ck = window.clinicKey || function (n) { return n; };
  var KEY = ck('clinic_specialty_v1');
  var MAJORS_KEY = ck('clinic_majors_v1');

  var SPECIALTIES = [
    {
      id: 'general', label: 'طب عام', icon: '🩺', services: ['طب عام'],
      fields: [
        { k: 'bp',       l: 'ضغط الدم',           ph: '120/80' },
        { k: 'pulse',    l: 'النبض (ن/د)',        ph: '78' },
        { k: 'temp',     l: 'الحرارة (°م)',       ph: '37' },
        { k: 'weight',   l: 'الوزن (كجم)',        ph: '70' },
        { k: 'height',   l: 'الطول (سم)',         ph: '170' },
        { k: 'complaint',l: 'الشكوى الرئيسية',    ph: 'صداع منذ 3 أيام', wide: true },
        { k: 'exam',     l: 'الفحص الإكلينيكي',   ph: 'القلب والصدر طبيعي...', area: true }
      ],
      sections: []
    },
    {
      id: 'dental', label: 'أسنان', icon: '🦷', services: ['أسنان'],
      fields: [
        { k: 'chief',     l: 'الشكوى الأساسية',        ph: 'ألم في الضرس العلوي', wide: true },
        { k: 'hygiene',   l: 'نظافة الفم',             opts: ['', 'ممتازة', 'جيدة', 'متوسطة', 'ضعيفة'] },
        { k: 'gums',      l: 'حالة اللثة',             opts: ['', 'سليمة', 'التهاب خفيف', 'التهاب متوسط', 'التهاب شديد', 'نزيف'] },
        { k: 'plaque',    l: 'الترسبات (Plaque)',      opts: ['', 'لا يوجد', 'خفيف', 'متوسط', 'كثيف'] },
        { k: 'calculus',  l: 'الجير (Calculus)',       opts: ['', 'لا يوجد', 'خفيف', 'متوسط', 'كثيف'] },
        { k: 'mobility',  l: 'حركة الأسنان',           opts: ['', 'لا يوجد', 'درجة 1', 'درجة 2', 'درجة 3'] },
        { k: 'occlusion', l: 'الإطباق (Occlusion)',    opts: ['', 'طبيعي', 'Class I', 'Class II', 'Class III', 'تزاحم', 'فراغات'] },
        { k: 'notes',     l: 'ملاحظات عامة',           ph: 'ألم عند الطرق...', area: true }
      ],
      sections: []
    },
    {
      id: 'ophthalmology', label: 'رمد وعيون', icon: '👁️', services: ['رمد وعيون'],
      fields: [
        { k: 'complaint',l: 'الشكوى الرئيسية',    ph: 'زغللة في الرؤية', wide: true },
        { k: 'iopR',     l: 'ضغط العين - يمين',   ph: '15' },
        { k: 'iopL',     l: 'ضغط العين - يسار',   ph: '16' },
        { k: 'lens',     l: 'العدسة',             opts: ['', 'صافية', 'مياه بيضاء مبكرة', 'مياه بيضاء ناضجة', 'عدسة صناعية'] },
        { k: 'cornea',   l: 'القرنية',            opts: ['', 'صافية', 'التهاب', 'قرحة', 'ندبة'] },
        { k: 'exam',     l: 'فحص قاع العين',      ph: 'الشبكية والعصب البصري...', area: true }
      ],
      sections: []
    },
    {
      id: 'pediatrics', label: 'أطفال', icon: '🧒', services: ['أطفال'],
      fields: [
        { k: 'ageMonths',l: 'العمر (شهور)',        ph: '18' },
        { k: 'weight',   l: 'الوزن (كجم)',         ph: '11' },
        { k: 'height',   l: 'الطول (سم)',          ph: '80' },
        { k: 'head',     l: 'محيط الرأس (سم)',     ph: '47' },
        { k: 'temp',     l: 'الحرارة (°م)',        ph: '37.5' },
        { k: 'feeding',  l: 'التغذية',             opts: ['', 'رضاعة طبيعية', 'صناعية', 'مختلطة', 'طعام عادي'] },
        { k: 'develop',  l: 'النمو والتطور',       opts: ['', 'طبيعي', 'تأخر بسيط', 'تأخر واضح'] },
        { k: 'exam',     l: 'الفحص الإكلينيكي',    ph: 'نشيط، صدر سليم...', area: true }
      ],
      sections: []
    },
    {
      id: 'dermatology', label: 'جلدية', icon: '🧴', services: ['جلدية'],
      fields: [
        { k: 'complaint',l: 'الشكوى الرئيسية',     ph: 'طفح جلدي منذ أسبوع', wide: true },
        { k: 'duration', l: 'مدة الشكوى',          ph: 'أسبوعان' },
        { k: 'itching',  l: 'الحكة',               opts: ['', 'لا يوجد', 'خفيفة', 'متوسطة', 'شديدة'] },
        { k: 'spread',   l: 'الانتشار',            opts: ['', 'موضعي', 'منتشر'] },
        { k: 'skinType', l: 'نوع البشرة',          opts: ['', 'عادية', 'دهنية', 'جافة', 'مختلطة', 'حساسة'] },
        { k: 'exam',     l: 'وصف الفحص',           ph: 'طفح حمامي متقشر...', area: true }
      ],
      sections: []
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
    try { return byId(localStorage.getItem(KEY) || 'general').id; } catch (e) { return 'general'; }
  }
  function current() { return byId(currentId()); }

  // booking list (clinic_majors_v1) always follows the clinic specialty
  function syncMajors() {
    try {
      var want = JSON.stringify(current().services || [current().label]);
      if (localStorage.getItem(MAJORS_KEY) !== want) localStorage.setItem(MAJORS_KEY, want);
    } catch (e) {}
  }

  function set(id) {
    try { localStorage.setItem(KEY, byId(id).id); } catch (e) {}
    syncMajors();
  }

  function addSection(specialtyId, section) {
    var s = byId(specialtyId);
    if (!s || !section || !section.id) return;
    for (var i = 0; i < s.sections.length; i++) {
      if (s.sections[i].id === section.id) { s.sections[i] = section; return; }
    }
    s.sections.push(section);
  }

  /* ---------- plain fields ---------- */
  function fieldHtml(f, v) {
    var val = esc(v == null ? '' : v), input;
    if (f.opts) {
      input = '<select class="sp-f" data-k="' + f.k + '">' + f.opts.map(function (o) {
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
    var secVals = values.sections || {};
    var html = '<div class="grid-2 sp-form" data-specialty="' + s.id + '">' +
      s.fields.map(function (f) { return fieldHtml(f, (values.fields || values)[f.k]); }).join('') +
      '</div>';
    html += s.sections.map(function (sec) {
      return '<div class="sp-section" data-sid="' + sec.id + '">' +
        '<h4 class="sp-section-title">' + esc(sec.title) + '</h4>' +
        sec.html(secVals[sec.id]) + '</div>';
    }).join('');
    return html;
  }

  function wire(root) {
    root = root || document;
    current().sections.forEach(function (sec) {
      var el = root.querySelector('.sp-section[data-sid="' + sec.id + '"]');
      if (el && typeof sec.wire === 'function') { try { sec.wire(el); } catch (e) { console.warn(e); } }
    });
  }

  function collect(root) {
    root = root || document;
    var s = current(), out = {}, sections = {}, any = false;
    var box = root.querySelector('.sp-form');
    if (box) {
      box.querySelectorAll('.sp-f').forEach(function (el) {
        var v = (el.value || '').trim();
        if (v) { out[el.dataset.k] = v; any = true; }
      });
    }
    s.sections.forEach(function (sec) {
      var el = root.querySelector('.sp-section[data-sid="' + sec.id + '"]');
      if (!el || typeof sec.collect !== 'function') return;
      var v = null;
      try { v = sec.collect(el); } catch (e) { console.warn(e); }
      if (v && (!Array.isArray(v) ? Object.keys(v).length : v.length)) { sections[sec.id] = v; any = true; }
    });
    if (!any) return null;
    return { specialty: s.id, label: s.label, fields: out, sections: sections };
  }

  function summaryRows(exam) {
    if (!exam || !exam.fields) return [];
    var s = byId(exam.specialty);
    return s.fields
      .filter(function (f) { return exam.fields[f.k]; })
      .map(function (f) { return [f.l, exam.fields[f.k]]; });
  }

  // HTML blocks for the extra sections — used in the view modal AND in the PDF
  function detailHtml(exam) {
    if (!exam || !exam.sections) return '';
    var s = byId(exam.specialty);
    return s.sections.map(function (sec) {
      var v = exam.sections[sec.id];
      if (!v || typeof sec.render !== 'function') return '';
      var h = sec.render(v);
      return h ? '<h3 class="sp-detail-title">' + esc(sec.title) + '</h3>' + h : '';
    }).join('');
  }

  /* ---------- shared: attachments section (Firebase Storage) ---------- */
  function filesSection(opts) {
    opts = opts || {};
    return {
      id: opts.id || 'files',
      title: opts.title || '📎 المرفقات',
      html: function () {
        return '<p class="muted">' + esc(opts.hint || 'أرفق صور أو أشعة (JPG / PNG / PDF).') + '</p>' +
          '<input type="file" class="sp-file-input" multiple accept="image/*,application/pdf" />' +
          '<div class="sp-file-list"></div>';
      },
      wire: function (el) {
        var input = el.querySelector('.sp-file-input');
        var listEl = el.querySelector('.sp-file-list');
        el._files = [];
        function render() {
          listEl.innerHTML = el._files.map(function (f, i) {
            return '<div class="sp-file-row"><a href="' + esc(f.url) + '" target="_blank" rel="noopener">' +
              esc(f.name) + '</a><button type="button" class="btn small danger" data-fi="' + i + '">🗑</button></div>';
          }).join('');
          listEl.querySelectorAll('button[data-fi]').forEach(function (b) {
            b.addEventListener('click', function () { el._files.splice(Number(b.dataset.fi), 1); render(); });
          });
        }
        input.addEventListener('change', async function () {
          var files = Array.from(input.files || []);
          input.value = '';
          if (!files.length) return;
          if (!window.ClinicFiles || !window.ClinicFiles.upload) {
            listEl.innerHTML = '<p class="muted">رفع الملفات غير متاح حالياً.</p>';
            return;
          }
          listEl.insertAdjacentHTML('beforeend', '<p class="sp-uploading muted">جارٍ رفع الملفات...</p>');
          for (var i = 0; i < files.length; i++) {
            try {
              var meta = await window.ClinicFiles.upload(files[i], opts.folder || 'attachments');
              el._files.push(meta);
            } catch (e) {
              console.warn('upload failed', e);
              alert('تعذر رفع الملف: ' + files[i].name);
            }
          }
          render();
        });
      },
      collect: function (el) { return (el._files && el._files.length) ? el._files.slice() : null; },
      render: function (v) {
        if (!v || !v.length) return '';
        return '<ul class="sp-files-view">' + v.map(function (f) {
          return '<li><a href="' + esc(f.url) + '" target="_blank" rel="noopener">' + esc(f.name) + '</a></li>';
        }).join('') + '</ul>';
      }
    };
  }

  function tableHtml(head, rows) {
    return '<div class="table-wrap"><table><thead><tr>' +
      head.map(function (h) { return '<th>' + esc(h) + '</th>'; }).join('') +
      '</tr></thead><tbody>' +
      rows.map(function (r) {
        return '<tr>' + r.map(function (c) { return '<td>' + esc(c == null ? '' : c) + '</td>'; }).join('') + '</tr>';
      }).join('') + '</tbody></table></div>';
  }

  window.ClinicSpecialty = {
    list: list, current: current, currentId: currentId, set: set,
    addSection: addSection, filesSection: filesSection, tableHtml: tableHtml,
    formHtml: formHtml, wire: wire, collect: collect,
    summaryRows: summaryRows, detailHtml: detailHtml, escape: esc
  };

  syncMajors();

  /* ---- Admin page: self-wiring picker (only runs if the select exists) ---- */
  function wireAdmin() {
    var sel = document.getElementById('clinicSpecialty');
    if (!sel) return;
    sel.innerHTML = list().map(function (s) {
      return '<option value="' + s.id + '">' + s.icon + ' ' + esc(s.label) + '</option>';
    }).join('');
    sel.value = currentId();
    var hint = document.getElementById('clinicSpecialtyHint');
    function describe() {
      var s = current();
      var extras = s.sections.map(function (x) { return x.title; });
      var txt = 'التخصص الحالي: ' + s.label;
      if (extras.length) txt += ' — مميزات إضافية: ' + extras.join('، ');
      else txt += ' — حقول الفحص الأساسية';
      if (hint) hint.textContent = txt;
    }
    sel.addEventListener('change', function () {
      set(sel.value);
      describe();
      if (typeof window.toast === 'function') window.toast('تم حفظ تخصص العيادة');
      document.dispatchEvent(new Event('clinic-specialty-changed'));
    });
    describe();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wireAdmin, { once: true });
  } else {
    wireAdmin();
  }
})();
