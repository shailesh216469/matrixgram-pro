const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.set('trust proxy', true);
app.use(express.json());
app.use(cors());

const TOKEN = process.env.MATRIX_ADMIN_TOKEN;
const ROOM = process.env.MATRIX_ROOM_ID;
const BASE_URL = "https://matrix.org/_matrix/client/r0";

// Simple in-memory user store (Reset on restart)
const users = {}; 

app.post('/api/register', (req, res) => {
    const { username, password } = req.body;
    if (users[username]) return res.status(400).json({ error: "Exists" });
    users[username] = password;
    res.json({ success: true });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (users[username] === password) res.json({ success: true });
    else res.status(401).json({ error: "Invalid" });
});

app.get('/api/feed', async (req, res) => {
    try {
        const response = await axios.get(`${BASE_URL}/rooms/${encodeURIComponent(ROOM)}/messages?limit=1000&dir=b&access_token=${TOKEN}`);
        const cleanPosts = response.data.chunk
            .filter(m => m.type === "m.room.message" && m.content.body)
            .map(m => ({
                id: m.event_id,
                user: m.sender.split(':')[0].replace('@',''),
                text: m.content.body,
                time: m.origin_server_ts
            }));
        res.json(cleanPosts);
    } catch (err) { res.status(500).json({ error: "Sync Failed" }); }
});

app.post('/api/share', async (req, res) => {
    try {
        const { username, message } = req.body;
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        await axios.post(`${BASE_URL}/rooms/${encodeURIComponent(ROOM)}/send/m.room.message?access_token=${TOKEN}`, {
            body: `${username} [IP:${ip}]: ${message}`,
            msgtype: "m.text"
        });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "Post Failed" }); }
});

app.delete('/api/delete/:eventId', async (req, res) => {
    try {
        await axios.put(`${BASE_URL}/rooms/${encodeURIComponent(ROOM)}/redact/${req.params.eventId}/${Date.now()}?access_token=${TOKEN}`, {});
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "Delete Failed" }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Stealth Server active on ${PORT}`));