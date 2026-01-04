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
app.use(cors());
app.use(bodyParser.json());

// 0) System Logs Endpoint
app.get('/api/logs', (req, res) => {
    res.json(LOGS);
});

// 1) API/Proxy Routes
app.post('/api/proxy', async (req, res) => {
    try {
        const { url, method, headers, body } = req.body;

        if (!url) {
            log('ERROR', 'Missing URL in request body');
            return res.status(400).json({ error: 'Missing target URL' });
        }

        log('INFO', `Proxy Request: ${method || 'GET'} -> ${url}`);

        // Log Headers (Masked)
        if (headers && headers.Authorization) {
            log('INFO', `Auth Header Present (Masked len: ${headers.Authorization.length})`);
        }

        const fetchOptions = {
            method: method || 'GET',
            headers: headers || {},
            body: body ? JSON.stringify(body) : undefined,
        };

        const response = await fetch(url, fetchOptions);

        const statusType = response.ok ? 'SUCCESS' : 'ERROR';
        log(statusType, `Upstream Response: ${response.status} ${response.statusText}`);

        res.status(response.status);

        const data = await response.text();

        // Log Error Responses Details
        if (!response.ok) {
            log('ERROR', `Upstream Error Body Preview`, data.substring(0, 500));
        }

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
});

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
