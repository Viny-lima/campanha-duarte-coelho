# Rumo a Barretos — Clube de Desbravadores Duarte Coelho

Site da campanha **"Rumo a Barretos"**, feito para o **Clube de Desbravadores Duarte Coelho**.

**Versão 2.0.0** · **Site no ar: https://campanha-clube-duarte-coelho.web.app**

## Sobre o projeto

Este é um **projeto voluntário**, desenvolvido sem fins lucrativos para apoiar o Clube de Desbravadores Duarte Coelho em sua jornada de fé e na arrecadação da campanha.

O objetivo é levar os desbravadores de 10 a 15 anos ao Campori da Divisão Sul-Americana, em Barretos/SP.

## Como o site é

![Página completa no computador](docs/screenshots/desktop-completo.jpg)

### No celular

<p>
  <img src="docs/screenshots/mobile-topo.jpg" alt="Topo da página no celular" width="24%">
  <img src="docs/screenshots/mobile-progresso.jpg" alt="Painel de progresso no celular" width="24%">
  <img src="docs/screenshots/mobile-doacao.jpg" alt="Formulário de contribuição no celular" width="24%">
  <img src="docs/screenshots/mobile-popup.jpg" alt="Pop-up de confirmação no celular" width="24%">
</p>

## Como funciona a contribuição

1. A pessoa informa **nome** e **valor** (ou escolhe um valor sugerido).
2. Ao tocar em **Contribuir**, abre um pop-up para **conferir os dados**. Nada é gravado ainda.
3. Se algo estiver errado, **Editar informações** volta ao formulário com os dados preenchidos.
4. Ao tocar em **Concluir pagamento**, o nome entra na **lista de padrinhos** e a pessoa segue para o **7me** (plataforma de doações da Igreja Adventista, desenvolvida pela IATec) para finalizar o pagamento.

O pop-up é travado de propósito: Esc e clique fora não fecham. As únicas saídas são **Concluir pagamento** e **Editar informações**.

## Funcionalidades

- **Painel de progresso:** valor arrecadado, meta e quanto falta, com barra de progresso atualizada automaticamente.
- **Validação dos campos:** o nome aceita só letras, e o valor aceita só números no formato brasileiro (de R$ 1,00 a R$ 10.000,00), com mensagens claras.
- **Lista de padrinhos:** transparência com as famílias do clube, da contribuição mais recente para a mais antiga.
- **Resistente a falhas:** tempo limite e mensagem de erro se a internet ou o servidor falharem, e "Tentar de novo" no painel.
- **Responsivo e acessível:** pensado primeiro para o celular, com botão fixo "Quero contribuir", navegação por teclado, link para pular o conteúdo e contraste conforme WCAG AA.
- **Compartilhamento:** prévia com imagem e descrição ao compartilhar o link no WhatsApp e nas redes.
- **Seguro:** regras do banco que só permitem criar contribuições válidas (sem editar nem apagar) e cabeçalhos de segurança no Hosting.

## Tecnologias

- HTML, CSS e JavaScript puro
- [Firebase](https://firebase.google.com/) (Hosting, Realtime Database e Authentication anônima)

## Estrutura

```
.
├── public/                  # Tudo que é publicado no Firebase Hosting
│   ├── index.html           # Página principal da campanha
│   ├── robots.txt
│   ├── css/style.css        # Estilos do site
│   ├── js/
│   │   ├── firebase-config.js  # Config pública do Firebase (único arquivo a trocar ao migrar de projeto)
│   │   └── script.js        # Lógica da página, validações e integração com o Firebase
│   └── assets/images/       # Foto da turma, brasão, ícone e imagem de prévia
├── docs/screenshots/        # Imagens usadas neste README
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

> Rodando localmente o site usa o banco de produção. Evite concluir contribuições de teste.

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
