const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

const TOKEN = process.env.MATRIX_ADMIN_TOKEN;
const FEED_ROOM = process.env.MATRIX_ROOM_ID; 
const DATA_ROOM = process.env.MATRIX_METADATA_ROOM_ID;
const BASE_URL = "https://matrix.org/_matrix/client/r0";

app.get('/api/sync', async (req, res) => {
    try {
        const [f, d] = await Promise.all([
            axios.get(`${BASE_URL}/rooms/${encodeURIComponent(FEED_ROOM)}/messages?limit=500&dir=b&access_token=${TOKEN}`),
            axios.get(`${BASE_URL}/rooms/${encodeURIComponent(DATA_ROOM)}/messages?limit=1000&dir=b&access_token=${TOKEN}`)
        ]);
        const feed = f.data.chunk.filter(m => m.type === "m.room.message" && m.content.body).map(m => ({
            id: m.event_id, user: m.sender.split(':')[0].replace('@',''), text: m.content.body
        }));
        res.json({ feed, metadata: d.data.chunk.map(m => m.content.body) });
    } catch (err) { res.status(500).json({ error: "Sync failed" }); }
});

app.post('/api/share', async (req, res) => {
    try {
        const { username, message, isSystem } = req.body;
        const target = isSystem ? DATA_ROOM : FEED_ROOM;
        const body = isSystem ? message : `${username} [IP:Hidden]: ${message}`;
        await axios.post(`${BASE_URL}/rooms/${encodeURIComponent(target)}/send/m.room.message?access_token=${TOKEN}`, { body, msgtype: "m.text" });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "Post failed" }); }
});

app.delete('/api/delete/:id', async (req, res) => {
    try {
        await axios.put(`${BASE_URL}/rooms/${encodeURIComponent(FEED_ROOM)}/redact/${req.params.id}/${Date.now()}?access_token=${TOKEN}`, {});
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "Fail" }); }
});

app.post('/api/admin/purge', async (req, res) => {
    try {
        const r = await axios.get(`${BASE_URL}/rooms/${encodeURIComponent(FEED_ROOM)}/messages?limit=1000&dir=b&access_token=${TOKEN}`);
        const ghosts = r.data.chunk.filter(m => (m.content.body || "").startsWith("[") || m.sender.includes("SYS_"));
        for (let g of ghosts) { await axios.put(`${BASE_URL}/rooms/${encodeURIComponent(FEED_ROOM)}/redact/${g.event_id}/${Date.now()}?access_token=${TOKEN}`, {}); }
        res.json({ success: true, count: ghosts.length });
    } catch (err) { res.status(500).json({ error: "Purge failed" }); }
});

app.listen(process.env.PORT || 3000, () => console.log("Shield Active"));
