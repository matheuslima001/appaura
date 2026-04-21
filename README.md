# Aura Tracker — Crypto Arbitrage Profit Tracker

PWA mobile-first para acompanhar lucros diários de arbitragem crypto spot × futuros.

---

## Stack

- React 19 + Vite 8 + TypeScript
- Tailwind CSS v4
- Recharts (gráficos)
- localStorage (persistência — sem backend)
- vite-plugin-pwa + Workbox (offline + instalável)

---

## Rodando localmente

```bash
# Instalar dependências
npm install

# Modo sem proxy (tente primeiro)
npm run dev

# Modo com proxy CORS (se as corretoras bloquearem chamadas diretas)
cp .env.example .env.local
# Edite .env.local e defina VITE_USE_PROXY=true
npm run dev:all
```

Acesse: `http://localhost:5173`

---

## Configurando as API Keys

### Permissões necessárias (em todas as corretoras)
- ✅ Leitura de saldo / conta
- ❌ Negociação (não necessário)
- ❌ Saque (não necessário — nunca habilite)
- Restrição por IP: recomendado adicionar seu IP ou deixar aberto apenas para leitura

### BingX
1. Acesse: **Conta → API Management**
2. Crie uma nova API Key com permissão **"Read"**
3. Copie a **API Key** e o **Secret Key**
4. No Aura Tracker: vá em **Configurações → BingX**, cole as chaves e ative

### Gate.io
1. Acesse: **Conta → API Keys**
2. Crie nova key com permissão **"Spot — Read"** e **"Futures — Read"**
3. Copie a **Key** e o **Secret**
4. No Aura Tracker: vá em **Configurações → Gate.io**, cole as chaves e ative

### MEXC
1. Acesse: **Conta → API Management**
2. Crie nova API com permissão **"Account Read"**
3. Copie o **Access Key** e o **Secret Key**
4. No Aura Tracker: vá em **Configurações → MEXC**, cole as chaves e ative

---

## CORS e Proxy Local

As APIs das corretoras possuem configuração CORS variável:

| Corretora | CORS no Browser |
|-----------|----------------|
| BingX     | ⚠️ Pode bloquear |
| Gate.io   | ⚠️ Pode bloquear |
| MEXC      | ⚠️ Pode bloquear |

Se o botão "Testar Conexão" retornar erro de rede (não de autenticação), ative o proxy:

```bash
# 1. Ative o proxy no .env.local
VITE_USE_PROXY=true

# 2. Suba o dev server + proxy juntos
npm run dev:all
```

O proxy Express roda em `localhost:3001` e só aceita requests para os domínios das 3 corretoras. **Nunca exponha o proxy publicamente.**

Para produção, você pode usar um Cloudflare Worker ou uma função serverless como proxy, ou rodar o `proxy/server.ts` na mesma máquina que acessa o app.

---

## Build de Produção

```bash
npm run build
# arquivos em /dist

# Testar o build localmente
npm run preview
```

---

## Instalando o PWA no Celular

### Android (Chrome)
1. Abra o app no Chrome
2. Toque no menu **⋮** → **"Adicionar à tela inicial"**
3. Confirme

### iOS (Safari)
1. Abra o app no Safari
2. Toque no botão de **Compartilhar** (quadrado com seta)
3. **"Adicionar à Tela de Início"**
4. Confirme

O app funciona offline após a primeira visita (a UI fica em cache pelo Service Worker).

---

## Estrutura de Dados (localStorage)

```
aura_config   — API Keys e configuração das corretoras
aura_history  — Array de DayRecord (registros diários)
```

Todos os dados ficam no dispositivo. Nada é enviado a servidores externos.

---

## Segurança

- API Keys armazenadas apenas no `localStorage` do browser
- Todas as chamadas de API são feitas diretamente do browser para as corretoras (ou via proxy local)
- Use apenas chaves com permissão de **leitura** — nunca habilite saque ou negociação
- Recomendado: restrinja a API Key ao seu IP nas configurações da corretora
