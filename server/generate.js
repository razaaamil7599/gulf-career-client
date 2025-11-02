// server/generate.js
// Simple Express proxy to call Google Generative Language API from server-side.
// IMPORTANT: Set GEMINI_API_KEY in server environment (do NOT put it in client .env).
// Adjust REST payload per current Google Generative Language docs.

const express = require('express');
const fetch = require('node-fetch'); // or use global fetch in Node 18+
const cors = require('cors');
const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) console.warn('GEMINI_API_KEY not set.');

app.post('/api/generate', async (req, res) => {
    try {
        const { base64Image, prompt } = req.body;
        if (!prompt) return res.status(400).json({ error: 'Missing prompt' });

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;

        // Example body — adapt to latest GenAI REST shape if required
        const body = {
            prompt: {
                text: prompt
            },
            // include image inline if API supports it; otherwise send only prompt and adjust server logic
            image: base64Image ? { mimeType: 'image/jpeg', data: base64Image } : undefined
        };

        const r = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        const text = await r.text();
        if (!r.ok) return res.status(r.status).send(text);

        try {
            const parsed = JSON.parse(text);
            // Optionally extract structured fields here and return { data: {...} }
            return res.json(parsed);
        } catch (e) {
            return res.send(text);
        }
    } catch (err) {
        console.error('Generate proxy error', err);
        return res.status(500).json({ error: String(err) });
    }
});

if (require.main === module) {
    const port = process.env.PORT || 3001;
    app.listen(port, () => console.log(`Generate proxy running on port ${port}`));
}

module.exports = app;