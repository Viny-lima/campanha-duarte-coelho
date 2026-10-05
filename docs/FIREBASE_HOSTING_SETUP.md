# Deploy Firebase Hosting — Campanha Duarte Coelho

Guia passo-a-passo para fazer deploy do site da campanha no Firebase Hosting.

## Pré-requisitos

- Node.js instalado ([nodejs.org](https://nodejs.org))
- Conta Google (para Firebase)
- Acesso ao projeto Firebase: `campanha-duarte-coelho`

## Passo 1: Instalar Firebase CLI

Abra o terminal/PowerShell na pasta do projeto e rode:

```bash
npm install -g firebase-tools
```

Aguarde a instalação (~1-2 min).

## Passo 2: Fazer Login no Firebase

```bash
firebase login
```

Se der erro de conexão, tente:

```bash
firebase login --no-localhost
```

Isso abrirá um link no navegador para você autenticar com sua conta Google.

**Se continuar falhando:**
- Pode ser bloqueio de firewall/proxy
- Tente de outra rede (hotspot do celular)
- Ou entre em contato com o suporte do Firebase

## Passo 3: Inicializar Firebase Hosting

Na pasta do projeto, rode:

```bash
firebase init hosting
```

**Respostas esperadas:**

| Pergunta | Resposta |
|----------|----------|
| Are you ready to proceed? | `Y` (Yes) |
| Project | `campanha-duarte-coelho` |
| Public directory | `public` |
| Configure as a single-page app? | `n` (no) |
| Overwrite public/index.html? | `n` (no) |

Pronto! Será criado um arquivo `.firebaserc` na pasta.

## Passo 4: Fazer Deploy

```bash
firebase deploy --only hosting
```

Aguarde 1-2 minutos. Ao terminar, você receberá:

```
✔ Deploy complete!

Project Console: https://console.firebase.google.com/project/campanha-duarte-coelho
Hosting URL: https://campanha-duarte-coelho.web.app
```

## Passo 5: Acessar o Site

Abra no navegador:

```
https://campanha-duarte-coelho.web.app
```

**Pronto!** Sua campanha está no ar! 🎉

## Atualizações Futuras

Sempre que fizer mudanças no site e quiser publicar:

```bash
firebase deploy --only hosting
```

Leva poucos segundos.

## Troubleshooting

### Erro: "Failed to make request"

**Causa:** Problema de conexão/firewall

**Solução:**
- Tente em outra rede (hotspot do celular)
- Verifique se consegue acessar `https://auth.firebase.tools`
- Desabilite VPN/proxy temporariamente

### Erro: "Project ID not found"

**Causa:** Arquivo `.firebaserc` não foi criado

**Solução:**
- Delete `.firebaserc` e `.firebase/` (se existirem)
- Refaça o `firebase init hosting`

### Site não carrega dados da campanha

**Causa:** Firebase Realtime Database não está conectado

**Verificação:**
- Firebase Console → Realtime Database
- Verifique se tem dados em `donations`
- Verifique regras de segurança

## Support

Se tiver dúvidas:
- [Firebase Docs](https://firebase.google.com/docs/hosting)
- [Firebase CLI Reference](https://firebase.google.com/docs/cli)
- [Firebase Console](https://console.firebase.google.com)

---

**Última atualização:** 2026-09-23
