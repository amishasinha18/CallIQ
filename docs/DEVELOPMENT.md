# CallIQ — Engineering Notes

Real-time WebRTC contact center: customers see per-product Call and Text
buttons (Text only appears if an assigned agent is online) and get routed to
the longest-idle assigned agent for calls, or ring-all/first-to-accept for
chats. If nobody's available for a call, they hear hold music for a few
seconds and it ends — there is no waiting room. Admins can
Listen/Whisper/Barge/Hangup live calls from an analytics dashboard.

## Services

| Service   | Path      | Port  | Notes                                             |
|-----------|-----------|-------|----------------------------------------------------|
| LiveKit   | `livekit/`| 7880  | Self-hosted SFU, dev mode, keys `devkey`/`secret`  |
| Backend   | `server/` | 4100  | Express + Socket.io signaling/API                  |
| Frontend  | `web/`    | 4200  | Next.js (App Router) + Tailwind + Zustand          |
| Redis     | system    | 6379  | Agent idle-ranking (no queue anymore)              |
| Data      | `db/`     | —     | JSON-file mock DB (see below)                      |
| Recordings| `recordings/` | — | Client-recorded call audio, uploaded on hangup |

Ports 3000/3010/4000/5000/5173/5174 are already in use by other apps on this
box — that's why the backend runs on 4100 and the frontend on 4200.

## Running it

All three services run under pm2 (`ecosystem.config.js` at the repo root):

```bash
pm2 start ecosystem.config.js   # first time
pm2 restart cc-livekit cc-server cc-web   # after changing .env / .env.local
pm2 logs cc-server               # tail logs for one service
pm2 list                         # status
```

Local: http://localhost:4200. Public link (Cloudflare quick tunnels, see
caveat below): https://cet-jackson-cards-dvd.trycloudflare.com

