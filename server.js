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
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Multer for OPD file uploads (max 10 MB)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
        allowed.includes(file.mimetype)
            ? cb(null, true)
            : cb(new Error('Only JPG, PNG, GIF, WEBP, or PDF files are accepted.'));
    }
});

// ── POST /submit  (OIL — JSON) ───────────────────────────────────────────────
app.post('/submit', async (req, res) => {
    try {
        const required = ['staffName', 'dateApplied', 'oilDate', 'oilHours', 'reason'];
        for (const field of required) {
            if (!req.body[field] || !req.body[field].toString().trim())
                return res.status(400).json({ success: false, error: `Missing required field: ${field}` });
        }

        const oilHoursVal = parseFloat(req.body.oilHours);
        if (!isNaN(oilHoursVal) && oilHoursVal < 10) {
            if (!req.body.oilTimeFrom || !req.body.oilTimeTo)
                return res.status(400).json({ success: false, error: 'OIL From Time and To Time are required for partial day claims.' });
        }

        const webhookUrl = process.env.N8N_SUBMISSION_WEBHOOK;
        if (!webhookUrl)
            return res.status(500).json({ success: false, error: 'N8N_SUBMISSION_WEBHOOK not set.' });

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

        if (n8nRes.data?.success === false)
            return res.status(422).json({ success: false, error: n8nRes.data.error });

        return res.json({ success: true, message: 'OIL claim submitted successfully.' });

    } catch (err) {
        console.error('[/submit error]', err.message);
        return res.status(500).json({ success: false, error: 'Submission failed. Please try again.' });
    }
});

// ── POST /submit-opd  (OPD — multipart with file) ────────────────────────────
app.post('/submit-opd', upload.single('opdFile'), async (req, res) => {
    try {
        const required = ['staffName', 'treatmentDate', 'treatmentAmount', 'diagnosis'];
        for (const field of required) {
            if (!req.body[field] || !req.body[field].toString().trim())
                return res.status(400).json({ success: false, error: `Missing required field: ${field}` });
        }

        if (!req.file)
            return res.status(400).json({ success: false, error: 'Receipt or medical document is required.' });

        const webhookUrl = process.env.N8N_OPD_WEBHOOK;
        if (!webhookUrl)
            return res.status(500).json({ success: false, error: 'N8N_OPD_WEBHOOK not set.' });

        const form = new FormData();
        form.append('staffName', req.body.staffName.trim());
        form.append('treatmentDate', req.body.treatmentDate);
        form.append('treatmentAmount', req.body.treatmentAmount);
        form.append('diagnosis', req.body.diagnosis.trim());
        form.append('opdFile', req.file.buffer, {
            filename: req.file.originalname,
            contentType: req.file.mimetype
        });

        const n8nRes = await axios.post(webhookUrl, form, {
            headers: form.getHeaders(),
            timeout: 30000
        });

        if (n8nRes.data?.success === false)
            return res.status(422).json({ success: false, error: n8nRes.data.error });

        return res.json({ success: true, message: 'OPD claim submitted successfully.' });

    } catch (err) {
        console.error('[/submit-opd error]', err.message);
        if (err.message?.includes('Only JPG'))
            return res.status(400).json({ success: false, error: err.message });
        return res.status(500).json({ success: false, error: 'Submission failed. Please try again.' });
    }
});

// ── POST /query ──────────────────────────────────────────────────────────────
app.post('/query', async (req, res) => {
    try {
        const { question } = req.body;
        if (!question?.trim())
            return res.status(400).json({ success: false, error: 'Question is required.' });

        const webhookUrl = process.env.N8N_QUERY_WEBHOOK;
        if (!webhookUrl)
            return res.status(500).json({ success: false, error: 'N8N_QUERY_WEBHOOK not set.' });

        const n8nRes = await axios.post(webhookUrl, { question: question.trim() }, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 45000
        });

        const answer = n8nRes.data?.answer || n8nRes.data?.output || n8nRes.data?.text;
        if (!answer)
            return res.status(500).json({ success: false, error: 'No answer returned from the AI assistant.' });

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
    console.log(`\n🟢 Claims Portal running on http://localhost:${PORT}`);
    console.log(`   Form:    http://localhost:${PORT}/`);
    console.log(`   Chatbot: http://localhost:${PORT}/chat.html`);
    console.log(`   Health:  http://localhost:${PORT}/health\n`);
});
