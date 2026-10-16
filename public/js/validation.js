/* Validação de nome e valor, compartilhada entre o site e o painel administrativo.
   Mantém as duas telas sempre com exatamente as mesmas regras. */
(function (global) {
  "use strict";

  const LIMITS = { MIN_VALUE: 1, MAX_VALUE: 10000, NAME_MAX: 80, MIN_YEAR: 2020, CLOCK_SKEW_MS: 60000 };
  const currencyFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const round2 = n => Math.round(n * 100) / 100;

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
    if (name.length > LIMITS.NAME_MAX) return { ok: false, msg: 'O nome pode ter no máximo ' + LIMITS.NAME_MAX + ' caracteres.' };
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
    if (value < LIMITS.MIN_VALUE) return { ok: false, msg: 'O valor mínimo é ' + currencyFmt.format(LIMITS.MIN_VALUE) + '.' };
    if (value > LIMITS.MAX_VALUE) return { ok: false, msg: 'O valor máximo é ' + currencyFmt.format(LIMITS.MAX_VALUE) + '.' };
    return { ok: true, value };
  }


  const pad2 = n => String(n).padStart(2, '0');
  /** Data no formato dd/mm/aaaa, sempre com zeros (não depende do idioma do navegador). */
  const formatDateBR = d => pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1) + '/' + d.getFullYear();

  /**
   * Validação final do REGISTRO inteiro, antes de gravar (site e painel usam a mesma).
   * Garante que nunca se grave um registro inconsistente: nome normalizado e válido, valor numérico
   * com no máximo 2 casas dentro dos limites, data real (dd/mm/aaaa) que não seja futura ou anterior
   * a 2020, e horário coerente com a data.
   */
  function validateRecord(r, nowMs) {
    const now = nowMs || Date.now();
    if (!r || typeof r !== 'object') return { ok: false, msg: 'Registro inválido.' };
    const n = validateName(r.name);
    if (typeof r.name !== 'string' || !n.ok || n.name !== r.name) return { ok: false, msg: 'Nome inválido.' };
    if (typeof r.value !== 'number' || !isFinite(r.value) || r.value < LIMITS.MIN_VALUE || r.value > LIMITS.MAX_VALUE || round2(r.value) !== r.value) {
      return { ok: false, msg: 'Valor inválido.' };
    }
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(typeof r.date === 'string' ? r.date : '');
    if (!m) return { ok: false, msg: 'Data inválida.' };
    const d = new Date(+m[3], +m[2] - 1, +m[1]);
    if (d.getFullYear() !== +m[3] || d.getMonth() !== +m[2] - 1 || d.getDate() !== +m[1] || +m[3] < LIMITS.MIN_YEAR) return { ok: false, msg: 'Data inválida.' };
    const startTomorrow = new Date(now); startTomorrow.setHours(24, 0, 0, 0);
    if (d.getTime() >= startTomorrow.getTime()) return { ok: false, msg: 'A data não pode ser no futuro.' };
    if (typeof r.timestamp !== 'number' || !isFinite(r.timestamp) || r.timestamp > now + LIMITS.CLOCK_SKEW_MS || r.timestamp < new Date(LIMITS.MIN_YEAR, 0, 1).getTime()) {
      return { ok: false, msg: 'Horário inválido.' };
    }
    const t = new Date(r.timestamp);
    if (t.getFullYear() !== d.getFullYear() || t.getMonth() !== d.getMonth() || t.getDate() !== d.getDate()) return { ok: false, msg: 'A data e o horário não conferem.' };
    return { ok: true };
  }

  global.CampanhaValidation = { LIMITS, sanitizeName, validateName, sanitizeValue, parseAmount, validateAmount, validateRecord, formatDateBR };
})(window);