Three separate `cloudflared tunnel --url http://localhost:<port>` processes
(4200 web, 4100 backend, 7880 LiveKit) are running outside pm2 — quick
tunnels hand out a **new random URL every time they restart, and can drop
on their own with no warning** (has happened repeatedly during development,
sometimes all three at once). Putting them under pm2's auto-restart would
silently break shared links, so they're managed manually. If a tunnel dies
(`curl` the URL — a Cloudflare 530 means it's dead, or a DNS resolution
failure means it's gone entirely), restart it and update `web/.env.local` /
`server/.env` (`NEXT_PUBLIC_API_URL`/`NEXT_PUBLIC_LIVEKIT_URL`,
`LIVEKIT_URL`, `CORS_ORIGIN` — `CORS_ORIGIN` is comma-separated and must
keep `http://localhost:4200` in the list for local dev to keep working),
then `pm2 restart cc-server cc-web`.

**Public link caveat**: login, product grid, routing, chat, admin dashboard,
disposition, quotation (PDF included), feedback, and recording playback all
work fully over the public link. Live audio/video is verified working for
this environment, but has not been proven from a genuinely different
network — this self-hosted LiveKit has no TURN relay configured (the TURN
server already running on this box belongs to an unrelated project and
wasn't reused), so a visitor behind restrictive NAT/firewall may fail to
establish the media connection even though everything else works. This box
is also shared with several unrelated projects competing for CPU/memory —
expect occasional transient WebRTC connection hiccups under load; that's
environmental, not a platform bug.

## Login

**One unified login** — no role picker. `POST /auth/login` takes just
`{ email, password }` and searches admins → agents → customers by email
(unique across the whole platform in the seed data) to figure out the role
itself; the frontend redirects based on whatever role comes back. The
landing page (`/`) is a single-page CallIQ marketing site with Login/Sign Up
as modals — Sign Up is customer self-registration only, exactly as before;
agent/admin accounts are still admin-provisioned.

## Seed accounts

| Role     | Email                | Password    |
|----------|-----------------------|-------------|
| Admin    | admin@platform.com    | admin@123   |
| Agent    | agc1@gmail.com        | 123456      |
| Agent    | agc2@gmail.com        | 123456      |
| Customer | amisha@gmail.com      | 123456      |
| Customer | stark@gkmail.com      | 123456      |
| Customer | tesla@gmail.com       | 123456      |

An agent must set their status to **Available** before they can receive calls.

## Text chat

Parallel to voice: `db/chats/{chats,messages}.json`, `server/src/chats/`.
Ring-all broadcasts a `chat:request` to every online agent assigned to the
product; first `chat:accept` wins via a Redis `SET NX` lock, everyone else
gets `chat:claimed` (retracted from their pending list) or a "Already
claimed" error if they raced the same click. The customer's own widget opens
immediately in a waiting state (`chat:pending`, echoed back to them) and a
`chat:cancel` event lets them withdraw before anyone accepts. Transfer is
restricted server-side to online agents assigned to the exact same product.
Lifecycle is `PENDING → ASSIGNED → ACTIVE → CLOSED` (flips to ACTIVE on the
first message). **"Online" for chat reuses the exact same agent status**
(available/break/offline/busy) calls use — one presence model per agent,
not a separate one per channel, so an agent mid-call won't show up as
chat-eligible either.

## Quotations

Generated from a past call (agent's call-detail page) or from inside a live
chat ("Send Quotation" button — renders as a card in both parties' thread).
Lifecycle is `pending → accepted/rejected`, customer-actioned from either
"My Quotations" or the chat card itself; the agent gets a real-time
`quotation:accepted`/`rejected` push either way. Every quotation can be
downloaded as a PDF (`GET /quotations/:id/pdf`, `pdfkit`) — standard
layout (issuer header, line item, GST 18%, total, terms). **Issuer details
are placeholders** ("CallIQ Technologies Pvt. Ltd.", sample GSTIN) — swap
`server/src/quotations/pdf.js`'s `COMPANY` object for the real registered
business before this leaves demo status. There's still no SMTP wired up, so
"sent" means retrievable/downloadable, not emailed.

## Admin dashboard

`GET /admin/stats` aggregates calls-today, chats-today, avg call duration,
completion rate, a 7-day call-volume trend, disposition breakdown, live
agent-status breakdown, and avg customer feedback rating — all computed
from the JSON repos on request (fine at this scale; revisit if `db/`
outgrows in-request aggregation). Charts are `recharts`, built per the
`dataviz` skill's method (validated palette, status colors reserved for
state, one hue for magnitude, direct labels, dark mode independently
validated — see `references/palette.md` in that skill for the exact hex
values in use).

## Feedback

Customer-side, optional, shown when a call ends (`app/customer/page.js`
watches `callStore.status === 'ended'`, mirroring how the agent's mandatory
disposition modal is triggered). Four fixed 1–5 star parameters (Agent
Professionalism, Call Quality, Issue Resolution, Overall Experience) plus a
comment, `POST /calls/:id/feedback`, one per call. Skippable — not mandatory
like the agent's disposition.

## Data layer

`db/` is a JSON-file mock database (see `server/src/db/`), not real
PostgreSQL — swap `JsonCollection` for a Prisma repository later without
touching route/service code. Passwords are plaintext in this mock layer;
`authService.verifyPassword` accepts either plaintext or a bcrypt hash, but
anything written going forward (signup, admin-created agents, password
resets) is bcrypt-hashed. Hash the seed passwords too before this touches
real users.

## Known limitations / next steps

- **Outdial** only rings a customer who has an active browser session —
  there's no PSTN/SIP trunk, so it can't call a phone number.
- **Whisper was broken and is now fixed** — root cause was the
  `hidden: true` grant on *both* whisper-room participants. LiveKit's
  `hidden` flag suppresses participant-announce signaling to other hidden
  participants while the SFU still forwards the raw media track, so the
  agent's client received a WebRTC track it could never map to a known
  participant and silently dropped it (logged as "Tried to add a track for
  a participant, that's not present"). Fixed by removing `hidden` from the
  whisper grants (`server/src/calls/livekitService.js`) — the whisper room
  is already private by virtue of being a separate room the customer never
  joins, so no second layer of hiding was needed inside it. Also
  restructured so the agent joins the whisper room silently the moment the
  call connects (not only when an admin requests whisper), so a later
  whisper join is the well-tested "existing participant, new arrival" path.
- **Call window** no longer has LiveKit's built-in Chat button (redundant
  with the platform's own chat) — replaced `<VideoConference/>` with a
  hand-built layout (`components/CallStage.js`: `useTracks` + `GridLayout` +
  `ParticipantTile` + a `ControlBar` with `chat`/`leave`/`settings` off) that
  also adds a live call-duration timer.
- **Quotation "send"** creates a retrievable/downloadable record (PDF
  included) but isn't emailed — no SMTP service is wired up.
- **Call state is in-memory**, single Node process — fine for one instance;
  move active-call state into Redis before running multiple backend
  instances behind a load balancer.
- **Recordings are client-side**: the agent's browser mixes its own mic with
  every remote participant's audio via Web Audio, records that with
  MediaRecorder, and uploads the `.webm` on hangup — there's no
  server-side LiveKit Egress. If the agent's tab crashes mid-call, the
  recording is lost. Admin and agent can both play it back from the UI.
- **No waiting room**: if nobody's available, the customer hears ~8s of a
  generated hold tone (Web Audio oscillator, not a licensed audio asset)
  and the attempt is logged as `no_agent_available` — they must click
  "Call" again themselves, there's no auto-callback.
- **Chat has no persistence-across-reload UI wiring yet**: `GET /chats/:id/messages`
  exists for it, but the frontend doesn't call it on mount — refreshing
  mid-chat loses the visible thread from the store (messages are still safe
  in `db/chats/messages.json`, just not re-fetched into the UI).
- **One socket, shared by design**: `web/lib/socketClient.js` hands out a
  single memoized socket.io connection to every hook (`useCallSocket`,
  `useChatSocket`) — don't add a new hook that recreates it based on
  `.connected` state; that exact bug (a second hook tearing down the first
  hook's in-flight connection) silently broke every button that emits a
  socket event until it was found and fixed.
- **`next.config.js` has `reactStrictMode: false`** — turned off while
  chasing the whisper bug (a red herring at the time, since the real cause
  was the `hidden` grant), but left off because @livekit/components-react's
  `LiveKitRoom` manages an imperative WebRTC connection that isn't
  idempotent under Strict Mode's dev-only double-invoke of effects.
