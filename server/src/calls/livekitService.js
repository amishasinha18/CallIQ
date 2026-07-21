'use strict';

const { AccessToken, RoomServiceClient } = require('livekit-server-sdk');
const env = require('../config/env');

const roomService = new RoomServiceClient(env.livekitHttpUrl, env.livekitApiKey, env.livekitApiSecret);

const mainRoom = (callId) => `call-${callId}`;
const whisperRoom = (callId) => `call-${callId}-whisper`;

/**
 * Every LiveKit room name/token in this service derives from the callId
 * assigned by callService — there is no separate "LiveKit room registry".
 */
async function buildToken({ identity, name, room, canPublish, canSubscribe, hidden = false }) {
    const at = new AccessToken(env.livekitApiKey, env.livekitApiSecret, { identity, name, ttl: '4h' });
    at.addGrant({ roomJoin: true, room, canPublish, canSubscribe, hidden });
    return at.toJwt();
}

/** Customer / agent join the main call room as normal, visible participants. */
function customerToken(callId, customer) {
    return buildToken({
        identity: `customer:${customer.id}`,
        name: customer.name,
        room: mainRoom(callId),
        canPublish: true,
        canSubscribe: true,
    });
}

function agentToken(callId, agent) {
    return buildToken({
        identity: `agent:${agent.id}`,
        name: agent.name,
        room: mainRoom(callId),
        canPublish: true,
        canSubscribe: true,
    });
}

/** Listen: admin joins the main room hidden, subscribe-only — silent monitor. */
function adminListenToken(callId, admin) {
    return buildToken({
        identity: `admin:${admin.id}`,
        name: admin.name,
        room: mainRoom(callId),
        canPublish: false,
        canSubscribe: true,
        hidden: true,
    });
}

/** Barge: admin joins the main room fully — visible 3-way conference. */
function adminBargeToken(callId, admin) {
    return buildToken({
        identity: `admin:${admin.id}`,
        name: admin.name,
        room: mainRoom(callId),
        canPublish: true,
        canSubscribe: true,
    });
}

/**
 * Whisper: admin speaks to the agent only, customer never hears it.
 * Modeled as a second, small room (admin + agent) rather than a single
 * shared room with per-track subscriber ACLs — simpler to reason about
 * and the agent client just holds two concurrent Room connections.
 */
function adminWhisperToken(callId, admin) {
    return buildToken({
        // Distinct from the main-room identity: the agent's browser holds two concurrent
        // Room connections (main call + whisper) in one tab.
        identity: `admin:${admin.id}:whisper`,
        name: admin.name,
        room: whisperRoom(callId),
        canPublish: true,
        canSubscribe: true,
        // NOT hidden: `hidden` suppresses participant-announce signaling to other hidden
        // participants while the SFU still forwards the media track — with both sides
        // hidden here, that's exactly what silently dropped every whisper track ("Tried
        // to add a track for a participant, that's not present"). The whisper room is
        // already private by being a separate room the customer never joins; there's no
        // second layer of hiding needed inside it.
    });
}

function agentWhisperToken(callId, agent) {
    return buildToken({
        identity: `agent:${agent.id}:whisper`,
        name: agent.name,
        room: whisperRoom(callId),
        canPublish: false,
        canSubscribe: true,
    });
}

/** Force-hangup / normal call teardown: deleting the room disconnects everyone. */
async function teardownRooms(callId) {
    await Promise.allSettled([
        roomService.deleteRoom(mainRoom(callId)),
        roomService.deleteRoom(whisperRoom(callId)),
    ]);
}

/**
 * Flip the agent's publish permission in the whisper room live, without a new
 * token or reconnect. The agent's whisper-room grant is always `canPublish:
 * false` at connect time (see agentWhisperToken) — this is the only way they
 * can ever actually speak into it, and only for as long as a whisper is
 * server-acknowledged as active, so a modified client can't self-unmute.
 *
 * `updateParticipant`'s permission argument REPLACES the participant's whole
 * ParticipantPermission, it does not merge — so `canSubscribe: true` must be
 * repeated here every time, or the agent would silently lose the ability to
 * hear the admin the moment this is called.
 */
async function setAgentWhisperPublish(callId, agentIdentity, canPublish) {
    await roomService.updateParticipant(whisperRoom(callId), agentIdentity, undefined, {
        canSubscribe: true,
        canPublish,
    });
}

module.exports = {
    mainRoom,
    whisperRoom,
    customerToken,
    agentToken,
    adminListenToken,
    adminBargeToken,
    adminWhisperToken,
    agentWhisperToken,
    setAgentWhisperPublish,
    teardownRooms,
    roomService,
};
