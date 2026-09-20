// ============ Dermatology module (وحدة الجلدية) ============
// Adds: lesion map (موضع + نوع + حجم) + before/after photo attachments.

(function () {
  var SP = window.ClinicSpecialty;
  if (!SP) return;
  var esc = SP.escape;

  var SITES = ['', 'فروة الرأس', 'الوجه', 'الرقبة', 'الصدر', 'الظهر', 'البطن', 'الذراع', 'اليد', 'الساق', 'القدم', 'الأظافر', 'منطقة أخرى'];
  var TYPES = ['', 'بقعة (Macule)', 'حطاطة (Papule)', 'بثرة (Pustule)', 'حويصلة (Vesicle)', 'عقدة (Nodule)', 'قشور (Scales)', 'تقرح (Ulcer)', 'كيس (Cyst)', 'وحمة (Nevus)'];

  function row() {
    return '<div class="les-row">' +
      '<select class="l-site">' + SITES.map(function (s) {
        return '<option value="' + esc(s) + '">' + (s ? esc(s) : '— الموضع —') + '</option>';
      }).join('') + '</select>' +
      '<select class="l-type">' + TYPES.map(function (t) {
        return '<option value="' + esc(t) + '">' + (t ? esc(t) : '— نوع الآفة —') + '</option>';
      }).join('') + '</select>' +
      '<input class="l-size" placeholder="الحجم (سم)" />' +
      '<input class="l-notes" placeholder="ملاحظات" />' +
      '<button type="button" class="btn small danger l-del">🗑</button>' +
      '</div>';
  }

  SP.addSection('dermatology', {
    id: 'lesions',
    title: '🔎 خريطة الآفات الجلدية',
    html: function () {
      return '<p class="muted">سجّل موضع ونوع كل آفة.</p>' +
        '<div class="les-list">' + row() + '</div>' +
        '<button type="button" class="btn ghost small les-add">+ إضافة آفة</button>';
    },
    wire: function (el) {
      var list = el.querySelector('.les-list');
      el.querySelector('.les-add').addEventListener('click', function () {
        list.insertAdjacentHTML('beforeend', row());
      });
      list.addEventListener('click', function (e) {
        if (!e.target.classList.contains('l-del')) return;
        var rows = list.querySelectorAll('.les-row');
        if (rows.length === 1) {
          rows[0].querySelectorAll('input').forEach(function (i) { i.value = ''; });
          rows[0].querySelector('.l-site').value = '';
          rows[0].querySelector('.l-type').value = '';
          return;
        }
        e.target.closest('.les-row').remove();
      });
    },
    collect: function (el) {
      var out = [];
      el.querySelectorAll('.les-row').forEach(function (r) {
        var site = r.querySelector('.l-site').value;
        var type = r.querySelector('.l-type').value;
        if (!site && !type) return;
        out.push({
          site: site, type: type,
          size: (r.querySelector('.l-size').value || '').trim(),
          notes: (r.querySelector('.l-notes').value || '').trim()
        });
      });
      return out.length ? out : null;
    },
    render: function (v) {
      if (!v || !v.length) return '';
      return SP.tableHtml(['الموضع', 'نوع الآفة', 'الحجم', 'ملاحظات'],
        v.map(function (r) { return [r.site, r.type, r.size, r.notes]; }));
    }
  });

  SP.addSection('dermatology', SP.filesSection({
    id: 'files',
    title: '📎 صور الحالة',
    hint: 'صور قبل / بعد العلاج.',
    folder: 'dermatology'
  }));
})();
