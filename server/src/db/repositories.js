'use strict';

const path = require('path');
const env = require('../config/env');
const JsonCollection = require('./jsonCollection');

const p = (...parts) => path.join(env.dbDir, ...parts);

module.exports = {
    admins: new JsonCollection(p('users', 'admins.json')),
    agents: new JsonCollection(p('users', 'agents.json')),
    customers: new JsonCollection(p('users', 'customers.json')),

    products: new JsonCollection(p('products', 'products.json')),
    agentAssignments: new JsonCollection(p('products', 'agent_assignments.json')),

    callLogs: new JsonCollection(p('calls', 'call_logs.json')),
    dispositions: new JsonCollection(p('calls', 'dispositions.json')),
    quotations: new JsonCollection(p('calls', 'quotations.json')),
    feedback: new JsonCollection(p('calls', 'feedback.json')),

    chats: new JsonCollection(p('chats', 'chats.json')),
    chatMessages: new JsonCollection(p('chats', 'messages.json')),
};
