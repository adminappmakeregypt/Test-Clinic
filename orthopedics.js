// ============ Orthopedics module (وحدة العظام) ============
// Adds to the orthopedics specialty, on top of the shared exam fields:
//   1. مواضع الألم  — body areas + الجهة (يمين / يسار / الجهتين)
//   2. الإصابة والكسر — injury / trauma + fracture details
//   3. الأشعة والفحوصات — imaging rows (النوع / التاريخ / النتيجة / ملاحظات)
//   4. خطة العلاج والعلاج الطبيعي والمتابعة
//   5. المرفقات — أشعة / تقارير (نفس تخزين Firebase الحالي)

(function () {
  var SP = window.ClinicSpecialty;
  if (!SP) return;
  var esc = SP.escape;

  /* ---------- 1) Pain areas ---------- */
  var AREAS = ['الرقبة', 'الكتف', 'الذراع', 'الكوع', 'الرسغ', 'اليد', 'الظهر', 'الحوض', 'الفخذ',
               'الركبة', 'الساق', 'الكاحل', 'القدم'];
  var SIDES = ['يمين', 'يسار', 'الجهتان'];

  SP.addSection('orthopedics', {
    id: 'pain',
    title: '📍 مواضع الألم',
    html: function (v) {
      v = v || {};
      var picked = v.areas || [];
      var chips = AREAS.map(function (a) {
        var on = picked.indexOf(a) >= 0;
        return '<label class="ort-chip"><input type="checkbox" class="ort-area" value="' + esc(a) + '"' +
          (on ? ' checked' : '') + ' /> ' + esc(a) + '</label>';
      }).join('');
      var sides = SIDES.map(function (s) {
        return '<label class="ort-chip"><input type="radio" name="ortSide" class="ort-side" value="' + esc(s) + '"' +
          (v.side === s ? ' checked' : '') + ' /> ' + esc(s) + '</label>';
      }).join('');
      return '<p class="muted">حدد مواضع الألم والجهة.</p>' +
        '<div class="ort-chips">' + chips + '</div>' +
        '<div class="ort-chips ort-sides">' + sides + '</div>' +
        '<div class="field" style="margin-top:8px"><label>موضع آخر</label>' +
        '<input class="ort-other" value="' + esc(v.other || '') + '" placeholder="موضع غير مذكور" /></div>';
    },
    collect: function (el) {
      var areas = [];
      el.querySelectorAll('.ort-area:checked').forEach(function (c) { areas.push(c.value); });
      var sideEl = el.querySelector('.ort-side:checked');
      var other = (el.querySelector('.ort-other').value || '').trim();
      if (!areas.length && !sideEl && !other) return null;
      return { areas: areas, side: sideEl ? sideEl.value : '', other: other };
    },
    render: function (v) {
      if (!v) return '';
      var rows = [];
      if (v.areas && v.areas.length) rows.push(['المواضع', v.areas.join('، ')]);
      if (v.side) rows.push(['الجهة', v.side]);
      if (v.other) rows.push(['موضع آخر', v.other]);
      return rows.length ? SP.tableHtml(['البند', 'القيمة'], rows) : '';
    }
  });

  /* ---------- 2) Injury / fracture ---------- */
  var FR_TYPE = ['', 'مغلق', 'مفتوح'];
  var FR_DISP = ['', 'غير مزاح', 'مزاح'];

  SP.addSection('orthopedics', {
    id: 'fracture',
    title: '🦴 الإصابة والكسر',
    html: function (v) {
      v = v || {};
      function inp(k, l, ph) {
        return '<div class="field"><label>' + esc(l) + '</label><input class="ort-f" data-k="' + k +
          '" value="' + esc(v[k] || '') + '" placeholder="' + esc(ph || '') + '" /></div>';
      }
      function sel(k, l, opts) {
        return '<div class="field"><label>' + esc(l) + '</label><select class="ort-f" data-k="' + k + '">' +
          opts.map(function (o) {
            return '<option value="' + esc(o) + '"' + (o === v[k] ? ' selected' : '') + '>' + (o ? esc(o) : '—') + '</option>';
          }).join('') + '</select></div>';
      }
      return '<div class="grid-2">' +
        inp('mechanism', 'آلية الإصابة', 'سقوط / حادث / رياضة') +
        inp('injuryDate', 'تاريخ الإصابة', 'مثال: 2026-09-01') +
        inp('site', 'موضع الكسر', 'مثال: الكعبرة السفلية') +
        sel('type', 'نوع الكسر', FR_TYPE) +
        sel('displaced', 'الإزاحة', FR_DISP) +
        '<div class="field" style="grid-column:1 / -1"><label>وصف الكسر</label>' +
        '<textarea class="ort-f" data-k="desc" rows="2" placeholder="خط كسر واضح...">' + esc(v.desc || '') + '</textarea></div>' +
        '</div>';
    },
    collect: function (el) {
      var out = {}, any = false;
      el.querySelectorAll('.ort-f').forEach(function (f) {
        var val = (f.value || '').trim();
        if (val) { out[f.dataset.k] = val; any = true; }
      });
      return any ? out : null;
    },
    render: function (v) {
      if (!v) return '';
      var L = { mechanism: 'آلية الإصابة', injuryDate: 'تاريخ الإصابة', site: 'موضع الكسر',
                type: 'نوع الكسر', displaced: 'الإزاحة', desc: 'وصف الكسر' };
      var rows = Object.keys(L).filter(function (k) { return v[k]; })
        .map(function (k) { return [L[k], v[k]]; });
      return rows.length ? SP.tableHtml(['البند', 'القيمة'], rows) : '';
    }
  });

  /* ---------- 3) Imaging ---------- */
  var IMG_TYPES = ['', 'أشعة عادية (X-Ray)', 'رنين مغناطيسي (MRI)', 'أشعة مقطعية (CT)',
                   'موجات صوتية', 'قياس كثافة العظام', 'تحاليل', 'أخرى'];

  function imgRow(r) {
    r = r || {};
    return '<div class="ort-img-row">' +
      '<select class="i-type">' + IMG_TYPES.map(function (t) {
        return '<option value="' + esc(t) + '"' + (t === r.type ? ' selected' : '') + '>' + (t ? esc(t) : '— النوع —') + '</option>';
      }).join('') + '</select>' +
      '<input type="date" class="i-date" value="' + esc(r.date || '') + '" />' +
      '<input class="i-result" placeholder="النتيجة / التقرير" value="' + esc(r.result || '') + '" />' +
      '<input class="i-notes" placeholder="ملاحظات الطبيب" value="' + esc(r.notes || '') + '" />' +
      '<button type="button" class="btn small danger i-del">🗑</button>' +
      '</div>';
  }

  SP.addSection('orthopedics', {
    id: 'imaging',
    title: '🩻 الأشعة والفحوصات',
    html: function (v) {
      var rows = (v && v.length) ? v.map(function (r) { return imgRow(r); }).join('') : imgRow();
      return '<p class="muted">سجّل الأشعة والفحوصات ونتائجها.</p>' +
        '<div class="ort-img-list">' + rows + '</div>' +
        '<button type="button" class="btn ghost small ort-img-add">+ إضافة فحص</button>';
    },
    wire: function (el) {
      if (el._ortImgWired) return; el._ortImgWired = true;
      var list = el.querySelector('.ort-img-list');
      el.querySelector('.ort-img-add').addEventListener('click', function () {
        list.insertAdjacentHTML('beforeend', imgRow());
      });
      list.addEventListener('click', function (e) {
        if (!e.target.classList.contains('i-del')) return;
        var rows = list.querySelectorAll('.ort-img-row');
        if (rows.length === 1) {
          rows[0].querySelectorAll('input').forEach(function (i) { i.value = ''; });
          rows[0].querySelector('.i-type').value = '';
          return;
        }
        e.target.closest('.ort-img-row').remove();
      });
    },
    collect: function (el) {
      var out = [];
      el.querySelectorAll('.ort-img-row').forEach(function (r) {
        var type = r.querySelector('.i-type').value;
        var date = r.querySelector('.i-date').value;
        var result = (r.querySelector('.i-result').value || '').trim();
        var notes = (r.querySelector('.i-notes').value || '').trim();
        if (!type && !date && !result && !notes) return;
        out.push({ type: type, date: date, result: result, notes: notes });
      });
      return out.length ? out : null;
    },
    render: function (v) {
      if (!v || !v.length) return '';
      return SP.tableHtml(['نوع الفحص', 'التاريخ', 'النتيجة', 'ملاحظات'],
        v.map(function (r) { return [r.type, r.date || '-', r.result, r.notes]; }));
    }
  });

  /* ---------- 4) Treatment plan / physiotherapy / follow-up ---------- */
  SP.addSection('orthopedics', {
    id: 'plan',
    title: '📋 خطة العلاج والمتابعة',
    html: function (v) {
      v = v || {};
      function area(k, l, ph) {
        return '<div class="field" style="grid-column:1 / -1"><label>' + esc(l) + '</label>' +
          '<textarea class="ort-p" data-k="' + k + '" rows="2" placeholder="' + esc(ph) + '">' + esc(v[k] || '') + '</textarea></div>';
      }
      var immob = ['', 'لا يوجد', 'جبس', 'جبيرة', 'رباط ضاغط', 'دعامة', 'عكاز'];
      return '<div class="grid-2">' +
        '<div class="field"><label>التثبيت</label><select class="ort-p" data-k="immob">' +
        immob.map(function (o) {
          return '<option value="' + esc(o) + '"' + (o === v.immob ? ' selected' : '') + '>' + (o ? esc(o) : '—') + '</option>';
        }).join('') + '</select></div>' +
        '<div class="field"><label>موعد المتابعة</label><input type="date" class="ort-p" data-k="followUp" value="' + esc(v.followUp || '') + '" /></div>' +
        area('plan', 'خطة العلاج', 'مسكنات، تثبيت، جراحة...') +
        area('physio', 'العلاج الطبيعي', 'تمارين مدى الحركة 3 جلسات أسبوعياً...') +
        '</div>';
    },
    collect: function (el) {
      var out = {}, any = false;
      el.querySelectorAll('.ort-p').forEach(function (f) {
        var val = (f.value || '').trim();
        if (val) { out[f.dataset.k] = val; any = true; }
      });
      return any ? out : null;
    },
    render: function (v) {
      if (!v) return '';
      var L = { immob: 'التثبيت', plan: 'خطة العلاج', physio: 'العلاج الطبيعي', followUp: 'موعد المتابعة' };
      var rows = Object.keys(L).filter(function (k) { return v[k]; })
        .map(function (k) { return [L[k], v[k]]; });
      return rows.length ? SP.tableHtml(['البند', 'القيمة'], rows) : '';
    }
  });

  /* ---------- 5) Attachments ---------- */
  SP.addSection('orthopedics', SP.filesSection({
    id: 'files',
    title: '📎 مرفقات العظام',
    hint: 'صور الأشعة، الرنين، التقارير الطبية (JPG / PNG / PDF).',
    folder: 'orthopedics'
  }));
})();
