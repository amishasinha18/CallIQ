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
| Backend   | `server/` | 4100  | Express + Socket.io signaling/API                  |
| Frontend  | `web/`    | 4200  | Next.js (App Router) + Tailwind + Zustand          |
| Database  | Supabase  | —     | Managed Postgres — see `server/db/schema.sql`      |
| Storage   | Supabase  | —     | Two buckets: `recordings` (private), `product-images` (public) |
| Redis     | Upstash   | —     | Agent idle-ranking / presence (TLS, `rediss://`)   |
| WebRTC    | LiveKit Cloud | — | Managed SFU — no self-hosted media server anymore  |

There is no local self-hosted infrastructure left to run — every backing
service above is a managed cloud product, and local dev connects to the same
Supabase/LiveKit Cloud/Upstash projects as the deployed app. The repo still
has a `livekit/` directory and an `ecosystem.config.js` `cc-livekit` pm2 app
from an earlier self-hosted-LiveKit iteration — both are unused/vestigial
now and safe to ignore (or delete, if you want to tidy up).

## Running it locally

```bash
cp server/.env.example server/.env        # fill in real Supabase/LiveKit Cloud/Upstash values
cd server && npm install
node scripts/migrate-to-postgres.js       # one-time: loads db/*.json into Postgres
cd ../web && npm install
cd .. && pm2 start ecosystem.config.js
pm2 restart cc-server cc-web              # after changing .env / .env.local
pm2 logs cc-server                        # tail logs for one service
```

