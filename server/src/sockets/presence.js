'use strict';

/** Tracks which socket currently belongs to which authenticated user. */
const socketByUser = new Map(); // `${role}:${id}` -> socket.id
const userBySocket = new Map(); // socket.id -> `${role}:${id}`

function key(role, id) {
    return `${role}:${id}`;
}

function register(role, id, socketId) {
    socketByUser.set(key(role, id), socketId);
    userBySocket.set(socketId, key(role, id));
}

function unregister(socketId) {
    const userKey = userBySocket.get(socketId);
    if (userKey) {
        socketByUser.delete(userKey);
        userBySocket.delete(socketId);
    }
    return userKey || null;
}

function getSocketId(role, id) {
    return socketByUser.get(key(role, id)) || null;
}

module.exports = { register, unregister, getSocketId };
