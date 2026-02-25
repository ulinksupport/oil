require('dotenv').config();
const express = require('express');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ───────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Multer: store file in memory (max 10 MB)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
        if (allowed.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only image files (JPG, PNG, GIF, WEBP) or PDF are accepted.'));
        }
    }
});

// ── POST /submit ─────────────────────────────────────────────────────────────
// Receives OIL form data + file, forwards multipart to n8n webhook
app.post('/submit', upload.single('approvalFile'), async (req, res) => {
    try {
        // Validate required text fields
        const required = ['staffName', 'dateApplied', 'oilDate', 'oilTime', 'oilHours', 'reason'];
        for (const field of required) {
            if (!req.body[field] || !req.body[field].toString().trim()) {
                return res.status(400).json({ success: false, error: `Missing required field: ${field}` });
            }
        }

        if (!req.file) {
            return res.status(400).json({ success: false, error: 'Approval evidence file is required.' });
        }

        // Build multipart form for n8n
        const form = new FormData();
        form.append('staffName', req.body.staffName.trim());
        form.append('dateApplied', req.body.dateApplied);
        form.append('oilDate', req.body.oilDate);
        form.append('oilTime', req.body.oilTime);
        form.append('oilHours', req.body.oilHours);
        form.append('reason', req.body.reason.trim());
        form.append('approvalFile', req.file.buffer, {
            filename: req.file.originalname,
            contentType: req.file.mimetype
        });

        const webhookUrl = process.env.N8N_SUBMISSION_WEBHOOK;
        if (!webhookUrl) {
            return res.status(500).json({ success: false, error: 'Server configuration error: N8N_SUBMISSION_WEBHOOK not set.' });
        }

        const n8nRes = await axios.post(webhookUrl, form, {
            headers: form.getHeaders(),
            timeout: 30000
        });

        // n8n should return { success: true, message: '...' }
        if (n8nRes.data && n8nRes.data.success === false) {
            return res.status(422).json({ success: false, error: n8nRes.data.error || 'Validation failed in workflow.' });
        }

        return res.json({ success: true, message: 'OIL claim submitted and recorded successfully.' });

    } catch (err) {
        console.error('[/submit error]', err.message);

        // Multer file type error
        if (err.message && err.message.includes('Only image')) {
            return res.status(400).json({ success: false, error: err.message });
        }

        return res.status(500).json({ success: false, error: 'Submission failed. Please try again.' });
    }
});

// ── POST /query ──────────────────────────────────────────────────────────────
// Proxies AI OIL query to n8n → ChatGPT
app.post('/query', async (req, res) => {
    try {
        const { question } = req.body;
        if (!question || !question.trim()) {
            return res.status(400).json({ success: false, error: 'Question is required.' });
        }

        const webhookUrl = process.env.N8N_QUERY_WEBHOOK;
        if (!webhookUrl) {
            return res.status(500).json({ success: false, error: 'Server configuration error: N8N_QUERY_WEBHOOK not set.' });
        }

        const n8nRes = await axios.post(webhookUrl, { question: question.trim() }, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 45000
        });

        const answer = n8nRes.data?.answer || n8nRes.data?.output || n8nRes.data?.text;
        if (!answer) {
            return res.status(500).json({ success: false, error: 'No answer returned from the AI assistant.' });
        }

        return res.json({ success: true, answer });

    } catch (err) {
        console.error('[/query error]', err.message);
        return res.status(500).json({ success: false, error: 'Query failed. Please try again.' });
    }
});

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`\n🟢 OIL Tracker server running on http://localhost:${PORT}`);
    console.log(`   Form:     http://localhost:${PORT}/`);
    console.log(`   Chatbot:  http://localhost:${PORT}/chat.html`);
    console.log(`   Health:   http://localhost:${PORT}/health\n`);
});
