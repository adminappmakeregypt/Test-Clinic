// ============ Pediatrics module (وحدة الأطفال) ============
// Adds: vaccination checklist (with manual add) + attachments (تقارير ومعامل).

(function () {
  var SP = window.ClinicSpecialty;
  if (!SP) return;
  var esc = SP.escape;

  var VACCINES = [
    'الدرن (BCG)', 'الالتهاب الكبدي B', 'الثلاثي (DTP)', 'شلل الأطفال (OPV/IPV)',
    'الروتا', 'المكورات الرئوية', 'الحصبة والنكاف والحصبة الألمانية (MMR)', 'الجديري المائي', 'الإنفلونزا الموسمية'
  ];

  function vacRow(name, done, date, custom) {
    return '<div class="vac-row" data-name="' + esc(name) + '"' + (custom ? ' data-custom="1"' : '') + '>' +
      '<label><input type="checkbox" class="vac-done"' + (done ? ' checked' : '') + ' /> ' + esc(name) + '</label>' +
      '<input type="date" class="vac-date" value="' + esc(date || '') + '" />' +
      (custom ? ' <button type="button" class="btn ghost sm vac-del" title="حذف">✖</button>' : '') +
      '</div>';
  }

  SP.addSection('pediatrics', {
    id: 'vaccines',
    title: '💉 سجل التطعيمات',
    html: function (v) {
      var saved = {}, custom = [];
      (Array.isArray(v) ? v : []).forEach(function (r) {
        if (!r || !r.name) return;
        if (VACCINES.indexOf(r.name) >= 0) saved[r.name] = r; else custom.push(r);
      });
      var rows = VACCINES.map(function (name) {
        var s = saved[name] || {};
        return vacRow(name, !!s.done, s.date, false);
      });
      custom.forEach(function (r) { rows.push(vacRow(r.name, !!r.done, r.date, true)); });
      return '<p class="muted">حدد التطعيمات التي تم أخذها وتاريخها، أو أضف تطعيماً يدوياً.</p>' +
        '<div class="vac-list">' + rows.join('') + '</div>' +
        '<div class="vac-add">' +
        '<input type="text" class="vac-new-name" placeholder="اسم تطعيم آخر…" />' +
        '<button type="button" class="btn sm vac-add-btn">➕ إضافة تطعيم</button>' +
        '</div>';
    },
    wire: function (el) {
      if (el._vacWired) return; el._vacWired = true;
      el.addEventListener('click', function (e) {
        var t = e.target;
        if (t.classList && t.classList.contains('vac-add-btn')) {
          var inp = el.querySelector('.vac-new-name');
          var name = (inp.value || '').trim();
          if (!name) { inp.focus(); return; }
          var list = el.querySelector('.vac-list');
          var tmp = document.createElement('div');
          tmp.innerHTML = vacRow(name, false, '', true);
          list.appendChild(tmp.firstChild);
          inp.value = '';
        } else if (t.classList && t.classList.contains('vac-del')) {
          var row = t.closest('.vac-row');
          if (row) row.remove();
        }
      });
      el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && e.target.classList && e.target.classList.contains('vac-new-name')) {
          e.preventDefault();
          var btn = el.querySelector('.vac-add-btn');
          if (btn) btn.click();
        }
      });
    },
    collect: function (el) {
      var out = [];
      el.querySelectorAll('.vac-row').forEach(function (r) {
        var done = r.querySelector('.vac-done').checked;
        var date = r.querySelector('.vac-date').value;
        if (done || date) out.push({ name: r.dataset.name || '', done: done, date: date });
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
