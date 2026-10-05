# Rumo a Barretos — Clube de Desbravadores Duarte Coelho

Site da campanha **"Rumo a Barretos"**, feito para o **Clube de Desbravadores Duarte Coelho**.

## Sobre o projeto

Este é um **projeto voluntário**, desenvolvido sem fins lucrativos para apoiar o Clube de Desbravadores Duarte Coelho em sua jornada de fé e na arrecadação da campanha.

## Tecnologias

- HTML, CSS e JavaScript puro
- [Firebase](https://firebase.google.com/) (Hosting e banco de dados)

## Estrutura

```
.
├── public/                  # Tudo que é publicado no Firebase Hosting
│   ├── index.html           # Página principal da campanha
│   ├── css/style.css        # Estilos do site
│   └── js/
│       ├── firebase-config.js  # Config pública do Firebase (único arquivo a trocar ao migrar de projeto)
│       └── script.js        # Lógica da página e integração com o Firebase
├── database.rules.json      # Regras de segurança do Realtime Database
├── firebase.json            # Configuração de deploy e cabeçalhos de segurança
├── .firebaserc              # Projeto Firebase padrão
└── README.md
```

## Como rodar localmente

Basta abrir o `public/index.html` no navegador, ou servir a pasta com qualquer servidor estático:

```bash
npx serve public
```

## Deploy

```bash
npm i -g firebase-tools
firebase login
firebase deploy        # publica o site e as regras do banco
```

## Contribuições

Por ser um projeto voluntário, sugestões e melhorias são bem-vindas. Abra uma *issue* ou envie um *pull request*.

---

Feito com carinho, como voluntário, para o Clube de Desbravadores Duarte Coelho.
