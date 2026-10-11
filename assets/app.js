(function () {
  const $ = id => document.getElementById(id);
  const CFG = window.APP_CONFIG || {};
  const LOW = Number(CFG.LOW_STOCK) || 5;
  let fmt;
  try { fmt = new Intl.NumberFormat(undefined, { style: 'currency', currency: CFG.CURRENCY || 'USD' }); }
  catch (_) { fmt = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }); }
  const money = n => fmt.format(n || 0);
  let items = [], sortK = 'name', sortD = 1, editId = null, delId = null;

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const margin = x => x.price > 0 ? (x.price - x.cost) / x.price * 100 : 0;

  const ERRORS = {
    DUPLICATE_SKU: 'That SKU already exists.',
    NOT_FOUND: 'That product no longer exists. Refresh the page.',
    Unauthorized: 'Token mismatch: SHEETS_TOKEN in config.js must equal TOKEN in Code.gs.'
  };

  // Talks straight to the Google Apps Script web app.
  // text/plain keeps this a "simple" request, so the browser sends no CORS preflight.
  async function api(action, body) {
    if (!CFG.SHEETS_URL || CFG.SHEETS_URL.startsWith('PASTE_')) throw new Error('Set SHEETS_URL in config.js first.');
    let res;
    try {
      res = await fetch(CFG.SHEETS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(Object.assign({}, body, { action: action, token: CFG.SHEETS_TOKEN })),
        redirect: 'follow'
      });
    } catch (e) {
      throw new Error('Could not reach Google. Check your internet connection and SHEETS_URL.');
    }
    let data;
    try { data = await res.json(); }
    catch (e) { throw new Error('Google did not return JSON. Check SHEETS_URL (must end in /exec) and that access is set to "Anyone".'); }
    if (data.error) throw new Error(ERRORS[data.error] || data.error.replace(/^INVALID: /, ''));
    return data;
  }

  async function load() {
    try { items = (await api('list')).data || []; render(); }
    catch (e) { $('empty').hidden = false; $('empty').textContent = e.message; }
  }

  function render() {
    const q = $('q').value.trim().toLowerCase();
    const sel = $('cat'), keep = sel.value;
    const cats = [...new Set(items.map(x => x.category).filter(Boolean))].sort();
    sel.innerHTML = '<option value="">All categories</option>' + cats.map(k => `<option>${esc(k)}</option>`).join('');
    sel.value = cats.includes(keep) ? keep : '';
    $('cats').innerHTML = cats.map(k => `<option value="${esc(k)}">`).join('');

    const list = items.filter(x =>
      (!sel.value || x.category === sel.value) &&
      (!q || [x.sku, x.name, x.category].join(' ').toLowerCase().includes(q))
    ).sort((a, b) => {
      const va = sortK === 'margin' ? margin(a) : a[sortK], vb = sortK === 'margin' ? margin(b) : b[sortK];
      return (typeof va === 'string' ? va.localeCompare(vb) : va - vb) * sortD;
    });

    $('rows').innerHTML = list.map(x => {
      const m = margin(x), qc = x.qty <= 0 ? 'out' : x.qty <= LOW ? 'low' : '';
      return `<tr>
        <td data-l="SKU">${esc(x.sku)}</td>
        <td data-l="Product"><b>${esc(x.name)}</b></td>
        <td data-l="Category">${esc(x.category || '—')}</td>
        <td class="n ${qc}" data-l="Qty">${x.qty}</td>
        <td class="n" data-l="Cost">${money(x.cost)}</td>
        <td class="n" data-l="Price">${money(x.price)}</td>
        <td class="n ${m >= 0 ? 'good' : 'out'}" data-l="Margin">${m.toFixed(1)}%</td>
        <td class="act-c"><div class="act">
          <button class="s" data-e="${x.id}">Edit</button>
          <button class="s d" data-d="${x.id}">Delete</button></div></td></tr>`;
    }).join('');

    $('empty').hidden = list.length > 0;
    $('empty').textContent = items.length ? 'No products match your filter.' : 'No products yet. Click “Add product” to create one.';

    $('sItems').textContent = items.length;
    $('sUnits').textContent = items.reduce((s, x) => s + x.qty, 0);
    $('sCost').textContent = money(items.reduce((s, x) => s + x.qty * x.cost, 0));
    $('sRetail').textContent = money(items.reduce((s, x) => s + x.qty * x.price, 0));
  }

  function openForm(x) {
    editId = x ? x.id : null;
    $('dt').textContent = x ? 'Edit product' : 'Add product';
    $('err').textContent = '';
    $('fSku').value = x ? x.sku : ''; $('fName').value = x ? x.name : ''; $('fCat').value = x ? x.category : '';
    $('fQty').value = x ? x.qty : 0; $('fCost').value = x ? x.cost : 0; $('fPrice').value = x ? x.price : 0;
    $('dlg').showModal();
  }

  $('add').onclick = () => openForm(null);
  $('cancel').onclick = () => $('dlg').close();

  $('f').addEventListener('submit', async e => {
    e.preventDefault();
    const body = {
      id: editId, sku: $('fSku').value.trim(), name: $('fName').value.trim(), category: $('fCat').value.trim(),
      qty: Number($('fQty').value), cost: Number($('fCost').value), price: Number($('fPrice').value)
    };
    if (!body.sku || !body.name) { $('err').textContent = 'SKU and product name are required.'; return; }
    $('save').disabled = true;
    try {
      await api(editId ? 'update' : 'create', body);
      $('dlg').close();
      await load();
    } catch (x) { $('err').textContent = x.message; }
    $('save').disabled = false;
  });

  $('rows').onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.e) openForm(items.find(x => x.id === b.dataset.e));
    if (b.dataset.d) {
      delId = b.dataset.d;
      const x = items.find(i => i.id === delId);
      $('delTxt').textContent = `“${x.name}” (${x.sku}) will be permanently removed.`;
      $('dlgDel').showModal();
    }
  };
  $('delNo').onclick = () => $('dlgDel').close();
  $('delYes').onclick = async () => {
    try { await api('delete', { id: delId }); await load(); } catch (e) { alert(e.message); }
    $('dlgDel').close();
  };

  $('q').oninput = render; $('cat').onchange = render;
  document.querySelector('thead').onclick = e => {
    const k = e.target.dataset && e.target.dataset.k; if (!k) return;
    if (sortK === k) sortD = -sortD; else { sortK = k; sortD = 1; }
    render();
  };

  load();
})();
