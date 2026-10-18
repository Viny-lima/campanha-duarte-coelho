// Roda os testes das regras do banco (database.rules.json) no emulador do Firebase.
// Requisitos: Java 17+ no PATH (ou JAVA_HOME) e o firebase-tools instalado.
// Uso: node scripts/test-rules.js
const { spawnSync } = require('child_process');
const path = require('path');

const root = path.join(__dirname, '..');
const java = spawnSync('java', ['-version'], { shell: true, encoding: 'utf8' });
if (java.status !== 0) {
  console.error('Java não encontrado. Instale o Java 17+ (ou aponte JAVA_HOME) para rodar o emulador do Firebase.');
  process.exit(1);
}
const r = spawnSync('firebase', ['emulators:exec', '--only', 'database', '--project', 'demo-campanha', '--config', 'firebase.emulator.json', '"node tests/rules.test.js"'], { cwd: root, stdio: 'inherit', shell: true });
process.exit(r.status === null ? 1 : r.status);
