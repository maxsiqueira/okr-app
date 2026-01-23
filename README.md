# Ion Dashboard

**Ion Dashboard** is a modern, strategic agile dashboard designed to provide real-time insights into your engineering team's performance. It integrates directly with **Jira** to track OKRs, analyze Epic progress, and uses **Google Gemini AI** to generate strategic recommendations.

## 🚀 Features

*   **Strategic Dashboard**: High-level overview of project health, including delivered value and active initiatives.
*   **OKR Tracking**: Dedicated view for tracking Objectives and Key Results (OKRs) with progress bars and status indicators.
*   **Epic Analysis**: Deep dive into specific Epics, visualizing child task completion, time tracking (Estimated vs. Spent), and investment profile.
*   **AI Analyst**: Built-in AI assistant (powered by Google Gemini 1.5) that analyzes your current board state and provides actionable strategic advice.
*   **Real-time Jira Sync**: Fetches live data from your Jira Cloud instance using a secure local proxy to handle CORS.
*   **JQL Debugging**: Advanced tools for inspecting Jira Query Language (JQL) requests and responses.

## 🏗️ Architecture

The application follows a **Client-Side SPA** architecture with a lightweight **Node.js Proxy** to handle API security and CORS limitations involved in browser-to-Jira communication.

```mermaid
graph TD
    User[User Browser]
    Frontend[React SPA (Vite)]
    Proxy[Express Proxy Server :3001]
    JiraAPI[Jira Cloud API]
    GeminiAPI[Google Gemini API]
    LocalStorage[Browser LocalStorage]

    User --> Frontend
    Frontend -- "1. Read Credentials" --> LocalStorage
    Frontend -- "2. API Requests (Proxy Mode)" --> Proxy
    Proxy -- "3. Forward Request + Auth Header" --> JiraAPI
    JiraAPI -- "4. JSON Response" --> Proxy
    Proxy -- "5. Return Data" --> Frontend
    Frontend -- "6. AI Requests (Direct)" --> GeminiAPI
```

### Key Components

1.  **Frontend (React + Vite)**:
    *   **Pages**: `StrategicDashboard`, `OkrTracking`, `EpicAnalysis`, `SettingsPage`.
    *   **Services**:
        *   `JiraService` (`src/services/jira.ts`): Handles all Jira data fetching, pagination, and progress calculation.
        *   `AiService` (`src/services/ai.ts`): Interfaces with Google Gemini for generating insights.
    *   **State Management**: Primarily local component state (`useState`, `useEffect`) combined with `localStorage` for persisting user credentials and settings.
    *   **UI Library**: Shadcn/UI (based on Radix Primitives) and Tailwind CSS.

2.  **Backend Proxy (Express)**:
    *   **Role**: Circumvents CORS (Cross-Origin Resource Sharing) restrictions enforced by modern browsers when calling the Atlassian API directly.
    *   **Security**: It does **not** store credentials. It only forwards requests stamped with the Authorization header constructed on the client side.
    *   **Logging**: Provides a memory-based log (`/api/logs`) for debugging request flows.

## 📏 Business Rules & Logic

The dashboard enforces specific logic when interpreting Jira data to ensure strategic accuracy:

