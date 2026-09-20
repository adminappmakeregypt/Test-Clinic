// ============ Ophthalmology module (وحدة الرمد والعيون) ============
// Adds: refraction / visual acuity table + eye imaging attachments.

(function () {
  var SP = window.ClinicSpecialty;
  if (!SP) return;
  var esc = SP.escape;

  var COLS = [
    { k: 'va',   l: 'حدة الإبصار', ph: '6/6' },
    { k: 'sph',  l: 'Sph',         ph: '-1.25' },
    { k: 'cyl',  l: 'Cyl',         ph: '-0.50' },
    { k: 'axis', l: 'Axis',        ph: '180' },
    { k: 'add',  l: 'Add',         ph: '+2.00' }
  ];
  var EYES = [{ k: 'right', l: 'العين اليمنى (OD)' }, { k: 'left', l: 'العين اليسرى (OS)' }];

  SP.addSection('ophthalmology', {
    id: 'refraction',
    title: '👓 قياس النظر (Refraction)',
    html: function () {
      return '<div class="table-wrap"><table class="rfx"><thead><tr><th>العين</th>' +
        COLS.map(function (c) { return '<th>' + esc(c.l) + '</th>'; }).join('') +
        '</tr></thead><tbody>' +
        EYES.map(function (e) {
          return '<tr data-eye="' + e.k + '"><td>' + esc(e.l) + '</td>' +
            COLS.map(function (c) {
              return '<td><input class="rfx-f" data-k="' + c.k + '" placeholder="' + esc(c.ph) + '" /></td>';
            }).join('') + '</tr>';
        }).join('') + '</tbody></table></div>';
    },
    collect: function (el) {
      var out = {};
      el.querySelectorAll('tr[data-eye]').forEach(function (tr) {
        var row = {};
        tr.querySelectorAll('.rfx-f').forEach(function (i) {
          var v = (i.value || '').trim();
          if (v) row[i.dataset.k] = v;
        });
        if (Object.keys(row).length) out[tr.dataset.eye] = row;
      });
      return Object.keys(out).length ? out : null;
    },
    render: function (v) {
      var rows = EYES.filter(function (e) { return v[e.k]; }).map(function (e) {
        var r = v[e.k];
        return [e.l].concat(COLS.map(function (c) { return r[c.k] || '-'; }));
      });
      if (!rows.length) return '';
      return SP.tableHtml(['العين'].concat(COLS.map(function (c) { return c.l; })), rows);
    }
  });

  SP.addSection('ophthalmology', SP.filesSection({
    id: 'files',
    title: '📎 صور وفحوصات العين',
    hint: 'صور قاع العين، OCT، مجال الرؤية.',
    folder: 'ophthalmology'
  }));
})();
