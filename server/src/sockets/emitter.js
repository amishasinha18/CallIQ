'use strict';

const presence = require('./presence');

let io = null;
function init(ioInstance) {
    io = ioInstance;
}

/** Lets plain REST routes (e.g. quotations) push a real-time event to a specific user, if online. */
function emitToUser(role, id, event, payload) {
    const socketId = presence.getSocketId(role, id);
    if (socketId && io) io.to(socketId).emit(event, payload);
}

module.exports = { init, emitToUser };