`server/.env` requires `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
`REDIS_URL`, `LIVEKIT_URL`, `LIVEKIT_HTTP_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`
— see the README's "Getting Started" table for where each one comes from.

**Supabase direct-connection gotcha**: `db.<project-ref>.supabase.co` (the
"direct connection" string Supabase shows first) resolves to an IPv6-only
address on the free tier. If your network/host has no IPv6 egress (this
bit us once), that connection fails with `ENETUNREACH`. Use the
**Connection pooling** URI instead (`aws-0-<region>.pooler.supabase.com`,
port 6543, username `postgres.<project-ref>`) — it's IPv4-compatible and is
what both local dev and the Render deploy should use.

## Login

**One unified login** — no role picker. `POST /auth/login` takes just
`{ email, password }` and searches admins → agents → customers by email
(unique across the whole platform in the seed data) to figure out the role
itself; the frontend redirects based on whatever role comes back. The
landing page (`/`) is a single-page CallIQ marketing site with Login/Sign Up
as modals — Sign Up is customer self-registration only; agent/admin accounts
are still admin-provisioned.

## Seed accounts

| Role     | Email                | Password    |
|----------|-----------------------|-------------|
| Admin    | admin@platform.com    | admin@123   |
| Admin    | admin@calliq.com      | Admin@1234  |
| Agent    | agc1@gmail.com        | 123456      |
| Agent    | agc2@gmail.com        | 123456      |
| Customer | amisha@gmail.com      | 123456      |
| Customer | stark@gkmail.com      | 123456      |
| Customer | tesla@gmail.com       | 123456      |

An agent must set their status to **Available** before they can receive calls.

## Live supervision (Listen / Whisper / Barge)

- **Listen**: admin joins the call's main LiveKit room hidden, subscribe-only
  — fully silent/invisible monitor, no server-side state to unwind on exit.
- **Barge**: admin joins the same room fully (publish+subscribe) as a visible
  third participant. Both customer and agent see an "A supervisor has joined
  this call" banner. Closing the modal now calls `POST /calls/:id/monitor/stop`
  (`mode: 'barge'`), which emits `call:supervisorLeft` to both parties so the
  banner actually clears — it used to stay up forever, since nothing ever told
  either side the admin had left.
- **Whisper**: admin joins a second, separate LiveKit room (`call-<id>-whisper`)
  that the agent silently joined the instant the call connected. Starting a
  whisper server-authoritatively flips the agent's publish permission on in
  that room (`RoomServiceClient.updateParticipant`, not a static token grant —
  so a modified client can't self-unmute), mutes the agent's mic in the main
  room (so the customer hears nothing), and puts the customer on an indefinite
  "You're on hold" screen (`OnHoldOverlay.js`). Closing the whisper modal calls
  `stop` the same way, which reverses all of it and resumes the normal call.
  This used to be one-way and had no stop path at all — see
  `server/src/calls/livekitService.js` / `callService.js` for the full
  start/stop implementation.
- **Historical whisper bug** (already fixed, keep the fix in mind if touching
  this code): both whisper-room participants originally had `hidden: true`
  grants. LiveKit's `hidden` flag suppresses participant-announce signaling to
  other hidden participants while the SFU still forwards the raw media track,
  so the agent's client received a WebRTC track it could never map to a known
  participant and silently dropped it. Fixed by removing `hidden` (the whisper
  room is already private by being a separate room the customer never joins)
  and having the agent join it silently at call-connect time rather than at
  whisper-request time, so a later admin join is a well-tested "existing
  participant, new arrival" path.

## Text chat

Parallel to voice: `chats`/`messages` tables, `server/src/chats/`.
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
agent-status breakdown, and avg customer feedback rating, computed on
request from Postgres. Charts are `recharts`, built per the `dataviz`
skill's method (validated palette, status colors reserved for state, one hue
for magnitude, direct labels, dark mode independently validated).

## Feedback

Customer-side, optional, shown when a call ends (`app/customer/page.js`
watches `callStore.status === 'ended'`, mirroring how the agent's mandatory
disposition modal is triggered). Four fixed 1–5 star parameters (Agent
Professionalism, Call Quality, Issue Resolution, Overall Experience) plus a
comment, `POST /calls/:id/feedback`, one per call. Skippable — not mandatory
like the agent's disposition. Feeds both the admin dashboard's aggregate
rating and each agent's own personalized stats panel.

## Product images

Admins upload a photo per product (create form or per-row "Upload image" in
`ProductsTab.js`); stored in the `product-images` Supabase Storage bucket
(public), served via `GET /products/:id/image`, which 302-redirects to the
object's public URL rather than proxying bytes through Express — the bucket
is public and non-sensitive, so there's no auth to gate. `ProductCard.js`
falls back to its original gradient-plus-initial placeholder if `image` is
null or the file 404s.

## Data layer

Postgres (Supabase), via `server/src/db/pgCollection.js` — a drop-in
replacement for the interface `JsonCollection` (still in the repo, unused)
used to expose: `all/find/findOne/findById/insert/updateById/removeById/
removeWhere`, now backed by a shared `pg.Pool` instead of a JSON file. Every
method is `async` (real network I/O), which is the one place this wasn't a
truly zero-diff swap — every route/service call site needed `await` added.

`db/*.json` is now a **historical snapshot only** — it's what
`server/scripts/migrate-to-postgres.js` reads to seed a fresh Postgres
database once; nothing in the running app reads those files anymore.

Two schema/migration gotchas worth knowing if you touch this again:
- **Circular-ish FKs** (`call_logs.disposition_id` ↔ `dispositions`,
  `messages.quotation_id` ↔ `quotations`): the JSON snapshot represents
  *final* state (both sides already linked), but the migration script
  inserts in a fixed dependency order — so those two FKs are declared
  `DEFERRABLE INITIALLY DEFERRED` in `server/db/schema.sql`, checked at
  transaction commit instead of per-statement.
- **JSONB array columns** (`chats.transfer_history`): `pg`'s default
  parameter serialization sends a raw JS array as a Postgres *array*
  literal (`{}` for an empty one), not JSON text — and `{}` happens to also
  be valid JSON (an empty object), so an empty array silently became an
  empty object once it landed in a `jsonb` column. Fixed by explicitly
  `JSON.stringify`-ing any object/array parameter value before binding it
  (`pgCollection.js`'s `serializeValue`, mirrored in the migration script).

Passwords: `authService.verifyPassword` accepts either plaintext or a bcrypt
hash, so the original plaintext seed passwords keep working; anything
written going forward (signup, admin-created agents, password resets, the
`admin@calliq.com` seed added later) is bcrypt-hashed.

## Deployment

Two Render web services, defined in `render.yaml` at the repo root —
`calliq-server` (Express/Socket.IO) and `calliq-web` (Next.js). See the
README's "Deployment" section for the click-through steps. Notable fixes
made specifically for Render's free tier:
- `web/package.json`'s `start` script was hardcoded to `-p 4200`; Render
  injects its own `$PORT` and expects the service to bind to it — fixed to
  `next start -p ${PORT:-4200}`.
- Both `package.json`s got `"engines": {"node": ">=20"}` so Render
  provisions a matching Node version.
- `@supabase/supabase-js`'s client always constructs a Realtime websocket
  client internally (even though this app only uses Storage), which throws
  on Node < 22 without the `ws` package explicitly provided as the
  transport — see `server/src/storage/supabaseStorage.js`. This would have
  crashed on Render's Node 20 runtime if left unfixed.
- Render's free-tier disks are ephemeral (wiped on every restart/redeploy) —
  this is *why* call recordings and product images live in Supabase Storage
  instead of local disk now, not just an incidental choice.

## Known limitations / next steps

- **Outdial** only rings a customer who has an active browser session —
  there's no PSTN/SIP trunk, so it can't call a phone number.
- **Call window** has no LiveKit built-in Chat button (redundant with the
  platform's own chat) — replaced `<VideoConference/>` with a hand-built
  layout (`components/CallStage.js`: `useTracks` + `GridLayout` +
  `ParticipantTile` + a `ControlBar` with `chat`/`leave`/`settings` off, and
  its `microphone` control gated off during an active whisper) that also
  adds a live call-duration timer.
- **Quotation "send"** creates a retrievable/downloadable record (PDF
  included) but isn't emailed — no SMTP service is wired up.
- **Call state is in-memory**, single Node process — fine for one instance;
  move active-call state into Redis before running multiple backend
  instances behind a load balancer.
- **Recordings are client-side**: the agent's browser mixes its own mic with
  every remote participant's audio via Web Audio, records that with
  MediaRecorder, and uploads the `.webm` to Supabase Storage on hangup —
  there's no server-side LiveKit Egress. If the agent's tab crashes mid-call,
  the recording is lost.
- **No waiting room**: if nobody's available, the customer hears ~8s of a
  generated hold tone (Web Audio oscillator, not a licensed audio asset) and
  the attempt is logged as `no_agent_available` — they must click "Call"
  again themselves, there's no auto-callback.
- **Chat has no persistence-across-reload UI wiring yet**: `GET /chats/:id/messages`
  exists for it, but the frontend doesn't call it on mount — refreshing
  mid-chat loses the visible thread from the store (messages are still safe
  in Postgres, just not re-fetched into the UI).
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
- **Deleting a product/recording doesn't clean up its Supabase Storage
  object** — the DB row goes away but the underlying file is left orphaned
  in the bucket. Low-cost at this scale; worth a cleanup job later.
