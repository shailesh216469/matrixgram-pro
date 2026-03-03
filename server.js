const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

const TOKEN = process.env.MATRIX_ADMIN_TOKEN;
const ROOM = process.env.MATRIX_ROOM_ID;
const BASE_URL = "https://matrix.org/_matrix/client/r0";

// Simple "Database" in memory
const users = {}; 

// Registration API
app.post('/api/register', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Missing fields" });
    if (users[username]) return res.status(400).json({ error: "User exists" });
    
    users[username] = password;
    res.json({ success: true });
});

// Login API
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (users[username] === password) {
        res.json({ success: true });
    } else {
        res.status(401).json({ error: "Invalid login" });
    }
});

// Stealth Feed API
app.get('/api/feed', async (req, res) => {
    try {
        const response = await axios.get(`${BASE_URL}/rooms/${encodeURIComponent(ROOM)}/messages?limit=50&dir=b&access_token=${TOKEN}`);
        const cleanPosts = response.data.chunk
            .filter(m => m.type === "m.room.message" && m.content.body)
            .map(m => ({
                user: m.sender.split(':')[0].replace('@',''),
                text: m.content.body,
                time: m.origin_server_ts
            }));
        res.json(cleanPosts);
    } catch (err) {
        res.status(500).json({ error: "Shield: Feed Blocked" });
    }
});

// Stealth Post API
app.post('/api/share', async (req, res) => {
    try {
        const { username, message } = req.body;
        await axios.post(`${BASE_URL}/rooms/${encodeURIComponent(ROOM)}/send/m.room.message?access_token=${TOKEN}`, {
            body: `${username}: ${message}`,
            msgtype: "m.text"
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Shield: Posting Blocked" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Shield Online"));
