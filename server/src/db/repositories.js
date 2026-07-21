'use strict';

const { PgCollection } = require('./pgCollection');

module.exports = {
    admins: new PgCollection('admins'),
    agents: new PgCollection('agents'),
    customers: new PgCollection('customers'),

    products: new PgCollection('products'),
    agentAssignments: new PgCollection('agent_assignments'),

    callLogs: new PgCollection('call_logs'),
    dispositions: new PgCollection('dispositions'),
    quotations: new PgCollection('quotations'),
    feedback: new PgCollection('feedback'),

    chats: new PgCollection('chats'),
    chatMessages: new PgCollection('messages'),
};
