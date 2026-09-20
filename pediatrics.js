// ============ Pediatrics module (وحدة الأطفال) ============
// Adds: vaccination checklist + attachments (تقارير ومعامل).

(function () {
  var SP = window.ClinicSpecialty;
  if (!SP) return;
  var esc = SP.escape;

  var VACCINES = [
    'الدرن (BCG)', 'الالتهاب الكبدي B', 'الثلاثي (DTP)', 'شلل الأطفال (OPV/IPV)',
    'الروتا', 'المكورات الرئوية', 'الحصبة والنكاف والحصبة الألمانية (MMR)', 'الجديري المائي', 'الإنفلونزا الموسمية'
  ];

  SP.addSection('pediatrics', {
    id: 'vaccines',
    title: '💉 سجل التطعيمات',
    html: function () {
      return '<p class="muted">حدد التطعيمات التي تم أخذها وتاريخها.</p>' +
        '<div class="vac-list">' + VACCINES.map(function (v, i) {
          return '<div class="vac-row">' +
            '<label><input type="checkbox" class="vac-done" data-v="' + i + '" /> ' + esc(v) + '</label>' +
            '<input type="date" class="vac-date" data-v="' + i + '" />' +
            '</div>';
        }).join('') + '</div>';
    },
    collect: function (el) {
      var out = [];
      el.querySelectorAll('.vac-row').forEach(function (r, i) {
        var done = r.querySelector('.vac-done').checked;
        var date = r.querySelector('.vac-date').value;
        if (done || date) out.push({ name: VACCINES[i], done: done, date: date });
      });
      return out.length ? out : null;
    },
    render: function (v) {
      if (!v || !v.length) return '';
      return SP.tableHtml(['التطعيم', 'تم', 'التاريخ'],
        v.map(function (r) { return [r.name, r.done ? '✔' : '—', r.date || '-']; }));
    }
  });

  SP.addSection('pediatrics', SP.filesSection({
    id: 'files',
    title: '📎 مرفقات الطفل',
    hint: 'تقارير، تحاليل، كارت التطعيمات.',
    folder: 'pediatrics'
  }));
})();
