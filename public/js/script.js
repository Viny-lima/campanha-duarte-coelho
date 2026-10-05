(function(){
  "use strict";

  /* =========================================================
     CONFIGURAÇÃO FIREBASE
  ========================================================== */
  firebase.initializeApp(window.FIREBASE_CONFIG);
  const database = firebase.database();
  const auth = firebase.auth();

  // Autenticação Anônima
  auth.signInAnonymously().catch(err => {
    console.error('Erro ao autenticar:', err);
  });

  const CONFIG = {
    GOAL: 55000.00,
    PIX_KEY: "00.000.000/0001-00",
    REDIRECT_URL: "https://7me.app/71/p19w9a",
    DEADLINE: new Date(2027, 0, 1) // prazo da arrecadação: 1º de janeiro de 2027
  };

  const els = {
    raised:     document.getElementById('stat-raised'),
    goal:       document.getElementById('stat-goal'),
    remaining:  document.getElementById('stat-remaining'),
    fill:       document.getElementById('progress-fill'),
    percent:    document.getElementById('progress-percent'),
    status:     document.getElementById('dash-status'),
    tbody:      document.getElementById('donors-body'),
    pixKey:     document.getElementById('pix-key'),
    copyBtn:    document.getElementById('copy-pix')
  };

  const currencyFmt = new Intl.NumberFormat('pt-BR', { style:'currency', currency:'BRL' });

  function formatBRL(value){
    return currencyFmt.format(value || 0);
  }

  /* ---------- parser de valores vindos da planilha (ex: "R$ 1.250,00") ---------- */
  function parseCurrencyValue(raw){
    if (raw === undefined || raw === null) return NaN;
    let s = String(raw).trim();
    s = s.replace(/R\$\s?/gi, '').trim();
    if (s === '') return NaN;
    // remove separador de milhar "." e troca decimal "," por "."
    if (s.indexOf(',') > -1) {
      s = s.replace(/\./g, '').replace(',', '.');
    }
    const n = parseFloat(s);
    return isNaN(n) ? NaN : n;
  }

  /* ---------- parser de CSV simples, com suporte a aspas ---------- */
  function parseCSV(text){
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++){
      const char = text[i];
      const next = text[i+1];

      if (inQuotes){
        if (char === '"' && next === '"'){ field += '"'; i++; }
        else if (char === '"'){ inQuotes = false; }
        else { field += char; }
      } else {
        if (char === '"'){ inQuotes = true; }
        else if (char === ','){ row.push(field); field = ''; }
        else if (char === '\r'){ /* ignora */ }
        else if (char === '\n'){ row.push(field); rows.push(row); row = []; field = ''; }
        else { field += char; }
      }
    }
    if (field.length > 0 || row.length > 0){ row.push(field); rows.push(row); }
    return rows.filter(r => r.length > 1 || (r.length === 1 && r[0].trim() !== ''));
  }

  /* ---------- tenta converter "DD/MM/AAAA" em Date para ordenar ---------- */
  function parseDateBR(raw){
    if (!raw) return new Date(0);
    const parts = raw.trim().split('/');
    if (parts.length === 3){
      const [d, m, y] = parts.map(p => parseInt(p, 10));
      const year = y < 100 ? 2000 + y : y;
      const dt = new Date(year, (m || 1) - 1, d || 1);
      if (!isNaN(dt.getTime())) return dt;
    }
    const fallback = new Date(raw);
    return isNaN(fallback.getTime()) ? new Date(0) : fallback;
  }

  function animateNumber(el, from, to, duration){
    const start = performance.now();
    function step(now){
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const value = from + (to - from) * eased;
      el.textContent = formatBRL(value);
      if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function updateDashboard(total){
    const goal = CONFIG.GOAL;
    const remaining = Math.max(goal - total, 0);
    const percent = Math.min(100, (total / goal) * 100);

    animateNumber(els.raised, 0, total, 900);
    els.goal.textContent = formatBRL(goal);
    els.remaining.textContent = formatBRL(remaining);

    requestAnimationFrame(() => {
      els.fill.style.width = percent.toFixed(1) + '%';
    });
    els.percent.textContent = percent.toFixed(1).replace('.0','') + '%';

    if (total >= goal){
      els.status.textContent = 'Meta alcançada! Obrigado a cada doador. 🎉';
    } else {
      els.status.textContent = 'Dados atualizados a partir da planilha da campanha.';
    }
  }


  /* ---------- Envio do formulário de doação (Firebase) ---------- */
  async function submitDonation(name, value) {
    try {
      const donationData = {
        name: name.trim(),
        value: parseCurrencyValue(value),
        date: new Date().toLocaleDateString('pt-BR'),
        timestamp: new Date().getTime()
      };

      await database.ref('donations').push(donationData);
      return { success: true };
    } catch (err) {
      console.error('Erro ao salvar doação:', err);
      return { success: false };
    }
  }

  let lastSubmitTime = 0;
  const SUBMIT_COOLDOWN = 5000;

  async function copyText(text){
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e){
      return false;
    }
  }

  function setText(id, text){
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function setupDonationForm(){
    const form = document.getElementById('donation-form');
    const errorDiv = document.getElementById('form-error');
    const modal = document.getElementById('donation-modal');
    const modalDonorName = document.getElementById('modal-donor-name');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorDiv.textContent = '';
      const now = Date.now();
      if (now - lastSubmitTime < SUBMIT_COOLDOWN) {
        const waitTime = Math.ceil((SUBMIT_COOLDOWN - (now - lastSubmitTime)) / 1000);
        errorDiv.textContent = `Aguarde ${waitTime}s antes de enviar novamente`;
        return;
      }
      const name = document.getElementById('donor-name').value.trim();
      const value = document.getElementById('donor-value').value.trim();
      if (!name || !value) {
        errorDiv.textContent = 'Preencha nome e valor';
        return;
      }
      if (isNaN(parseCurrencyValue(value))) {
        errorDiv.textContent = 'Valor inválido';
        return;
      }
      const amount = parseCurrencyValue(value);
      const amountText = amount.toFixed(2).replace('.', ',');
      lastSubmitTime = now;
      const submitBtn = form.querySelector('[type="submit"]');
      submitBtn.disabled = true;
      try {
        // Copia o valor ainda dentro do gesto do usuário; nunca deve travar o envio
        const copied = await Promise.race([
          copyText(amountText),
          new Promise(resolve => setTimeout(() => resolve(false), 1500))
        ]);

        const result = await submitDonation(name, value);
        if (!result.success) {
          errorDiv.textContent = 'Não foi possível registrar agora. Tente novamente.';
          submitBtn.disabled = false;
          return;
        }

        if (modalDonorName) modalDonorName.textContent = name;
        setText('modal-amount-value', formatBRL(amount));
        setText('modal-copy-status', copied ? 'Valor copiado: ' + amountText : '');
        const goBtn = document.getElementById('modal-go');
        const copyBtn = document.getElementById('modal-copy');
        if (copyBtn) copyBtn.onclick = async () => {
          const ok = await copyText(amountText);
          setText('modal-copy-status', ok ? 'Valor copiado: ' + amountText : 'Anote o valor: ' + amountText);
        };
        modal.style.display = 'flex';
        if (goBtn) {
          goBtn.href = CONFIG.REDIRECT_URL;
          goBtn.focus();
        } else {
          // Segurança: se a página estiver com HTML antigo, segue o fluxo anterior
          setTimeout(() => { window.location.href = CONFIG.REDIRECT_URL; }, 5000);
        }
      } catch (err) {
        console.error('Erro no envio:', err);
        errorDiv.textContent = 'Algo deu errado. Tente novamente.';
        submitBtn.disabled = false;
      }
    });
  }


  function renderDonors(donations){
    if (donations.length === 0){
      els.tbody.innerHTML = '<tr><td colspan="3" class="table-status">Ainda não há doações registradas. Seja o primeiro a contribuir!</td></tr>';
      return;
    }

    const sorted = donations.slice().sort((a, b) => b.dateObj - a.dateObj);

    els.tbody.innerHTML = sorted.map(d => `
      <tr>
        <td>${escapeHTML(d.date)}</td>
        <td>${escapeHTML(d.name)}</td>
        <td class="value-col">${formatBRL(d.value)}</td>
      </tr>
    `).join('');
  }

  function escapeHTML(str){
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function loadCampaignData(){
    try {
      database.ref('donations').orderByChild('timestamp').once('value', snapshot => {
        const data = snapshot.val();

        if (!data) {
          els.tbody.innerHTML = '<tr><td colspan="3" class="table-status">Ainda não há doações registradas. Seja o primeiro a contribuir!</td></tr>';
          updateDashboard(0);
          return;
        }

        const donations = Object.values(data)
          .filter(d => d.name && !isNaN(d.value) && d.value > 0)
          .map(d => ({
            date: d.date || new Date().toLocaleDateString('pt-BR'),
            name: d.name,
            value: d.value,
            dateObj: parseDateBR(d.date || '')
          }))
          .sort((a, b) => b.dateObj - a.dateObj);

        const total = donations.reduce((sum, d) => sum + d.value, 0);

        renderDonors(donations);
        updateDashboard(total);
      }, err => {
        console.error('Erro ao carregar dados:', err);
        els.status.textContent = 'Não foi possível carregar os dados agora. Tente novamente em instantes.';
        els.tbody.innerHTML = '<tr><td colspan="3" class="table-status">Não foi possível carregar a lista de doações no momento.</td></tr>';
        updateDashboard(0);
      });
    } catch (err){
      console.error('Erro ao carregar dados da campanha:', err);
      updateDashboard(0);
    }
  }

  /* ---------- valores sugeridos ---------- */
  function setupChips(){
    const input = document.getElementById('donor-value');
    const chips = document.querySelectorAll('.chip');
    if (!input || !chips.length) return;
    function sync(){
      const cur = parseCurrencyValue(input.value);
      chips.forEach(ch => ch.setAttribute('aria-pressed', String(Number(ch.dataset.value) === cur)));
    }
    chips.forEach(ch => ch.addEventListener('click', () => {
      input.value = Number(ch.dataset.value).toFixed(2).replace('.', ',');
      sync();
    }));
    input.addEventListener('input', sync);
  }

  /* ---------- botão fixo "Quero contribuir" (celular) ---------- */
  function setupStickyCta(){
    const cta = document.getElementById('sticky-cta');
    const hero = document.querySelector('.hero');
    const pix = document.getElementById('pix');
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

  /* ---------- contagem regressiva do prazo ---------- */
  function updateDeadline(){
    const box = document.getElementById('deadline');
    const count = document.getElementById('deadline-count');
    const text = document.getElementById('deadline-text');
    if (!box || !count || !text) return;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const days = Math.round((CONFIG.DEADLINE - today) / 86400000);
    if (days > 1){
      count.textContent = 'Faltam ' + days + ' dias';
      text.textContent = 'até 1º de janeiro de ' + CONFIG.DEADLINE.getFullYear();
    } else if (days === 1){
      count.textContent = 'Falta 1 dia';
      text.textContent = 'para o fim. Contribua hoje!';
    } else {
      count.textContent = 'Arrecadação encerrada';
      text.textContent = 'Obrigado a todos que ajudaram!';
    }
    box.classList.toggle('is-urgent', days <= 7);
    box.hidden = false;
  }

  function setupCopyButton(){
    if (!els.copyBtn || !els.pixKey) return;
    els.pixKey.textContent = CONFIG.PIX_KEY;
    els.copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(CONFIG.PIX_KEY);
        els.copyBtn.textContent = 'Copiado!';
        els.copyBtn.setAttribute('data-copied', 'true');
        setTimeout(() => {
          els.copyBtn.textContent = 'Copiar';
          els.copyBtn.removeAttribute('data-copied');
        }, 2000);
      } catch (e){
        els.copyBtn.textContent = 'Selecione e copie';
      }
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    setupCopyButton();
    setupDonationForm();
    setupChips();
    updateDeadline();
    setInterval(updateDeadline, 60 * 60 * 1000);
    setupStickyCta();
    loadCampaignData();
    // Atualiza os dados a cada 5 minutos, sem precisar recarregar a página
    setInterval(loadCampaignData, 5 * 60 * 1000);
  });
})();
