'use strict';

const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const env = require('./config/env');

// Without JWT_SECRET the server still boots and /health still answers, but every login
// throws inside jsonwebtoken ("secretOrPrivateKey must have a value") and comes back as
// a 500. Say so at startup, where it is obvious, instead of at the first login attempt.
// A warning rather than an exit, so a deployment that is up today stays up.
if (!env.jwtSecret) {
    console.warn('[CallIQ] JWT_SECRET is not set - logins will fail. '
        + 'Copy server/.env.example to server/.env and set it.');
}

const authRoutes = require('./auth/authRoutes');
const productsRoutes = require('./products/productsRoutes');
const agentsRoutes = require('./agents/agentsRoutes');
const callsRoutes = require('./calls/callsRoutes');
const quotationsRoutes = require('./quotations/quotationsRoutes');
const chatsRoutes = require('./chats/chatsRoutes');
const adminRoutes = require('./admin/adminRoutes');
const registerSocketHandlers = require('./sockets/socketHandlers');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: env.corsOrigin, methods: ['GET', 'POST'] },
});

app.use(cors({ origin: env.corsOrigin }));
app.use(express.json());

app.get('/health', (req, res) => res.json({ ok: true }));

app.use('/auth', authRoutes);
app.use('/products', productsRoutes);
app.use('/agents', agentsRoutes);
app.use('/calls', callsRoutes);
app.use('/quotations', quotationsRoutes);
app.use('/chats', chatsRoutes);
app.use('/admin', adminRoutes);

app.use(errorHandler);

registerSocketHandlers(io);

server.listen(env.port, () => {
    console.log(`\nContact Center API + signaling running on http://localhost:${env.port}\n`);
});
