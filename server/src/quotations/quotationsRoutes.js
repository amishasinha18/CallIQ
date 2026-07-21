'use strict';

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const repos = require('../db/repositories');
const emitter = require('../sockets/emitter');
const { renderQuotationPdf } = require('./pdf');
const { requireAuth, requireRole } = require('../auth/authMiddleware');

const router = express.Router();

function canView(quotation, user) {
    if (user.role === 'customer') return quotation.customer_id === user.sub;
    if (user.role === 'agent') return quotation.agent_id === user.sub;
    return true; // admin
}

// List: admin sees all, agent sees the ones they created, customer sees the ones sent to them.
router.get('/', requireAuth, requireRole('admin', 'agent', 'customer'), (req, res) => {
    let list = repos.quotations.all();
    if (req.user.role === 'agent') list = list.filter((q) => q.agent_id === req.user.sub);
    if (req.user.role === 'customer') list = list.filter((q) => q.customer_id === req.user.sub);
    res.json(list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
});

/**
 * Generates a quotation from a past call (`callLogId`) or from a live chat
 * (`chatId` — a chat is already scoped to one product/customer, so no call
 * log is needed). Marked "sent"; there's no SMTP wired up, so "sent" means
 * the record exists and is retrievable/downloadable, not that it was
 * actually emailed.
 */
router.post('/', requireAuth, requireRole('agent'), (req, res) => {
    const { callLogId, chatId } = req.body;

    let productId;
    let customerId;
    let sourceChatId = null;

    if (callLogId) {
        const log = repos.callLogs.findById(callLogId);
        if (!log || log.agent_id !== req.user.sub) return res.status(404).json({ error: 'Call log not found' });
        productId = log.product_id;
        customerId = log.customer_id;
    } else if (chatId) {
        const chat = repos.chats.findById(chatId);
        if (!chat || chat.agent_id !== req.user.sub) return res.status(404).json({ error: 'Chat not found' });
        productId = chat.product_id;
        customerId = chat.customer_id;
        sourceChatId = chatId;
    } else {
        return res.status(400).json({ error: 'callLogId or chatId is required' });
    }

    const product = repos.products.findById(productId);
    const customer = repos.customers.findById(customerId);
    if (!product || !customer) return res.status(404).json({ error: 'Product or customer not found' });

    const quotation = repos.quotations.insert({
        id: `quote-${uuidv4()}`,
        call_log_id: callLogId || null,
        chat_id: sourceChatId,
        agent_id: req.user.sub,
        customer_id: customer.id,
        customer_name: customer.name,
        product_id: product.id,
        product_name: product.name,
        product_description: product.description,
        price: product.price,
        created_at: new Date().toISOString(),
        sent: true,
        sent_at: new Date().toISOString(),
        status: 'pending', // pending | accepted | rejected
    });

    emitter.emitToUser('customer', customer.id, 'quotation:new', quotation);

    if (sourceChatId) {
        // Render as a real chat message (persisted, shows in the thread for both parties).
        const message = repos.chatMessages.insert({
            id: `msg-${uuidv4()}`,
            chat_id: sourceChatId,
            sender_role: 'agent',
            sender_id: req.user.sub,
            sender_name: req.user.name,
            type: 'quotation',
            quotation_id: quotation.id,
            text: `Sent a quotation for ${product.name}`,
            created_at: new Date().toISOString(),
        });
        emitter.emitToUser('customer', customer.id, 'chat:message', { ...message, quotation });
        emitter.emitToUser('agent', req.user.sub, 'chat:message', { ...message, quotation });
    }

    res.status(201).json(quotation);
});

router.get('/:id', requireAuth, requireRole('admin', 'agent', 'customer'), (req, res) => {
    const quotation = repos.quotations.findById(req.params.id);
    if (!quotation) return res.status(404).json({ error: 'Quotation not found' });
    if (!canView(quotation, req.user)) return res.status(403).json({ error: 'Forbidden' });
    res.json(quotation);
});

router.get('/:id/pdf', requireAuth, requireRole('admin', 'agent', 'customer'), (req, res) => {
    const quotation = repos.quotations.findById(req.params.id);
    if (!quotation) return res.status(404).json({ error: 'Quotation not found' });
    if (!canView(quotation, req.user)) return res.status(403).json({ error: 'Forbidden' });
    renderQuotationPdf(quotation, res);
});

function respondToQuotation(status) {
    return (req, res) => {
        const quotation = repos.quotations.findById(req.params.id);
        if (!quotation || quotation.customer_id !== req.user.sub) {
            return res.status(404).json({ error: 'Quotation not found' });
        }
        if (quotation.status !== 'pending') {
            return res.status(409).json({ error: `Quotation already ${quotation.status}` });
        }
        const updated = repos.quotations.updateById(req.params.id, { status });
        emitter.emitToUser('agent', quotation.agent_id, `quotation:${status}`, updated);
        if (quotation.chat_id) {
            emitter.emitToUser('agent', quotation.agent_id, 'chat:quotationUpdated', { chatId: quotation.chat_id, quotation: updated });
        }
        res.json(updated);
    };
}

router.post('/:id/accept', requireAuth, requireRole('customer'), respondToQuotation('accepted'));
router.post('/:id/reject', requireAuth, requireRole('customer'), respondToQuotation('rejected'));

module.exports = router;
