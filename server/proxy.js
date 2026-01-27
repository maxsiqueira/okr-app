import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const PORT = 3001;

// --- LOGGING SYSTEM ---
const LOGS = [];
const MAX_LOGS = 100;

function log(type, message, details = null) {
    const entry = {
        timestamp: new Date().toISOString(),
        type, // 'INFO', 'ERROR', 'WARN', 'SUCCESS'
        message,
        details
    };

    // Console output
    const method = type === 'ERROR' ? console.error : console.log;
    method(`[${entry.timestamp}] [${type}] ${message}`, details || '');

    // Memory storage
    LOGS.unshift(entry);
    if (LOGS.length > MAX_LOGS) LOGS.pop();
}

// Middleware
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'bypass-tunnel-reminder']
}));
app.use(bodyParser.json());

app.use((req, res, next) => {
    log('INFO', `Method: ${req.method} | Path: ${req.path}`);
    next();
});

// 0) System Logs & Health Check
app.get('/api/logs', (req, res) => {
    res.json(LOGS);
});

app.get('/health', (req, res) => {
    log('INFO', 'Health Check received from Cloud/Tunnel');
    res.json({ status: 'active', node: process.version, time: new Date().toISOString() });
});

app.get('/', (req, res) => {
    res.send('<h1>Ion Proxy is Running</h1><p>Send POST requests to this URL to bridge to Jira.</p>');
});

// 1) API/Proxy Routes
const proxyHandler = async (req, res) => {
    try {
        const { url, method, headers, body } = req.body;

        if (!url) {
            log('ERROR', 'Missing URL in request body');
            return res.status(400).json({ error: 'Missing target URL' });
        }

        const targetAction = `${method || 'GET'} ${url.split('/rest/api/')[1] || url}`;

        // NORMALIZE TARGET URL (Prevent Double Slashes)
        const finalUrl = url.replace(/([^:]\/)\/+/g, "$1");

        log('INFO', `Connecting to Jira: ${finalUrl}`);

        const fetchOptions = {
            method: method || 'GET',
            headers: {
                ...headers,
                'User-Agent': 'Ion-Dashboard-Proxy/1.0',
                'Connection': 'keep-alive'
            },
            body: body ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
        };

        const response = await fetch(finalUrl, fetchOptions);
        const data = await response.text();

        if (response.ok) {
            log('SUCCESS', `Jira Answered 200 OK for ${targetAction}`);
        } else {
            log('ERROR', `Jira Error ${response.status}: ${data.substring(0, 200)}`);
        }

        res.status(response.status);
        const contentType = response.headers.get("content-type");
        if (contentType) res.setHeader("Content-Type", contentType);

        try {
            const json = JSON.parse(data);
            res.json(json);
        } catch (e) {
            res.send(data);
        }
    } catch (error) {
        log('ERROR', 'Critical Proxy Exception', error.message);
        res.status(500).json({ error: error.message });
    }
};

app.post('/api/proxy', proxyHandler);
app.post('/', proxyHandler); // Aceita também na raiz para túneis (Ngrok/Cloudflare)

// 2) Static File Serving (for production)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Assuming server/proxy.js is one level deep, dist is at root/dist
const distPath = path.join(__dirname, '../dist');

app.use(express.static(distPath));

// 3) Catch-All for SPA (Single Page App)
app.get(/.*/, (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 Server running on http://0.0.0.0:${PORT}`);
    console.log(`   - API Proxy at /api/proxy`);
    console.log(`   - Serving frontend from ${distPath}`);
});
