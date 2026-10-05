# Rumo a Barretos — Clube de Desbravadores Duarte Coelho

Site da campanha **"Rumo a Barretos"**, feito para o **Clube de Desbravadores Duarte Coelho**.

## Sobre o projeto

Este é um **projeto voluntário**, desenvolvido sem fins lucrativos para apoiar o Clube de Desbravadores Duarte Coelho em sua jornada de fé e na arrecadação da campanha.

## Tecnologias

- HTML, CSS e JavaScript puro
- [Firebase](https://firebase.google.com/) (Hosting e banco de dados)

## Estrutura

| Arquivo | Descrição |
| --- | --- |
| `index.html` | Página principal da campanha |
| `style.css` | Estilos do site |
| `script.js` | Lógica da página e integração com o Firebase |
| `admin.html` | Painel do tesoureiro para aprovar/rejeitar doações pendentes |
| `firebase-config.js` | Configuração pública do Firebase (único arquivo a trocar ao migrar de projeto) |
| `database.rules.json` | Regras de segurança do Realtime Database |
| `firebase.json` | Configuração de deploy e cabeçalhos de segurança |
| `FIREBASE_HOSTING_SETUP.md` | Guia de deploy no Firebase Hosting |

## Fluxo de doações

1. O doador preenche o formulário e a doação é gravada em `pending/`.
2. O tesoureiro confere o Pix no extrato e aprova em `/admin.html` (login Google).
3. Só doações aprovadas entram em `donations/`, que alimenta a barra de progresso e a lista pública.

> Antes do deploy, troque `TROCAR_PELO_EMAIL_DO_CLUBE@gmail.com` em `database.rules.json` pelo e-mail Google do tesoureiro.

## Como rodar localmente

Basta abrir o `index.html` no navegador, ou servir a pasta com qualquer servidor estático:

```bash
npx serve .
```

## Contribuições

Por ser um projeto voluntário, sugestões e melhorias são bem-vindas. Abra uma *issue* ou envie um *pull request*.

---

Feito com carinho, como voluntário, para o Clube de Desbravadores Duarte Coelho.
