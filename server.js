const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();

// CRITICAL: Tells Express to trust the Render/Cloudflare proxy.
// This ensures req.headers['x-forwarded-for'] contains the REAL user IP.
app.set('trust proxy', true); 

app.use(express.json());
app.use(cors());

// Configuration from your .env file
const TOKEN = process.env.MATRIX_ADMIN_TOKEN;
const ROOM = process.env.MATRIX_ROOM_ID;
const BASE_URL = "https://matrix.org/_matrix/client/r0";

// In-memory user store (Resets if server restarts)
// For 200 users, consider moving this to a file or Matrix account data later.
const users = {}; 

// --- AUTH ROUTES ---

app.post('/api/register', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Missing fields" });
    if (users[username]) return res.status(400).json({ error: "User already exists" });
    
    users[username] = password;
    console.log(`New User Registered: ${username}`);
    res.json({ success: true });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (users[username] === password) {
        res.json({ success: true });
    } else {
        res.status(401).json({ error: "Invalid credentials" });
    }
});

// --- FEED ROUTE ---

app.get('/api/feed', async (req, res) => {
    try {
        // limit=500 ensures that system signals (Likes, Reads, Profiles) 
        // don't "push out" the actual chat messages from the response.
        const response = await axios.get(
            `${BASE_URL}/rooms/${encodeURIComponent(ROOM)}/messages?limit=500&dir=b&access_token=${TOKEN}`
        );

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
        console.error("Matrix Feed Error:", err.message);
        res.status(500).json({ error: "Could not fetch feed" });
    }
});

// --- SHARE ROUTE (The IP Logger) ---

app.post('/api/share', async (req, res) => {
    try {
        const { username, message } = req.body;
        
        // Capture the real IP address
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        
        // Format: Username [IP:1.2.3.4]: Message
        // This keeps the IP metadata hidden inside the message body for the Admin to see.
        const bodyWithMetadata = `${username} [IP:${ip}]: ${message}`;

        await axios.post(
            `${BASE_URL}/rooms/${encodeURIComponent(ROOM)}/send/m.room.message?access_token=${TOKEN}`, 
            {
                body: bodyWithMetadata,
                msgtype: "m.text"
            }
        );

        res.json({ success: true });
    } catch (err) {
        console.error("Matrix Post Error:", err.message);
        res.status(500).json({ error: "Could not post message" });
    }
});

// --- DELETE ROUTE (Admin Redaction) ---

app.delete('/api/delete/:eventId', async (req, res) => {
    try {
        const { eventId } = req.params;
        // Matrix Redaction: Permanently removes the message from the server
        await axios.put(
            `${BASE_URL}/rooms/${encodeURIComponent(ROOM)}/redact/${eventId}/${Date.now()}?access_token=${TOKEN}`, 
            {}
        );
        res.json({ success: true });
    } catch (err) {
        console.error("Matrix Redact Error:", err.message);
        res.status(500).json({ error: "Could not delete message" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`--------------------------------------`);
    console.log(`SHIELD ONLINE - Port: ${PORT}`);
    console.log(`Matrix Room: ${ROOM}`);
    console.log(`Trust Proxy: ENABLED`);
    console.log(`--------------------------------------`);
});
