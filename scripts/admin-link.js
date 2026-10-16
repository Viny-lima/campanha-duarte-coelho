// Mostra o link do painel administrativo (a chave vem de .admin-token). Rode só em ambiente privado.
// Uso: node scripts/admin-link.js [endereço do site]
const { getToken } = require('./build-deploy-config');
const site = (process.argv[2] || 'https://campanha-clube-duarte-coelho.web.app').replace(/\/$/, '');
console.log(site + '/admin/' + getToken() + '/');
