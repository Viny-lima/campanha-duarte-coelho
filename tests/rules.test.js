// Testes das regras de segurança do Realtime Database (database.rules.json), no emulador do Firebase.
// Nada aqui toca a produção. Como rodar:  node scripts/test-rules.js   (precisa de Java e do firebase-tools)
//
// Cada teste usa um "usuário" com um token sem assinatura (aceito só pelo emulador):
//   anônimo (visitante do site) · administrador (conta do clube, e-mail verificado) · outros casos de e-mail.
const hostEnv = process.env.FIREBASE_DATABASE_EMULATOR_HOST || '127.0.0.1:9100';
const PROJECT = process.env.GCLOUD_PROJECT || 'demo-campanha';
const BASE = 'http://' + hostEnv, NS = PROJECT + '-default-rtdb';
const ADMIN_EMAIL = 'cdduartecoelho26@gmail.com';

const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = c => b64({ alg: 'none', typ: 'JWT' }) + '.' + b64(Object.assign({ iat: Math.floor(Date.now() / 1000) - 5, exp: Math.floor(Date.now() / 1000) + 3600 }, c)) + '.';
const google = (email, verified = true) => jwt({ user_id: 'u-' + email, sub: 'u-' + email, email, email_verified: verified, firebase: { identities: { 'google.com': ['1'] }, sign_in_provider: 'google.com' } });
const TOK = {
  anon: jwt({ user_id: 'anon1', sub: 'anon1', provider_id: 'anonymous', firebase: { identities: {}, sign_in_provider: 'anonymous' } }),
  admin: google(ADMIN_EMAIL), adminUpper: google('CdDuarteCoelho26@Gmail.com'), adminNaoVerificado: google(ADMIN_EMAIL, false),
  intruso: google('intruso@gmail.com'), novoAdmin: google('novo.admin@gmail.com'), novoAdminNaoVerificado: google('novo.admin@gmail.com', false),
  semLogin: null,
};

