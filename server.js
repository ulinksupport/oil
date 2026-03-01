require('dotenv').config();
const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ───────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ── POST /submit ─────────────────────────────────────────────────────────────
app.post('/submit', async (req, res) => {
    try {
        // Validate required fields
        const required = ['staffName', 'dateApplied', 'oilDate', 'oilHours', 'reason'];
        for (const field of required) {
            if (!req.body[field] || !req.body[field].toString().trim()) {
                return res.status(400).json({ success: false, error: `Missing required field: ${field}` });
            }
        }

        // If partial day (< 10 hours), From/To times are required
        const oilHoursVal = parseFloat(req.body.oilHours);
        if (!isNaN(oilHoursVal) && oilHoursVal < 10) {
            if (!req.body.oilTimeFrom || !req.body.oilTimeTo) {
                return res.status(400).json({ success: false, error: 'OIL From Time and To Time are required for partial day claims.' });
            }
        }

        const webhookUrl = process.env.N8N_SUBMISSION_WEBHOOK;
        if (!webhookUrl) {
            return res.status(500).json({ success: false, error: 'Server configuration error: N8N_SUBMISSION_WEBHOOK not set.' });
        }

        // Send JSON payload to n8n
        const payload = {
            staffName: req.body.staffName.trim(),
            dateApplied: req.body.dateApplied,
            oilDate: req.body.oilDate,
            oilHours: req.body.oilHours,
            oilTimeFrom: req.body.oilTimeFrom || '',
            oilTimeTo: req.body.oilTimeTo || '',
            reason: req.body.reason.trim()
        };

        const n8nRes = await axios.post(webhookUrl, payload, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 30000
        });

        if (n8nRes.data && n8nRes.data.success === false) {
            return res.status(422).json({ success: false, error: n8nRes.data.error || 'Validation failed in workflow.' });
        }

        return res.json({ success: true, message: 'OIL claim submitted and recorded successfully.' });

    } catch (err) {
        console.error('[/submit error]', err.message);
        return res.status(500).json({ success: false, error: 'Submission failed. Please try again.' });
    }
});

// ── POST /query ──────────────────────────────────────────────────────────────
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
