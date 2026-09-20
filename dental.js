// ============ Dental module (وحدة الأسنان) ============
// Adds to the dental specialty, on top of the shared exam fields:
//   1. Odontogram  — interactive FDI adult chart
//   2. Treatment plan — tooth / treatment / status / notes
//   3. Attachments — X-ray, dental photo, before/after (existing Firebase Storage)

(function () {
  var SP = window.ClinicSpecialty;
  if (!SP) return;
  var esc = SP.escape;

  var UPPER = ['18','17','16','15','14','13','12','11','21','22','23','24','25','26','27','28'];
  var LOWER = ['48','47','46','45','44','43','42','41','31','32','33','34','35','36','37','38'];

  var CONDITIONS = [
    { v: '',          l: '— بدون —',   c: '' },
    { v: 'سليم',       l: 'سليم',       c: '#d1fae5' },
    { v: 'تسوس',       l: 'تسوس',       c: '#fecaca' },
    { v: 'حشو',        l: 'حشو',        c: '#bfdbfe' },
    { v: 'تركيبة',     l: 'تركيبة',     c: '#fde68a' },
    { v: 'مفقود',      l: 'مفقود',      c: '#e5e7eb' },
    { v: 'خلع',        l: 'خلع',        c: '#fbcfe8' },
    { v: 'علاج عصب',   l: 'علاج عصب',   c: '#ddd6fe' },
    { v: 'زراعة',      l: 'زراعة',      c: '#c7d2fe' },
    { v: 'كسر',        l: 'كسر',        c: '#fed7aa' },
    { v: 'أخرى',       l: 'أخرى',       c: '#f5d0fe' }
  ];
  function color(v) {
    for (var i = 0; i < CONDITIONS.length; i++) if (CONDITIONS[i].v === v) return CONDITIONS[i].c;
    return '';
  }

  /* ---------- 1) Odontogram ---------- */
  function rowHtml(nums, teeth) {
    return '<div class="odo-row">' + nums.map(function (n, i) {
      var v = teeth[n] || '';
      var bg = color(v);
      var sep = (i === 8) ? ' odo-sep' : '';
      return '<button type="button" class="odo-tooth' + sep + '" data-t="' + n + '"' +
        (bg ? ' style="background:' + bg + '"' : '') + ' title="' + esc(v) + '">' +
        '<span class="odo-num">' + n + '</span></button>';
    }).join('') + '</div>';
  }

  SP.addSection('dental', {
    id: 'odontogram',
    title: '🦷 خريطة الأسنان (Odontogram)',
    html: function (v) {
      var teeth = (v && v.teeth) || {};
      return '<p class="muted">اضغط على السن ثم اختر حالته.</p>' +
        '<div class="odo-chart">' + rowHtml(UPPER, teeth) + rowHtml(LOWER, teeth) + '</div>' +
        '<div class="odo-picker" hidden>' +
          '<span class="odo-picked">السن: —</span> ' +
          '<select class="odo-cond">' + CONDITIONS.map(function (c) {
            return '<option value="' + esc(c.v) + '">' + esc(c.l) + '</option>';
          }).join('') + '</select>' +
        '</div>' +
        '<div class="odo-summary muted"></div>';
    },
    wire: function (el) {
      var teeth = {};
      el._teeth = teeth;
      var picker = el.querySelector('.odo-picker');
      var picked = el.querySelector('.odo-picked');
      var cond = el.querySelector('.odo-cond');
      var summary = el.querySelector('.odo-summary');
      var active = null;

      function refresh() {
        var keys = Object.keys(teeth);
        summary.textContent = keys.length
          ? keys.map(function (k) { return k + ': ' + teeth[k]; }).join('  •  ')
          : 'لم يتم تسجيل أي سن بعد.';
      }
      el.querySelectorAll('.odo-tooth').forEach(function (b) {
        b.addEventListener('click', function () {
          el.querySelectorAll('.odo-tooth').forEach(function (x) { x.classList.remove('active'); });
          b.classList.add('active');
          active = b;
          picker.hidden = false;
          picked.textContent = 'السن: ' + b.dataset.t;
          cond.value = teeth[b.dataset.t] || '';
        });
      });
      cond.addEventListener('change', function () {
        if (!active) return;
        var t = active.dataset.t, v = cond.value;
        if (v) { teeth[t] = v; } else { delete teeth[t]; }
        active.style.background = color(v);
        active.title = v;
        refresh();
      });
      refresh();
    },
    collect: function (el) {
      var t = el._teeth || {};
      return Object.keys(t).length ? { teeth: t } : null;
    },
    render: function (v) {
      var t = (v && v.teeth) || {};
      var keys = Object.keys(t).sort();
      if (!keys.length) return '';
      return SP.tableHtml(['السن', 'الحالة'], keys.map(function (k) { return [k, t[k]]; }));
    }
  });

  /* ---------- 2) Treatment plan ---------- */
  var TREATMENTS = ['', 'حشو', 'علاج عصب', 'خلع', 'تنظيف وتلميع', 'تركيبة / تاج', 'جسر', 'زراعة', 'تقويم', 'تبييض', 'علاج لثة', 'أخرى'];
  var STATUSES = ['مخطط', 'قيد التنفيذ', 'مكتمل'];

  function planRow() {
    return '<div class="plan-row">' +
      '<input class="p-tooth" placeholder="رقم السن (26)" />' +
      '<select class="p-treat">' + TREATMENTS.map(function (t) {
        return '<option value="' + esc(t) + '">' + (t ? esc(t) : '— العلاج —') + '</option>';
      }).join('') + '</select>' +
      '<select class="p-status">' + STATUSES.map(function (s) {
        return '<option value="' + esc(s) + '">' + esc(s) + '</option>';
      }).join('') + '</select>' +
      '<input class="p-notes" placeholder="ملاحظات" />' +
      '<button type="button" class="btn small danger p-del">🗑</button>' +
      '</div>';
  }

  SP.addSection('dental', {
    id: 'plan',
    title: '📋 خطة العلاج',
    html: function () {
      return '<p class="muted">أضف العلاجات المخططة لكل سن وحالتها.</p>' +
        '<div class="plan-list">' + planRow() + '</div>' +
        '<button type="button" class="btn ghost small plan-add">+ إضافة علاج</button>';
    },
    wire: function (el) {
      var list = el.querySelector('.plan-list');
      el.querySelector('.plan-add').addEventListener('click', function () {
        list.insertAdjacentHTML('beforeend', planRow());
      });
      list.addEventListener('click', function (e) {
        if (!e.target.classList.contains('p-del')) return;
        var rows = list.querySelectorAll('.plan-row');
        if (rows.length === 1) {
          rows[0].querySelectorAll('input').forEach(function (i) { i.value = ''; });
          rows[0].querySelector('.p-treat').value = '';
          return;
        }
        e.target.closest('.plan-row').remove();
      });
    },
    collect: function (el) {
      var out = [];
      el.querySelectorAll('.plan-row').forEach(function (r) {
        var tooth = (r.querySelector('.p-tooth').value || '').trim();
        var treat = r.querySelector('.p-treat').value;
        if (!tooth && !treat) return;
        out.push({
          tooth: tooth, treatment: treat,
          status: r.querySelector('.p-status').value,
          notes: (r.querySelector('.p-notes').value || '').trim()
        });
      });
      return out.length ? out : null;
    },
    render: function (v) {
      if (!v || !v.length) return '';
      return SP.tableHtml(['السن', 'العلاج', 'الحالة', 'ملاحظات'],
        v.map(function (r) { return [r.tooth, r.treatment, r.status, r.notes]; }));
    }
  });

  /* ---------- 3) Attachments ---------- */
  SP.addSection('dental', SP.filesSection({
    id: 'files',
    title: '📎 مرفقات الأسنان',
    hint: 'أشعة، صور الأسنان، صور قبل/بعد.',
    folder: 'dental'
  }));
})();
