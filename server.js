const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors()); // Allows your website to talk to this server

const TOKEN = process.env.MATRIX_ADMIN_TOKEN;
const ROOM = process.env.MATRIX_ROOM_ID;
const BASE_URL = "https://matrix.org/_matrix/client/r0";

// 1. The Stealth Feed API
app.get('/api/feed', async (req, res) => {
    try {
        const response = await axios.get(`${BASE_URL}/rooms/${encodeURIComponent(ROOM)}/messages?limit=50&dir=b&access_token=${TOKEN}`);
        
        // We "Clean" the data: only send back what the user needs
        const cleanPosts = response.data.chunk
            .filter(m => m.type === "m.room.message" && m.content.body)
            .map(m => ({
                id: m.event_id,
                user: m.sender.split(':')[0].replace('@',''),
                text: m.content.body,
                time: m.origin_server_ts
            }));
        res.json(cleanPosts);
    } catch (err) {
        res.status(500).json({ error: "Shield: Feed Blocked" });
    }
});

// 2. The Stealth Post API
app.post('/api/share', async (req, res) => {
    try {
        const { username, message } = req.body;
        // The server posts using YOUR Admin authority
        await axios.post(`${BASE_URL}/rooms/${encodeURIComponent(ROOM)}/send/m.room.message?access_token=${TOKEN}`, {
            body: `${username}: ${message}`,
            msgtype: "m.text"
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Shield: Posting Blocked" });
    }
});

app.listen(process.env.PORT, () => console.log("Shield Active on Port " + process.env.PORT));