async function call(method, path, body, tok) {
  const u = new URL(BASE + path + '.json'); u.searchParams.set('ns', NS);
  const headers = { 'Content-Type': 'application/json' };
  if (tok === 'owner') headers.Authorization = 'Bearer owner'; else if (tok) u.searchParams.set('auth', tok);
  const r = await fetch(u, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch (e) { }
  return { ok: r.ok, status: r.status, json };
}
const owner = (m, p, b) => call(m, p, b, 'owner');
const pad = n => String(n).padStart(2, '0');
const hoje = () => { const d = new Date(); return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear(); };
const bs = String.fromCharCode(92);
const don = (over = {}) => Object.assign({ name: 'Luciene', value: 50, date: hoje(), timestamp: Date.now() }, over);
const without = (o, k) => { const c = Object.assign({}, o); delete c[k]; return c; };

let n = 0, falhas = [];
async function expectOk(label, p) { n++; const r = await p; if (!r.ok) { falhas.push('DEVIA PERMITIR: ' + label + ' -> ' + r.status); console.log('[FALHOU] devia permitir: ' + label); } else console.log('[ok] permite: ' + label); }
async function expectDeny(label, p) { n++; const r = await p; if (r.ok) { falhas.push('DEVIA NEGAR: ' + label); console.log('[FALHOU] devia negar: ' + label); } else console.log('[ok] nega:    ' + label); }

(async () => {
  await owner('DELETE', '/'); await owner('PUT', '/admins', { 'novo,admin@gmail,com': true });
  let id = 0; const nid = () => '-t' + (++id);

  // ---------- visitante do site (usuário anônimo): criar contribuição ----------
  await expectOk('anônimo cria contribuição válida (nome "Luciene", R$ 50)', call('PUT', '/donations/' + nid(), don(), TOK.anon));
  for (const [label, d] of [
    ['nome "Jo" (2 letras)', don({ name: 'Jo' })], ['nome com 80 caracteres', don({ name: 'A'.repeat(80) })], ["nome com acento, apóstrofo, hífen e ponto", don({ name: "D'Ávila-Silva Jr." })],
    ['nome "Zoë Ñandú"', don({ name: 'Zoë Ñandú' })], ['valor mínimo R$ 1', don({ value: 1 })], ['valor máximo R$ 10.000', don({ value: 10000 })], ['valor com centavos 75,5', don({ value: 75.5 })],
    ['data 31/12/2029', don({ date: '31/12/2029' })],
  ]) await expectOk('anônimo cria: ' + label, call('PUT', '/donations/' + nid(), d, TOK.anon));

  for (const [label, d] of [
    ['nome com 1 letra', don({ name: 'A' })], ['nome com 81 caracteres', don({ name: 'A'.repeat(81) })], ['nome vazio', don({ name: '' })], ['nome numérico', don({ name: 123 })], ['nome com <', don({ name: 'Ana <b>' })],
    ['nome com >', don({ name: 'a>b' })], ['nome com &', don({ name: 'A&B' })], ['nome com aspas', don({ name: 'a"b' })], ['nome com {', don({ name: '{x}' })], ['nome com [', don({ name: 'x[1]' })],
    ['nome com /', don({ name: 'a/b' })], ['nome com barra invertida', don({ name: 'a' + bs + 'b' })],
    ['valor 0,99', don({ value: 0.99 })], ['valor 0', don({ value: 0 })], ['valor negativo', don({ value: -5 })], ['valor 10000,01', don({ value: 10000.01 })], ['valor em texto', don({ value: '50' })],
    ['data sem zeros', don({ date: '5/10/2026' })], ['data ISO', don({ date: '2026-10-05' })], ['data anterior a 2020', don({ date: '05/10/2019' })], ['data no ano 2100', don({ date: '05/10/2100' })], ['data numérica', don({ date: 20261005 })],
    ['horário 0', don({ timestamp: 0 })], ['horário no futuro (+1 dia)', don({ timestamp: Date.now() + 86400000 })], ['horário anterior a 2020', don({ timestamp: 1500000000000 })], ['horário em texto', don({ timestamp: 'x' })],
    ['sem o campo nome', without(don(), 'name')], ['sem o campo valor', without(don(), 'value')], ['sem o campo data', without(don(), 'date')], ['sem o campo horário', without(don(), 'timestamp')],
    ['campo extra não previsto', don({ extra: 1 })], ['campo "source" (reservado ao administrador)', don({ source: 'manual' })],
  ]) await expectDeny('anônimo tenta criar: ' + label, call('PUT', '/donations/' + nid(), d, TOK.anon));
  await expectDeny('sem login nenhum tenta criar', call('PUT', '/donations/' + nid(), don(), TOK.semLogin));

  // ---------- visitante NÃO altera nem apaga ----------
  await owner('PUT', '/donations/-existente', don({ name: 'Maria Silva' }));
  await expectDeny('anônimo sobrescreve contribuição existente', call('PUT', '/donations/-existente', don({ name: 'Outro Nome' }), TOK.anon));
  await expectDeny('anônimo altera só o valor de uma existente', call('PUT', '/donations/-existente/value', 9999, TOK.anon));
  await expectDeny('anônimo apaga contribuição', call('DELETE', '/donations/-existente', undefined, TOK.anon));
  await expectDeny('anônimo apaga TODAS as contribuições', call('DELETE', '/donations', undefined, TOK.anon));
  await expectDeny('anônimo apaga o banco inteiro', call('DELETE', '/', undefined, TOK.anon));

  // ---------- leitura ----------
  await expectOk('qualquer pessoa (sem login) LÊ a lista pública', call('GET', '/donations', undefined, TOK.semLogin));
  await expectDeny('sem login lê a raiz do banco', call('GET', '/', undefined, TOK.semLogin));
  await expectDeny('anônimo lê "admins"', call('GET', '/admins', undefined, TOK.anon));
  await expectDeny('anônimo lê o histórico "adminLog"', call('GET', '/adminLog', undefined, TOK.anon));
  await expectDeny('anônimo escreve em "admins" (se tornar administrador)', call('PUT', '/admins/anon1', true, TOK.anon));
  await expectDeny('anônimo escreve no histórico', call('PUT', '/adminLog/-x', { action: 'delete', donationId: '-a', by: 'x', at: Date.now() }, TOK.anon));

  // ---------- administrador ----------
  const log = (action, extra = {}) => Object.assign({ action, donationId: '-existente', by: ADMIN_EMAIL, at: { '.sv': 'timestamp' } }, extra);
  await expectOk('administrador LÊ "admins"', call('GET', '/admins', undefined, TOK.admin));
  await expectOk('administrador LÊ o histórico', call('GET', '/adminLog', undefined, TOK.admin));
  await expectOk('administrador edita o nome de uma contribuição', call('PUT', '/donations/-existente/name', 'Maria Silva Souza', TOK.admin));
  await expectOk('administrador edita o valor de uma contribuição', call('PUT', '/donations/-existente/value', 75, TOK.admin));
  await expectDeny('administrador NÃO consegue deixar valor inconsistente (0)', call('PUT', '/donations/-existente/value', 0, TOK.admin));
  await expectDeny('administrador NÃO consegue deixar nome inconsistente (1 letra)', call('PUT', '/donations/-existente/name', 'A', TOK.admin));
  await expectDeny('administrador NÃO consegue gravar data inconsistente', call('PUT', '/donations/-existente/date', '5/10/2026', TOK.admin));
  await expectOk('administrador cria contribuição MANUAL (source="manual")', call('PUT', '/donations/-manual1', don({ name: 'João Pedro', source: 'manual' }), TOK.admin));
  await expectDeny('administrador usa source diferente de "manual"', call('PUT', '/donations/-manual2', don({ source: 'outro' }), TOK.admin));
  await expectDeny('administrador cria contribuição inconsistente (valor 0,5)', call('PUT', '/donations/-manual3', don({ value: 0.5, source: 'manual' }), TOK.admin));
  await expectOk('administrador (e-mail com maiúsculas) também é reconhecido', call('PUT', '/donations/-existente/name', 'Maria S Souza', TOK.adminUpper));
  await expectOk('administrador acrescenta ao histórico (by = e-mail da conta)', call('PUT', '/adminLog/-l1', log('edit'), TOK.admin));
  await expectDeny('histórico com "by" de outra pessoa', call('PUT', '/adminLog/-l2', log('edit', { by: 'outro@gmail.com' }), TOK.admin));
  await expectDeny('histórico com ação inválida', call('PUT', '/adminLog/-l3', log('hack'), TOK.admin));
  await expectDeny('administrador SOBRESCREVE uma entrada do histórico', call('PUT', '/adminLog/-l1', log('delete'), TOK.admin));
  await expectDeny('administrador APAGA uma entrada do histórico', call('DELETE', '/adminLog/-l1', undefined, TOK.admin));
  await expectDeny('administrador escreve em "admins" (só pelo console)', call('PUT', '/admins/novo-admin', true, TOK.admin));
  // exclusão atômica (contribuição + histórico), como o painel faz
  await expectOk('administrador exclui uma contribuição e registra no histórico, numa só operação', call('PATCH', '/', { 'donations/-manual1': null, 'adminLog/-l9': log('delete', { donationId: '-manual1', before: { name: 'João Pedro' } }) }, TOK.admin));
  await expectOk('administrador exclui outra contribuição', call('DELETE', '/donations/-existente', undefined, TOK.admin));

  // ---------- quem NÃO é administrador ----------
  await owner('PUT', '/donations/-alvo', don({ name: 'Carla Dias' }));
  await expectDeny('conta Google qualquer (e-mail verificado, não autorizado) edita', call('PUT', '/donations/-alvo/name', 'Hack', TOK.intruso));
  await expectDeny('conta Google qualquer apaga', call('DELETE', '/donations/-alvo', undefined, TOK.intruso));
  await expectDeny('conta Google qualquer lê "admins"', call('GET', '/admins', undefined, TOK.intruso));
  await expectDeny('conta do clube com e-mail NÃO verificado edita', call('PUT', '/donations/-alvo/name', 'Hack', TOK.adminNaoVerificado));
  await expectDeny('conta do clube com e-mail NÃO verificado lê o histórico', call('GET', '/adminLog', undefined, TOK.adminNaoVerificado));
  await expectOk('conta Google qualquer ainda consegue CRIAR contribuição nova (é só um visitante autenticado)', call('PUT', '/donations/' + nid(), don(), TOK.intruso));

  // ---------- administradores futuros (nó "admins") ----------
  await expectOk('administrador cadastrado em "admins" (novo.admin@gmail.com) edita', call('PUT', '/donations/-alvo/name', 'Carla D Dias', TOK.novoAdmin));
  await expectOk('administrador cadastrado em "admins" lê o histórico', call('GET', '/adminLog', undefined, TOK.novoAdmin));
  await expectDeny('administrador cadastrado, porém com e-mail NÃO verificado, edita', call('PUT', '/donations/-alvo/name', 'Hack', TOK.novoAdminNaoVerificado));

  console.log('\n' + (falhas.length ? '==== ' + falhas.length + ' FALHA(S) de ' + n + ' ====\n' + falhas.join('\n') : '==== ' + n + ' de ' + n + ' testes das regras passaram ===='));
  process.exit(falhas.length ? 1 : 0);
})().catch(e => { console.error('ERRO NO TESTE', e); process.exit(2); });