### 1. Progress Calculation
Epic progress is **not** taken from the "Time Spent" field but is calculated based on the **completion of child issues**:
*   **Formula**: `(Count of DONE children) / (Total Count of major children) * 100`
*   **Major Children**: Only direct children (User Stories, Tasks, Bugs) are counted. **Sub-tasks are excluded** from the top-level progress percentage to avoid skewing data (e.g., one story having 50 sub-tasks shouldn't outweigh 50 stories).
*   **Exclusions**: Issues with status `Cancelled` (case-insensitive) are strictly excluded from both the numerator and denominator.

### 2. Time Tracking
*   **Time Spent**: Aggregated from the `timespent` field (seconds) of the Epic + all its children + all their sub-tasks.
*   **Original Estimate**: Aggregated from `timeoriginalestimate`.
*   **Display**: Converted to human-readable hours (h).

### 3. AI Analysis
*   **Privacy**: Data sent to Gemini is anonymized to summary levels (Task Key, Summary, Status). No sensitive comments or descriptions are uploaded.
*   **Fallback**: If no API key is provided, the system falls back to a "Heuristic Mode" that generates static advice based on simple math (e.g., "Progress < 20% -> Early Stage Advice").

## 📝 Coding Standards & Rules

### Code Style
*   **Linter**: ESLint with `typescript-eslint` and `react-hooks` plugins.
*   **Formatting**: Standard Prettier-like rules (semi-colons, double quotes in JSON, single quotes in JS/TS).
*   **Component Structure**: Functional Components with Hooks.
*   **Styling**: **Tailwind CSS** utility classes. Avoid inline `style={{}}` objects unless calculating dynamic values (e.g., progress bar width).

### Data Handling
*   **Pagination**: All Jira fetches using JQL MUST handle pagination (`startAt`, `maxResults`, `nextPageToken`) to robustly support large projects (>50 issues).
*   **Credentials**: NEVER commit API tokens or hardcode them in `src/`. Always retrieve from `localStorage.getItem("jira_token")`.

## 🛠️ Tech Stack

*   **Frontend**: React (v18), TypeScript, Vite
*   **Styling**: Tailwind CSS, Shadcn/UI (Radix Primitives), Lucide Icons
*   **Charts**: Recharts
*   **Backend / Proxy**: Node.js, Express (for handling CORS and API proxying)
*   **AI**: Google Gemini API

## 📋 Prerequisites

*   **Node.js**: Version 18 or higher is recommended.
*   **npm**: Included with Node.js.
*   **Jira Account**: A Jira Cloud account with an API Token.
*   **Gemini API Key** (Optional): To enable the AI Analyst features.

## 📦 Installation

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/your-username/ion-dashboard.git
    cd ion-dashboard
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

## 🏃‍♂️ Running Locally

To start the application locally, you need to run both the frontend (Vite) and the backend proxy (Express). We have a convenience script for this:

```bash
npm run dev
```

*   **Frontend**: Accessible at `http://localhost:5173`
*   **Proxy Server**: Running on `http://localhost:3001`

> **Note**: The proxy server `server/proxy.js` is required to bypass CORS restrictions when calling the Jira API from the browser.

## ⚙️ Configuration

The application does **not** require a `.env` file for API keys. Instead, it features a built-in **Settings** page where you securely input your credentials, which are stored in your browser's `localStorage`.

1.  Start the app (`npm run dev`).
2.  Navigate to the **Settings** page (Gear icon in the sidebar).
3.  Enter your details:
    *   **Jira URL**: e.g., `your-company.atlassian.net`
    *   **Jira Email**: Your login email.
    *   **Jira API Token**: Generate one at [Atlassian API Tokens](https://id.atlassian.com/manage-profile/security/api-tokens).
    *   **Gemini API Key**: Get one at [Google AI Studio](https://aistudio.google.com/).
4.  Click **Save Credentials**.
5.  Click **Test Connection** to verify everything is working.

## 📂 Project Structure

```
ion-dashboard/
├── src/
│   ├── components/      # Reusable UI components (KPI cards, charts, layout)
│   ├── pages/           # Main route pages (StrategicDashboard, EpicAnalysis, etc.)
│   ├── services/        # API integrations (jira.ts, ai.ts)
│   ├── types/           # TypeScript interfaces
│   └── App.tsx          # Main application entry
├── server/
│   └── proxy.js         # Express proxy server for API requests
├── public/              # Static assets
└── package.json         # Project dependencies and scripts
```

## 🚢 Deployment

To build the application for production:

1.  **Build the frontend**:
    ```bash
    npm run build
    ```
    This compiles the React app into the `dist` folder.

2.  **Start the production server**:
    The included `server/proxy.js` is configured to serve the static files from `dist` in production mode.
    ```bash
    node server/proxy.js
    ```
