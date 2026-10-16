(function () {
  "use strict";

  const CONFIG = {
    GOAL: 55000.00,
    REDIRECT_URL: "https://7me.app/71/p19w9a",
    MIN_VALUE: 1,
    MAX_VALUE: 10000,
    NAME_MAX: 80,
    REFRESH_MS: 5 * 60 * 1000,
    LOAD_TIMEOUT_MS: 10000,
    AUTH_TIMEOUT_MS: 8000,
    WRITE_TIMEOUT_MS: 8000
  };

  /* =========================================================
     FIREBASE (protegido: se o SDK não carregar, o resto do site continua)
  ========================================================== */
  let db = null;
  let auth = null;
  let authPromise = Promise.resolve(null);
  try {
    firebase.initializeApp(window.FIREBASE_CONFIG);
    db = firebase.database();
    auth = firebase.auth();
    authPromise = auth.signInAnonymously().catch(err => {
      console.error('Erro ao autenticar:', err);
      return null;
    });
  } catch (err) {
    console.error('Firebase indisponível:', err);
  }

  /* =========================================================
     UTILITÁRIOS
  ========================================================== */
  const $ = id => document.getElementById(id);
  const currencyFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const formatBRL = value => currencyFmt.format(value || 0);
  const round2 = n => Math.round(n * 100) / 100;
  const prefersReducedMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function withTimeout(promise, ms) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timeout')), ms);
      promise.then(
        value => { clearTimeout(timer); resolve(value); },
        error => { clearTimeout(timer); reject(error); }
      );
    });
  }

  /* =========================================================
     VALIDAÇÃO: NOME E VALOR
  ========================================================== */
  // Nome: só letras (com acentos), espaço, apóstrofo, ponto e hífen
  const NAME_FORBIDDEN = /[^\p{L}\p{M}'’.\- ]/gu;
  const NAME_FORMAT = /^\p{L}[\p{L}\p{M}'’.\- ]*$/u;

  function sanitizeName(raw) {
    return raw.replace(NAME_FORBIDDEN, '').replace(/ {2,}/g, ' ').replace(/^[ .\-'’]+/, '');
  }

  function validateName(raw) {
    const name = String(raw || '').replace(/\s+/g, ' ').trim();
    if (!name) return { ok: false, msg: 'Informe seu nome.' };
    const letters = (name.match(/\p{L}/gu) || []).length;
    if (!NAME_FORMAT.test(name) || letters < 2) return { ok: false, msg: 'Digite seu nome usando apenas letras (mínimo 2).' };
    if (name.length > CONFIG.NAME_MAX) return { ok: false, msg: 'O nome pode ter no máximo ' + CONFIG.NAME_MAX + ' caracteres.' };
    return { ok: true, name };
  }

  // Valor: só dígitos, ponto e vírgula
  const sanitizeValue = raw => raw.replace(/[^\d.,]/g, '');

  /**
   * Formatos aceitos (pt-BR):  50 · 50,5 · 50,50 · 50.50 · 1.250 · 1.250,50
   * "1.250" é milhar (R$ 1.250); "1.25" é decimal (R$ 1,25). Qualquer outro formato é inválido.
   */
  function parseAmount(raw) {
    const s = String(raw || '').trim();
    let m;
    if (/^\d+$/.test(s)) return Number(s);
    if ((m = s.match(/^(\d{1,3}(?:\.\d{3})+)(?:,(\d{1,2}))?$/))) return Number(m[1].replace(/\./g, '') + '.' + (m[2] || '0'));
    if ((m = s.match(/^(\d+),(\d{1,2})$/))) return Number(m[1] + '.' + m[2]);
    if ((m = s.match(/^(\d+)\.(\d{1,2})$/))) return Number(m[1] + '.' + m[2]);
    return NaN;
  }

  function validateAmount(raw) {
    const s = String(raw || '').trim();
    if (!s) return { ok: false, msg: 'Informe o valor.' };
    const n = parseAmount(s);
    if (isNaN(n)) return { ok: false, msg: 'Valor inválido. Use o formato 50 ou 50,00.' };
    const value = round2(n);
    if (value < CONFIG.MIN_VALUE) return { ok: false, msg: 'O valor mínimo é ' + formatBRL(CONFIG.MIN_VALUE) + '.' };
    if (value > CONFIG.MAX_VALUE) return { ok: false, msg: 'O valor máximo é ' + formatBRL(CONFIG.MAX_VALUE) + '.' };
    return { ok: true, value };
  }

  /* =========================================================
     PAINEL DE PROGRESSO
  ========================================================== */
  const els = {
    raised: $('stat-raised'), goal: $('stat-goal'), remaining: $('stat-remaining'),
    fill: $('progress-fill'), track: $('progress-track'), percent: $('progress-percent'),
    status: $('dash-status'), retry: $('retry-load'), tbody: $('donors-body')
  };

  let renderedTotal = 0;
  let animationId = 0;
  let loadedOnce = false;
  let loadTimer = null;

  function animateNumber(el, from, to, duration) {
    const id = ++animationId;
    if (prefersReducedMotion() || from === to) { el.textContent = formatBRL(to); return; }
    const start = performance.now();
    function step(now) {
      if (id !== animationId) return;
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = formatBRL(from + (to - from) * eased);
      if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function percentText(percent) {
    const t = percent.toFixed(1).replace('.', ',');
    return (t.endsWith(',0') ? t.slice(0, -2) : t) + '%';
  }

  function setStatus(text, isError) {
    els.status.textContent = text;
    els.status.classList.toggle('is-error', !!isError);
    els.retry.hidden = !isError;
  }

  function updateDashboard(total) {
    const goal = CONFIG.GOAL;
    const remaining = Math.max(goal - total, 0);
    const percent = Math.min(100, (total / goal) * 100);

    animateNumber(els.raised, renderedTotal, total, 900);
    renderedTotal = total;
    els.goal.textContent = formatBRL(goal);
    els.remaining.textContent = formatBRL(remaining);
    els.fill.style.width = percent.toFixed(1) + '%';
    els.percent.textContent = percentText(percent);
    els.track.setAttribute('aria-valuenow', String(Math.round(percent)));

    setStatus(total >= goal
      ? 'Meta alcançada! Obrigado a cada padrinho. 🎉'
      : 'Atualizado automaticamente a cada 5 minutos.', false);
  }

  function emptyRow(message) {
    els.tbody.textContent = '';
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 3;
    td.className = 'table-status';
    td.textContent = message;
    tr.appendChild(td);
    els.tbody.appendChild(tr);
  }

  function renderDonors(list) {
    if (!list.length) {
      emptyRow('Ainda não há padrinhos registrados. Seja o primeiro a contribuir!');
      return;
    }
    const frag = document.createDocumentFragment();
    list.forEach(d => {
      const tr = document.createElement('tr');
      const cells = [d.date, d.name, formatBRL(d.value)];
      cells.forEach((text, i) => {
        const td = document.createElement('td');
        if (i === 2) td.className = 'value-col';
        td.textContent = text;
        tr.appendChild(td);
      });
      frag.appendChild(tr);
    });
    els.tbody.textContent = '';
    els.tbody.appendChild(frag);
  }

  function renderCampaign(data) {
    const list = Object.values(data || {})
      .filter(d => d && typeof d.name === 'string' && d.name.trim() && typeof d.value === 'number' && isFinite(d.value) && d.value > 0)
      .map(d => {
        const ts = Number(d.timestamp) || 0;
        return {
          name: d.name.trim(),
          value: d.value,
          ts,
          date: d.date || (ts ? new Date(ts).toLocaleDateString('pt-BR') : '')
        };
      })
      .sort((a, b) => b.ts - a.ts);

    const total = round2(list.reduce((sum, d) => sum + d.value, 0));
    loadedOnce = true;
    renderDonors(list);
    updateDashboard(total);
  }

  function showLoadError() {
    if (loadedOnce) return; // em atualizações periódicas, mantém os últimos dados bons
    setStatus('Não foi possível carregar os dados agora.', true);
    els.raised.textContent = '—';
    els.remaining.textContent = '—';
    els.percent.textContent = '—';
    els.fill.style.width = '0%';
    emptyRow('Não foi possível carregar a lista de padrinhos no momento.');
  }

  function loadCampaignData() {
    if (!db) { showLoadError(); return; }
    clearTimeout(loadTimer);
    loadTimer = setTimeout(showLoadError, CONFIG.LOAD_TIMEOUT_MS);
    db.ref('donations').orderByChild('timestamp').once('value')
      .then(snapshot => {
        clearTimeout(loadTimer);
        renderCampaign(snapshot.val());
      })
      .catch(err => {
        clearTimeout(loadTimer);
        console.error('Erro ao carregar dados:', err);
        showLoadError();
      });
  }

  /* =========================================================
     REGISTRO DA CONTRIBUIÇÃO (só ao tocar em "Concluir pagamento")
  ========================================================== */
  async function ensureAuth() {
    if (!auth) throw new Error('auth-unavailable');
    if (auth.currentUser) return;
    await withTimeout(authPromise, CONFIG.AUTH_TIMEOUT_MS).catch(() => null);
    if (!auth.currentUser) await withTimeout(auth.signInAnonymously(), CONFIG.AUTH_TIMEOUT_MS);
  }

  async function registerDonation(pending) {
    await ensureAuth();
    const data = {
      name: pending.name,
      value: pending.value,
      date: new Date().toLocaleDateString('pt-BR'),
      timestamp: Date.now()
    };
    try {
      await withTimeout(pending.ref.set(data), CONFIG.WRITE_TIMEOUT_MS);
    } catch (err) {
      // A resposta pode ter demorado, mas o registro pode já existir (mesma chave): confere antes de falhar
      const snap = await withTimeout(pending.ref.once('value'), 5000).catch(() => null);
      if (!(snap && snap.exists())) throw err;
    }
  }

  /* =========================================================
     MODAL TRAVADO
     Só é "fechado" ao tocar em "Concluir pagamento", que leva ao 7me.
  ========================================================== */
  const modal = $('donation-modal');
  const goBtn = $('modal-go');
  const editBtn = $('modal-edit');
  const modalError = $('modal-error');
  const BACKGROUND = ['header.hero', 'main', 'footer', '#sticky-cta'];
  let modalOpen = false;
  let leaving = false;
  let busy = false;
  let pending = null;
  let lastFocus = null;

  function setBackgroundInert(on) {
    BACKGROUND.forEach(sel => {
      const el = document.querySelector(sel);
      if (!el) return;
      if (on) { el.setAttribute('inert', ''); el.setAttribute('aria-hidden', 'true'); }
      else { el.removeAttribute('inert'); el.removeAttribute('aria-hidden'); }
    });
  }

  function resetGoButton() {
    editBtn.disabled = false;
    goBtn.disabled = false;
    goBtn.textContent = 'Concluir pagamento';
    goBtn.removeAttribute('aria-busy');
  }

  function openModal(donation) {
    pending = donation;
    leaving = false;
    busy = false;
    lastFocus = document.activeElement;
    $('modal-donor-name').textContent = donation.name;
    $('modal-amount-value').textContent = formatBRL(donation.value);
    modalError.hidden = true;
    resetGoButton();
    modal.hidden = false;
    document.body.classList.add('modal-open');
    setBackgroundInert(true);
    modalOpen = true;
    goBtn.focus();
  }

  function closeModal() {
    modal.hidden = true;
    document.body.classList.remove('modal-open');
    setBackgroundInert(false);
    modalOpen = false;
    pending = null;
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) { /* ignora */ } }
  }

  // Impede Esc e fuga do foco: Tab alterna só entre os botões do modal
  document.addEventListener('keydown', e => {
    if (!modalOpen) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); return; }
    if (e.key !== 'Tab') return;
    e.preventDefault();
    const items = [goBtn, editBtn].filter(b => !b.disabled);
    if (!items.length) return;
    const i = items.indexOf(document.activeElement);
    const next = i === -1 ? 0 : (i + (e.shiftKey ? items.length - 1 : 1)) % items.length;
    items[next].focus();
  }, true);

  // Avisa se tentarem recarregar/fechar a aba antes de concluir o pagamento
  window.addEventListener('beforeunload', e => {
    if (modalOpen && !leaving) { e.preventDefault(); e.returnValue = ''; }
  });

  goBtn.addEventListener('click', async () => {
    if (!pending || busy) return;
    busy = true;
    goBtn.disabled = true;
    editBtn.disabled = true;
    goBtn.textContent = 'Registrando…';
    goBtn.setAttribute('aria-busy', 'true');
    modalError.hidden = true;
    try {
      await registerDonation(pending);
      leaving = true;
      goBtn.textContent = 'Abrindo o 7me…';
      window.location.assign(CONFIG.REDIRECT_URL);
      // Segurança: se o navegador não abriu o 7me, permite tentar de novo (o registro é idempotente)
      setTimeout(() => {
        if (modalOpen) { busy = false; resetGoButton(); goBtn.textContent = 'Abrir o 7me novamente'; }
      }, 6000);
    } catch (err) {
      console.error('Erro ao registrar contribuição:', err);
      modalError.textContent = 'Não conseguimos registrar sua contribuição agora. Verifique sua conexão e tente novamente.';
      modalError.hidden = false;
      busy = false;
      resetGoButton();
      goBtn.focus();
    }
  });

  // "Editar informações": volta ao formulário com nome e valor preenchidos (nada foi gravado ainda)
  editBtn.addEventListener('click', () => {
    if (busy || leaving) return;
    closeModal();
    nameInput.focus();
  });

  /* =========================================================
     FORMULÁRIO
  ========================================================== */
  const form = $('donation-form');
  const nameInput = $('donor-name');
  const valueInput = $('donor-value');
  const formError = $('form-error');

  function setFieldError(input, errorEl, msg) {
    errorEl.textContent = msg || '';
    input.setAttribute('aria-invalid', msg ? 'true' : 'false');
  }

  function clearErrors() {
    setFieldError(nameInput, $('name-error'), '');
    setFieldError(valueInput, $('value-error'), '');
    formError.textContent = '';
  }

  // Filtra os caracteres enquanto digita/cola, preservando a posição do cursor
  function liveFilter(input, filterFn) {
    input.addEventListener('input', e => {
      if (e.isComposing) return;
      const before = input.value;
      const pos = input.selectionStart;
      const after = filterFn(before);
      if (after !== before) {
        const left = filterFn(before.slice(0, pos));
        input.value = after;
        try { input.setSelectionRange(left.length, left.length); } catch (err) { /* ignora */ }
      }
    });
    input.addEventListener('compositionend', () => { input.value = filterFn(input.value); });
  }

  function setupForm() {
    if (!form) return;
    liveFilter(nameInput, sanitizeName);
    liveFilter(valueInput, sanitizeValue);
    nameInput.addEventListener('input', () => setFieldError(nameInput, $('name-error'), ''));
    valueInput.addEventListener('input', () => { setFieldError(valueInput, $('value-error'), ''); syncChips(); });

    form.addEventListener('submit', e => {
      e.preventDefault();
      clearErrors();
      const nameRes = validateName(nameInput.value);
      const valueRes = validateAmount(valueInput.value);
      if (!nameRes.ok) setFieldError(nameInput, $('name-error'), nameRes.msg);
      if (!valueRes.ok) setFieldError(valueInput, $('value-error'), valueRes.msg);
      if (!nameRes.ok) { nameInput.focus(); return; }
      if (!valueRes.ok) { valueInput.focus(); return; }

      if (!db) {
        formError.textContent = 'O registro de contribuições está indisponível no momento. Tente novamente em instantes.';
        return;
      }
      let ref;
      try { ref = db.ref('donations').push(); }
      catch (err) {
        console.error(err);
        formError.textContent = 'Algo deu errado. Tente novamente.';
        return;
      }
      openModal({ name: nameRes.name, value: valueRes.value, ref });
    });
  }

  /* ---------- valores sugeridos ---------- */
  const chips = document.querySelectorAll('.chip');
  function syncChips() {
    const cur = parseAmount(valueInput ? valueInput.value : '');
    chips.forEach(ch => ch.setAttribute('aria-pressed', String(Number(ch.dataset.value) === cur)));
  }
  function setupChips() {
    if (!valueInput || !chips.length) return;
    chips.forEach(ch => ch.addEventListener('click', () => {
      valueInput.value = Number(ch.dataset.value).toFixed(2).replace('.', ',');
      setFieldError(valueInput, $('value-error'), '');
      syncChips();
    }));
  }

  /* ---------- botão fixo "Quero contribuir" (celular) ---------- */
  function setupStickyCta() {
    const cta = $('sticky-cta');
    const hero = document.querySelector('.hero');
    const pix = $('pix');
    const footer = document.querySelector('footer');
    if (!cta || !hero || !pix || !footer || !('IntersectionObserver' in window)) return;
    const visible = new Set();
    const update = () => cta.classList.toggle('is-away', visible.size > 0);
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => e.isIntersecting ? visible.add(e.target) : visible.delete(e.target));
      update();
    }, { threshold: 0.15 });
    io.observe(hero);
    io.observe(pix);
    io.observe(footer);
    cta.hidden = false;
    update();
  }

  /* ---------- voltar do 7me (página restaurada do cache) ---------- */
  window.addEventListener('pageshow', e => {
    if (!e.persisted) return;
    leaving = false;
    if (modalOpen) closeModal();
    if (form) form.reset();
    clearErrors();
    syncChips();
    loadCampaignData();
  });

  /* =========================================================
     INICIALIZAÇÃO
  ========================================================== */
  function init() {
    setupForm();
    setupChips();
    setupStickyCta();
    if (els.retry) els.retry.addEventListener('click', () => {
      setStatus('Carregando dados da campanha…', false);
      loadCampaignData();
    });
    loadCampaignData();
    // Atualiza os dados a cada 5 minutos, sem precisar recarregar a página
    setInterval(loadCampaignData, CONFIG.REFRESH_MS);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
