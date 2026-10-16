// Gera firebase.deploy.json: o firebase.json do projeto + a rota secreta do painel administrativo.
//
// O código do painel mora SÓ em public/admin/. A página dele (index.html) só é entregue pela rota
// /admin/<chave>, criada aqui com a chave guardada em .admin-token (ou na variável ADMIN_TOKEN).
// A chave e o arquivo gerado ficam fora do Git. Acessar /admin/ direto é redirecionado para "/"
// (isso já está no firebase.json versionado).
//
// Uso: node scripts/build-deploy-config.js
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.join(__dirname, '..');
const tokenFile = path.join(root, '.admin-token');

function getToken() {
  let token = (process.env.ADMIN_TOKEN || (fs.existsSync(tokenFile) ? fs.readFileSync(tokenFile, 'utf8') : '')).trim();
  if (!token) {
    token = crypto.randomBytes(16).toString('hex');
    fs.writeFileSync(tokenFile, token + '\n');
    console.log('Nova chave gerada e salva em .admin-token (fora do Git).');
  }
  if (!/^[a-f0-9]{32,64}$/i.test(token)) throw new Error('A chave deve ter de 32 a 64 caracteres hexadecimais.');
  return token;
}

function build() {
  const token = getToken();
  const cfg = JSON.parse(fs.readFileSync(path.join(root, 'firebase.json'), 'utf8'));
  cfg.hosting.rewrites = (cfg.hosting.rewrites || []).filter(r => !/^\/admin\//.test(r.source));
  ['/admin/' + token, '/admin/' + token + '/'].forEach(source => cfg.hosting.rewrites.push({ source, destination: '/admin/index.html' }));
  const out = path.join(root, 'firebase.deploy.json');
  fs.writeFileSync(out, JSON.stringify(cfg, null, 2) + '\n');
  return { token, out };
}

if (require.main === module) {
  build();
  console.log('Configuração de deploy gerada em firebase.deploy.json (fora do Git).');
}
module.exports = { build, getToken };
