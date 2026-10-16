(function () {
  "use strict";

  const V = window.CampanhaValidation;
  const $ = id => document.getElementById(id);
  const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const pad = n => String(n).padStart(2, '0');
  const WRITE_TIMEOUT_MS = 10000;

  /* =========================================================
     FIREBASE: app separado ("admin"), para a sessão do painel
     nunca se misturar com o login anônimo do site público
  ========================================================== */
  let app = null, auth = null, db = null;
  try {
    app = firebase.initializeApp(window.FIREBASE_CONFIG, 'admin');
    auth = app.auth();
    db = app.database();
  } catch (err) {
    console.error('Firebase indisponível:', err);
  }

  let user = null;
  let records = [];
  let listRef = null;
  let busy = false;
  let statusTimer = null;

  /* =========================================================
     UTILITÁRIOS
  ========================================================== */
  function withTimeout(promise, ms) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timeout')), ms);
      promise.then(v => { clearTimeout(timer); resolve(v); }, e => { clearTimeout(timer); reject(e); });
    });
  }
  const isPermission = e => !!e && (e.code === 'PERMISSION_DENIED' || /permission[_ ]denied/i.test(String(e.message || '')));
  const money = v => fmt.format(v);

  function parseBR(str) {
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(str || '');
    return m ? new Date(+m[3], +m[2] - 1, +m[1]) : null;
  }
  const toInputDate = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const isoToBR = iso => iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4);
  const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  function showView(name) {
    ['loading', 'login', 'denied', 'panel'].forEach(v => { $('view-' + v).hidden = v !== name; });
  }

  function setStatus(text, kind) {
    const el = $('admin-status');
    clearTimeout(statusTimer);
    if (!text) { el.hidden = true; return; }
    el.textContent = text;
    el.className = 'admin-status ' + (kind === 'error' ? 'is-error' : 'is-ok');
    el.hidden = false;
    if (kind !== 'error') statusTimer = setTimeout(() => { el.hidden = true; }, 7000);
  }

  /* =========================================================
     LISTA
  ========================================================== */
  function toRecords(val) {
    return Object.entries(val || {}).map(([id, d]) => {
      d = d && typeof d === 'object' ? d : {};
      const nameOk = typeof d.name === 'string' && d.name.trim() !== '';
      const valueOk = typeof d.value === 'number' && isFinite(d.value) && d.value > 0;
      return {
        id, raw: d,
        name: nameOk ? d.name.trim() : '',
        value: d.value,
        date: typeof d.date === 'string' ? d.date : '',
        timestamp: Number(d.timestamp) || 0,
        source: d.source,
        issues: [!nameOk && 'sem nome', !valueOk && 'valor inválido'].filter(Boolean)
      };
    }).sort((a, b) => b.timestamp - a.timestamp);
  }

  function iconBtn(kind, label) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'icon-btn' + (kind === 'delete' ? ' danger' : '');
    b.dataset.action = kind;
    b.setAttribute('aria-label', label);
    b.title = label;
    b.innerHTML = kind === 'edit'
      ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3z"/><path d="M13.5 6.5l3 3"/></svg>'
      : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3"/></svg>';
    return b;
  }

  function addTag(parent, text, cls) {
    const t = document.createElement('span');
    t.className = 'tag ' + cls;
    t.textContent = text;
    parent.appendChild(t);
  }

  function render() {
    const body = $('admin-body');
    body.textContent = '';
    const valid = records.filter(r => r.issues.length === 0);
    const total = valid.reduce((s, r) => s + r.value, 0);
    const bad = records.length - valid.length;
    $('admin-count').textContent = records.length + (records.length === 1 ? ' registro' : ' registros') +
      ' · ' + money(Math.round(total * 100) / 100) + (bad ? ' · ' + bad + (bad === 1 ? ' inconsistente' : ' inconsistentes') : '');

    if (!records.length) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 4; td.className = 'table-status'; td.textContent = 'Nenhuma contribuição registrada.';
      tr.appendChild(td); body.appendChild(tr);
      return;
    }
    const frag = document.createDocumentFragment();
    records.forEach(r => {
      const tr = document.createElement('tr');
      tr.dataset.id = r.id;

      const tdDate = document.createElement('td');
      tdDate.className = 'c-date';
      tdDate.textContent = r.date || (r.timestamp ? new Date(r.timestamp).toLocaleDateString('pt-BR') : '—');

      const tdName = document.createElement('td');
      tdName.className = 'c-name';
      tdName.appendChild(document.createTextNode(r.name || '(sem nome)'));
      if (r.source === 'manual') addTag(tdName, 'manual', 'tag-manual');
      if (r.issues.length) addTag(tdName, 'inconsistente: ' + r.issues.join(', '), 'tag-warn');

      const tdValue = document.createElement('td');
      tdValue.className = 'c-value value-col' + (r.issues.includes('valor inválido') ? ' is-bad' : '');
      tdValue.textContent = r.issues.includes('valor inválido') ? (r.value === undefined ? '—' : String(r.value)) : money(r.value);

      const tdAct = document.createElement('td');
      tdAct.className = 'c-actions';
      const label = r.name || 'registro sem nome';
      tdAct.appendChild(iconBtn('edit', 'Editar contribuição de ' + label));
      tdAct.appendChild(iconBtn('delete', 'Excluir contribuição de ' + label));

      tr.append(tdDate, tdName, tdValue, tdAct);
      frag.appendChild(tr);
    });
    body.appendChild(frag);
    setActionsDisabled(busy);
  }

  function setActionsDisabled(off) {
    document.querySelectorAll('#admin-body .icon-btn').forEach(b => { b.disabled = off; });
    $('btn-new').disabled = off;
  }

  function showListError() {
    $('admin-body').textContent = '';
    const tr = document.createElement('tr'), td = document.createElement('td');
    td.colSpan = 4; td.className = 'table-status'; td.textContent = 'Não foi possível carregar as contribuições agora.';
    tr.appendChild(td); $('admin-body').appendChild(tr);
    $('admin-count').textContent = '';
    $('admin-retry').hidden = false;
  }

  function startList() {
    stopList();
    $('admin-retry').hidden = true;
    listRef = db.ref('donations').orderByChild('timestamp');
    listRef.on('value', snap => { $('admin-retry').hidden = true; records = toRecords(snap.val()); render(); }, err => { console.error(err); showListError(); });
  }
  function stopList() { if (listRef) { listRef.off(); listRef = null; } }

  /* =========================================================
     DIÁLOGOS (acessíveis: foco preso, Esc fecha, fundo inerte)
  ========================================================== */
  let openDlg = null;
  let returnFocus = null;

  function setBackgroundInert(on) {
    ['header.admin-bar', 'main'].forEach(sel => {
      const el = document.querySelector(sel);
      if (!el) return;
      if (on) { el.setAttribute('inert', ''); el.setAttribute('aria-hidden', 'true'); }
      else { el.removeAttribute('inert'); el.removeAttribute('aria-hidden'); }
    });
  }

  function openDialog(el, focusEl, from) {
    returnFocus = from || document.activeElement;
    el.hidden = false;
    document.body.classList.add('modal-open');
    setBackgroundInert(true);
    openDlg = el;
    if (focusEl) focusEl.focus();
  }

  function closeDialog(focusTarget) {
    if (!openDlg) return;
    openDlg.hidden = true;
    openDlg = null;
    document.body.classList.remove('modal-open');
    setBackgroundInert(false);
    const t = focusTarget || returnFocus;
    if (t && t.focus && document.contains(t)) t.focus(); else $('admin-title').focus();
  }

  document.addEventListener('keydown', e => {
    if (!openDlg) return;
    if (e.key === 'Escape') { if (!busy) { e.preventDefault(); closeDialog(); } return; }
    if (e.key !== 'Tab') return;
    const items = [...openDlg.querySelectorAll('button, input, [href]')].filter(x => !x.disabled && x.offsetParent !== null);
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (!items.includes(document.activeElement)) { e.preventDefault(); first.focus(); }
    else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }, true);

  /* =========================================================
     GRAVAÇÕES (cada uma é atômica e gera uma linha no histórico)
  ========================================================== */
  function logEntry(action, id, before, after) {
    const entry = { action, donationId: id, by: user.email, at: firebase.database.ServerValue.TIMESTAMP };
    if (before) entry.before = before;
    if (after) entry.after = after;
    return entry;
  }
  const clone = o => JSON.parse(JSON.stringify(o));

  async function apply(updates) {
    busy = true; setActionsDisabled(true);
    try { await withTimeout(db.ref().update(updates), WRITE_TIMEOUT_MS); }
    finally { busy = false; setActionsDisabled(false); }
  }

  /* ---------- excluir (uma por vez) ---------- */
  let deleting = null;

  function openDelete(rec, from) {
    deleting = rec;
    const box = $('del-record');
    box.textContent = '';
    const strong = document.createElement('strong');
    strong.textContent = rec.name || '(sem nome)';
    box.append(strong, document.createElement('br'),
      document.createTextNode((rec.issues.includes('valor inválido') ? (rec.value === undefined ? 'valor ausente' : 'valor "' + rec.value + '"') : money(rec.value)) +
        ' · ' + (rec.date || (rec.timestamp ? new Date(rec.timestamp).toLocaleDateString('pt-BR') : 'sem data'))));
    $('del-error').hidden = true;
    $('del-confirm').disabled = false; $('del-cancel').disabled = false;
    $('del-confirm').textContent = 'Excluir';
    openDialog($('dlg-delete'), $('del-cancel'), from);
  }

  async function confirmDelete() {
    if (!deleting || busy) return;
    const rec = deleting;
    $('del-confirm').disabled = true; $('del-cancel').disabled = true; $('del-confirm').textContent = 'Excluindo…';
    $('del-error').hidden = true;
    const logKey = db.ref('adminLog').push().key;
    const upd = {};
    upd['donations/' + rec.id] = null;
    upd['adminLog/' + logKey] = logEntry('delete', rec.id, clone(rec.raw), null);
    try {
      await apply(upd);
      deleting = null;
      closeDialog($('admin-title'));
      setStatus('Contribuição de ' + (rec.name || 'registro sem nome') + ' excluída.', 'ok');
    } catch (err) {
      console.error('Erro ao excluir:', err);
      $('del-error').textContent = isPermission(err) ? 'Sem permissão para excluir. Entre novamente.' : 'Não foi possível excluir agora. Tente novamente.';
      $('del-error').hidden = false;
      $('del-confirm').disabled = false; $('del-cancel').disabled = false; $('del-confirm').textContent = 'Excluir';
    }
  }

  /* ---------- nova / editar ---------- */
  let editing = null; // null = nova

  function setFieldError(input, errId, msg) {
    $(errId).textContent = msg || '';
    input.setAttribute('aria-invalid', msg ? 'true' : 'false');
  }
  function clearFormErrors() {
    setFieldError($('f-name'), 'f-name-error', '');
    setFieldError($('f-value'), 'f-value-error', '');
    setFieldError($('f-date'), 'f-date-error', '');
    $('form-error').hidden = true;
  }

  function openForm(rec, from) {
    editing = rec || null;
    clearFormErrors();
    $('form-title').textContent = rec ? 'Editar contribuição' : 'Nova contribuição';
    $('f-name').value = rec ? rec.name : '';
    $('f-value').value = rec && typeof rec.value === 'number' && rec.value > 0 ? rec.value.toFixed(2).replace('.', ',') : '';
    const today = new Date();
    let d = today;
    if (rec) {
      if (rec.timestamp) d = new Date(rec.timestamp);
      else if (parseBR(rec.date)) d = parseBR(rec.date);
    }
    $('f-date').max = toInputDate(today);
    $('f-date').value = toInputDate(d);
    $('form-save').disabled = false; $('form-cancel').disabled = false;
    $('form-save').textContent = 'Salvar';
    openDialog($('dlg-form'), $('f-name'), from);
  }

  async function saveForm() {
    if (busy) return;
    clearFormErrors();
    const nameRes = V.validateName($('f-name').value);
    const valueRes = V.validateAmount($('f-value').value);
    const iso = $('f-date').value;
    let dateMsg = '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) dateMsg = 'Informe a data.';
    else {
      const [y, m, dd] = iso.split('-').map(Number);
      const chosen = new Date(y, m - 1, dd);
      const today = new Date(); today.setHours(0, 0, 0, 0);
      if (y < 2020) dateMsg = 'Data inválida.';
      else if (chosen.getTime() > today.getTime()) dateMsg = 'A data não pode ser no futuro.';
    }
    if (!nameRes.ok) setFieldError($('f-name'), 'f-name-error', nameRes.msg);
    if (!valueRes.ok) setFieldError($('f-value'), 'f-value-error', valueRes.msg);
    if (dateMsg) setFieldError($('f-date'), 'f-date-error', dateMsg);
    if (!nameRes.ok) { $('f-name').focus(); return; }
    if (!valueRes.ok) { $('f-value').focus(); return; }
    if (dateMsg) { $('f-date').focus(); return; }

    // Data -> timestamp: mantém o original se o dia não mudou; hoje usa a hora atual; outros dias, meio-dia
    const [y, m, dd] = iso.split('-').map(Number);
    const chosen = new Date(y, m - 1, dd);
    const now = new Date();
    let ts;
    if (editing && editing.timestamp && sameDay(new Date(editing.timestamp), chosen)) ts = editing.timestamp;
    else if (sameDay(now, chosen)) ts = Date.now();
    else ts = new Date(y, m - 1, dd, 12, 0, 0).getTime();
    const data = { name: nameRes.name, value: valueRes.value, date: isoToBR(iso), timestamp: ts };
    const final = V.validateRecord(data);
    if (!final.ok) { $('form-error').textContent = final.msg + ' Corrija os dados e tente de novo.'; $('form-error').hidden = false; return; }

    $('form-save').disabled = true; $('form-cancel').disabled = true; $('form-save').textContent = 'Salvando…';
    const logKey = db.ref('adminLog').push().key;
    const upd = {};
    let focusAfter = $('btn-new'), message;
    if (editing) {
      const id = editing.id;
      Object.keys(data).forEach(k => { upd['donations/' + id + '/' + k] = data[k]; });
      upd['adminLog/' + logKey] = logEntry('edit', id, clone(editing.raw), Object.assign(clone(editing.raw), data));
      message = 'Contribuição de ' + data.name + ' atualizada.';
    } else {
      const id = db.ref('donations').push().key;
      upd['donations/' + id] = Object.assign({}, data, { source: 'manual' });
      upd['adminLog/' + logKey] = logEntry('create', id, null, Object.assign({}, data, { source: 'manual' }));
      message = 'Contribuição de ' + data.name + ' criada.';
    }
    try {
      await apply(upd);
      closeDialog(focusAfter);
      setStatus(message, 'ok');
    } catch (err) {
      console.error('Erro ao salvar:', err);
      $('form-error').textContent = isPermission(err) ? 'Sem permissão para salvar. Entre novamente.' : 'Não foi possível salvar agora. Tente novamente.';
      $('form-error').hidden = false;
      $('form-save').disabled = false; $('form-cancel').disabled = false; $('form-save').textContent = 'Salvar';
    }
  }

  /* =========================================================
     LOGIN
  ========================================================== */
  async function login() {
    $('login-error').textContent = '';
    if (!auth) { $('login-error').textContent = 'Serviço indisponível no momento. Tente novamente em instantes.'; return; }
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      await auth.signInWithPopup(provider);
    } catch (err) {
      let code = err && err.code;
      if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
        try { await auth.signInWithRedirect(provider); return; } catch (e2) { code = (e2 && e2.code) || code; err = e2 || err; }
      }
      console.error('Login Google falhou:', code, err && err.message);
      $('login-error').textContent = loginErrorMessage(code);
    }
  }

  // Mensagem clara para cada motivo de falha (o código do erro também vai para o console)
  function loginErrorMessage(code) {
    switch (code) {
      case 'auth/popup-closed-by-user':
      case 'auth/cancelled-popup-request':
        return 'Login cancelado.';
      case 'auth/operation-not-allowed':
        return 'O login com Google ainda não está ativado neste projeto do Firebase. Ative em Authentication → Sign-in method → Google e tente de novo.';
      case 'auth/unauthorized-domain':
        return 'Este endereço não está autorizado no Firebase. Inclua o domínio em Authentication → Settings → Authorized domains.';
      case 'auth/network-request-failed':
        return 'Sem conexão com o Firebase. Verifique a internet e tente de novo.';
      case 'auth/user-disabled':
        return 'Esta conta foi desativada no Firebase.';
      case 'auth/too-many-requests':
        return 'Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.';
      case 'auth/popup-blocked':
      case 'auth/operation-not-supported-in-this-environment':
        return 'O navegador bloqueou a janela de login. Permita pop-ups para este site ou abra o painel no Chrome/Safari.';
      case 'auth/web-storage-unsupported':
        return 'O navegador está bloqueando o armazenamento necessário para o login. Desative o modo privado ou libere os cookies deste site.';
      default:
        return 'Não foi possível entrar agora' + (code ? ' (' + code + ')' : '') + '. Tente novamente.';
    }
  }

  async function onUser(u) {
    stopList();
    records = [];
    if (!u || u.isAnonymous) {
      user = null;
      $('admin-user').hidden = true;
      showView('login');
      return;
    }
    user = u;
    $('admin-email').textContent = u.email || '';
    $('admin-user').hidden = false;
    showView('loading');
    try {
      await withTimeout(db.ref('admins').once('value'), 12000); // só administradores conseguem ler este nó
    } catch (err) {
      if (isPermission(err)) { $('denied-email').textContent = u.email || ''; showView('denied'); }
      else { console.error(err); showView('login'); $('login-error').textContent = 'Não foi possível verificar a permissão. Tente novamente.'; }
      return;
    }
    showView('panel');
    startList();
  }

  /* =========================================================
     INICIALIZAÇÃO
  ========================================================== */
  function init() {
    $('btn-login').addEventListener('click', login);
    $('btn-logout').addEventListener('click', () => auth && auth.signOut());
    $('btn-denied-logout').addEventListener('click', () => auth && auth.signOut());
    $('btn-new').addEventListener('click', e => { if (!busy) openForm(null, e.currentTarget); });
    $('admin-retry').addEventListener('click', startList);

    $('admin-body').addEventListener('click', e => {
      const btn = e.target.closest('.icon-btn');
      if (!btn || busy) return;
      const rec = records.find(r => r.id === btn.closest('tr').dataset.id);
      if (!rec) return;
      if (btn.dataset.action === 'edit') openForm(rec, btn); else openDelete(rec, btn);
    });

    $('del-cancel').addEventListener('click', () => { deleting = null; closeDialog(); });
    $('del-confirm').addEventListener('click', confirmDelete);
    $('form-cancel').addEventListener('click', () => closeDialog());
    $('admin-form').addEventListener('submit', e => { e.preventDefault(); saveForm(); });

    const live = (input, fn, errId) => input.addEventListener('input', () => {
      const before = input.value, pos = input.selectionStart, after = fn(before);
      if (after !== before) { const left = fn(before.slice(0, pos)); input.value = after; try { input.setSelectionRange(left.length, left.length); } catch (err) { /* ignora */ } }
      setFieldError(input, errId, '');
    });
    live($('f-name'), V.sanitizeName, 'f-name-error');
    live($('f-value'), V.sanitizeValue, 'f-value-error');
    $('f-date').addEventListener('input', () => setFieldError($('f-date'), 'f-date-error', ''));

    if (!auth) { showView('login'); $('login-error').textContent = 'Serviço indisponível no momento. Tente novamente em instantes.'; return; }
    auth.onAuthStateChanged(onUser);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
