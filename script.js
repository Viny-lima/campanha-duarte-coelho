(function(){
  "use strict";

  /* =========================================================
     CONFIGURAÇÃO FIREBASE
  ========================================================== */
  const firebaseConfig = {
    apiKey: "AIzaSyCgbivlizIsbfIsexUsn2neb3XsAnjhTAE",
    authDomain: "campanha-duarte-coelho.firebaseapp.com",
    databaseURL: "https://campanha-duarte-coelho-default-rtdb.firebaseio.com",
    projectId: "campanha-duarte-coelho",
    storageBucket: "campanha-duarte-coelho.firebasestorage.app",
    messagingSenderId: "949439292528",
    appId: "1:949439292528:web:593c180939293e022f80b5",
    measurementId: "G-5QS719G65Z"
  };

  firebase.initializeApp(firebaseConfig);
  const database = firebase.database();
  const auth = firebase.auth();

  // Autenticação Anônima
  auth.signInAnonymously().catch(err => {
    console.error('Erro ao autenticar:', err);
  });

  const CONFIG = {
    GOAL: 55000.00,
    PIX_KEY: "00.000.000/0001-00",
    REDIRECT_URL: "https://7me.app/71/p19w9a"
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
      return { success: true };
    }
  }

  let lastSubmitTime = 0;
  const SUBMIT_COOLDOWN = 5000;

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
      form.querySelector('[type="submit"]').disabled = true;
      lastSubmitTime = now;
      await submitDonation(name, value);
      modal.style.display = 'flex';
      modalDonorName.textContent = name;
      setTimeout(() => {
        window.location.href = CONFIG.REDIRECT_URL;
      }, 5000);
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
    loadCampaignData();
    // Atualiza os dados a cada 5 minutos, sem precisar recarregar a página
    setInterval(loadCampaignData, 5 * 60 * 1000);
  });
})();
