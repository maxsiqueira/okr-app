# Ion Dashboard - Sistema de Gestão Estratégica

**Ion Dashboard** é uma plataforma moderna de inteligência de engenharia projetada para oferecer visibilidade em tempo real sobre OKRs, Epics e a saúde dos projetos. Integrando-se profundamente com o **Jira** e potencializado pela **Google Gemini AI**, ele transforma dados brutos em insights estratégicos acionáveis.

![Ion Dashboard Overview](brain/eae953de-4a3b-4cc8-a5c1-147362fc30f4/uploaded_media_1771526121461.png)

## 🚀 Funcionalidades Principais

### 1. Visão Estratégica (Strategic Overview)
Painel executivo que consolida o progresso de todos os grandes incitavas (OKRs).
*   **KPIs em Tempo Real**: Progresso, dias restantes e status de entrega.
*   **Gestão de OKRs**: Visualização clara de Objetivos e Resultados Chave.
*   **Calculadora de Valor**: Algoritmo proprietário que pondera Escopo, Autonomia e Complexidade para gerar o "Business Value".

### 2. Análise de Epics (Deep Dive)
Ferramenta de inspeção granular para Epics individuais.
*   **Gráfico de Burnup/Progresso**: Visualiza a entrega de *User Stories* ao longo do tempo.
*   **Investment Profile**: Breakdown do esforço por tipo de trabalho (Feature vs Bug vs Tech Debt).
*   **Hierarquia Completa**: Carrega a árvore completa: Epic -> Story/Task -> Subtask.
*   **Detecção de Desvios**: Alertas automáticos para escopo não planejado.

### 3. Iniciativas Extras (Support Work)
Monitoramento de demandas que fogem dos OKRs principais (Sustentação, Bugs Críticos, Demandas Legais). Garante que o "Shadow Work" seja visível e contabilizado na capacidade do time.

### 4. Gestão e Configuração
*   **Painel de Admin**: Configuração centralizada de credenciais do Jira (URL, Token, E-mail) que se aplicam a todos os usuários (exceto se sobrescritas).
*   **Gestão de Usuários**: Controle de acesso baseado em roles (`admin`, `manager`, `developer`).
*   **Logs de Sistema**: Visualização em tempo real dos logs do backend para diagnósticos.

---

## 🏗️ Arquitetura e Engenharia

O projeto evoluiu para uma arquitetura **Serverless** robusta utilizando Firebase para garantir escalabilidade e segurança.

```mermaid
graph TD
    Client[React SPA (Vite)]
    Firebase[Firebase Cloud Functions]
    Firestore[Google Firestore]
    Jira[Jira Cloud / Server]
    Gemini[Google Gemini AI]

    Client -- "1. Auth & Data Request" --> Firebase
    Firebase -- "2. Check Cache" --> Firestore
    Firebase -- "3. Fetch Data (API v3/v2)" --> Jira
    Jira -- "4. JSON Response" --> Firebase
    Firebase -- "5. Process & Cache" --> Firestore
    Firebase -- "6. Return Data" --> Client
    Client -- "7. Generate Insights" --> Gemini
```

### Stack Tecnológico
*   **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Shadcn/UI.
*   **Backend**: Firebase Cloud Functions (Node.js 20).
*   **Database**: Firestore (NoSQL) para cache agressivo e persistência de configurações.
*   **AI**: Google Gemini 1.5 Flash para análise de contexto e recomendações.

### 🛡️ Robustez e Tratamento de Erros (Key Highlights)

O sistema implementa múltiplas camadas de resiliência para lidar com as instabilidades comuns da API do Jira:

1.  **API Version Fallback (v3 → v2)**:
    *   O sistema tenta primariamente a **API v3** (`/rest/api/3/search/jql`).
    *   Caso receba erros críticos (**400 Bad Request**, **404 Not Found**, **410 Gone**, **405 Method Not Allowed**), ele **automaticamente** rebaixa a requisição para a **API v2** (`/rest/api/2/search`).
    *   Isso garante compatibilidade tanto com Jira Cloud moderno quanto com instâncias Server/Legacy.

2.  **Smart Auth Retry**:
    *   Se a autenticação básica (E-mail + Token) falhar com **401 Unauthorized**, o sistema tenta automaticamente re-autenticar usando o token como **Bearer Token** (PAT - Personal Access Token), comum em ambientes corporativos com SSO.

3.  **Rate Limiting Handling (Erro 429)**:
    *   **Backend**: Implementação de *Exponential Backoff*. Se o Jira retornar **429 Too Many Requests**, a função espera 2 segundos e tenta novamente (até 3 tentativas).
    *   **Frontend**: Throttling inteligente no carregamento de múltiplos Epics. Requisições são enviadas em **lotes de 3**, com pausas entre os lotes, para evitar o bloqueio por IP.

4.  **Offline-First & Caching**:
    *   Dados de Epics e Objetivos são cacheados no **Firestore** com TTL (Time-To-Live) de 24h.
    *   Se o Jira estiver fora do ar, o sistema serve a última versão conhecida do cache, garantindo que o dashboard nunca fique "em branco".

---

## ⚙️ Configuração do Sistema

Acesse a página de **Configurações** (ícone de engrenagem) para conectar ao seu Jira.

![Settings Page](brain/eae953de-4a3b-4cc8-a5c1-147362fc30f4/uploaded_media_1771527044399.png)

### Campos Obrigatórios
1.  **Jira URL**: O endereço base do seu Jira (ex: `https://sua-empresa.atlassian.net` ou URL on-premise).
2.  **E-mail**: O e-mail usado no login (ou Username para Jira Server).
3.  **API Token**:
    *   **Cloud**: Gere um token em [id.atlassian.com](https://id.atlassian.com/manage-profile/security/api-tokens).
    *   **Server**: Use sua senha de rede ou gere um PAT (Personal Access Token).
4.  **Proxy URL**:
    *   Se estiver rodando localmente/cloud functions: Deixe vazio ou use `/api/proxy`.
    *   Se estiver usando um túnel (Ngrok/Cloudflare): Insira a URL completa do túnel.

> **Nota**: Utilize o botão **"Testar Conexão"** para validar suas credenciais. O sistema fará um teste real de busca (fetch) usando a lógica de fallback v3/v2.

---

## 📦 Instalação e Execução Local

### Pré-requisitos
*   Node.js 18+
*   npm
*   Firebase CLI (`npm install -g firebase-tools`)

### Passos

1.  **Clone o repositório**:
    ```bash
    git clone https://github.com/seu-org/ion-dashboard.git
    cd ion-dashboard
    ```

2.  **Instale as dependências (Raiz e Functions)**:
    ```bash
    npm install
    cd functions && npm install && cd ..
    ```

3.  **Execute em modo de desenvolvimento**:
    Simula tanto o Frontend (Vite) quanto o Backend (Firebase Emulators).
    ```bash
    npm run dev
    ```
    *   Frontend: `http://localhost:5173`
    *   Emuladores: `http://localhost:4000`

---

## 🐛 Debugging Avançado

Se encontrar problemas de dados, o sistema oferece ferramentas visuais:

1.  **Logs em Tempo Real**: Na tela de Configurações, habilite o "Modo Debug". Logs detalhados aparecerão no console do navegador e na área de logs da página.
2.  **Mensagens de Erro**: Erros de conexão (400, 401, 404, 410, 429) são tratados e exibidos com mensagens amigáveis ("Jira search failed", "Rate limited", etc.), indicando exatamente se o problema é autenticação, permissão ou instabilidade da API.

---

© 2026 Ion Sistemas - Advanced Engineering Intelligence
