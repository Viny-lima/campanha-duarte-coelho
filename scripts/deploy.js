// Publica o site e o painel administrativo no Firebase.
// Uso: node scripts/deploy.js [argumentos do firebase deploy]
//   ex.: node scripts/deploy.js --only hosting --project campanha-clube-duarte-coelho
const { spawnSync } = require('child_process');
const { build } = require('./build-deploy-config');

build();
const args = ['deploy', '--config', 'firebase.deploy.json', ...process.argv.slice(2)];
console.log('> firebase ' + args.join(' '));
const r = spawnSync('firebase', args, { stdio: 'inherit', shell: true });

// Não imprime a chave em logs: ela está em .admin-token (use "node scripts/admin-link.js" para ver o link).
if (r.status === 0) console.log('\nPainel publicado. Para ver o link: node scripts/admin-link.js');
else console.log('\nO deploy falhou. A chave continua guardada em .admin-token.');
process.exit(r.status === null ? 1 : r.status);
