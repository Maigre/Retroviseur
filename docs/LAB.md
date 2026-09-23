# The lab — ticket-based remote developing

Status: **built and deployed 2026-09-23** (D44, D45). Replaces the "email lab" of
the first roadmap; the local time-lock lab stays as the dev lab.

## The idea in one paragraph

At drop-off the phone uploads the roll **already encrypted** to the lab (a small
Node service on gaff). The lab never gets the key, never gets a name or an
address, and cannot open anything. The key travels in a **lab ticket**: a link
whose secret part sits after the `#`, which browsers never send to a server. The
user hands the ticket to themselves (or a friend) through the phone's share
sheet — mail, messenger, notes, anything — and the phone forgets the roll. The
lab refuses to hand the roll out before a random moment 1–3 days later. Opening
the ticket after that shows the prints; collecting them starts a one-hour grace
period, then the lab destroys the roll. No ticket, no prints.

Why not have the server send emails: no sender reputation to keep, no SPF/DKIM,
no provider, no stored addresses, no consent/unsubscribe/retention duties.
Why not mail the photos from the phone: `mailto:` can't attach files, a roll is
30–80 MB, and it would arrive instantly — no developing.

## Goals and non-goals

- **Zero knowledge.** The operator cannot tell whose roll it is or what is in it.
  The server stores ciphertext, sizes and timestamps — nothing else.
- **Simple to run.** One Node process (the existing `deploy/server.mjs`), a data
  folder, a janitor timer. No database, no accounts, no mail, no push.
- **Hard to abuse** without identifying anyone: roll-shaped uploads, time-lock,
  one pickup, expiry, quotas.
- **The ritual holds.** Receipt, wait, "the lab called", pickup, gone.
- Non-goals for now: push notifications from the server, a real print lab,
  sharing one roll with many people, proof-of-work (considered, not needed yet).

## Lifecycle

```
phone                               lab (gaff)                                  ticket holder
─────                               ──────────                                  ─────────────
roll full ── "Take it to the lab"
  │ POST /rolls ──────────────────▶ create id, draw readyAt ∈ [+24 h, +72 h]
  │ ◀── id, uploadToken, window     (window only — never readyAt)
  │ PUT frames 1..n, manifest ────▶ store ciphertext (resumable)
  │ POST commit ──────────────────▶ state developing, uploadToken burnt
  │ share sheet: the ticket ───────────────────────────────────────────────────▶ (mail, Signal, notes…)
  │ wipe frames + key; keep a hidden backup of the ticket
  │
  │ on each app open: GET status ─▶ developing | ready | collected | gone
  │                                                          ◀── opens link before readyAt:
  │                                                              "still developing, ready between…"
  │                                  readyAt passes → ready
  │ ready & unclaimed at expiry−7 d: "The lab called"        ◀── opens link: "Collect your prints"
  │                                  GET archive (complete) ─▶ collectedAt = now
  │                                                          ──▶ contact sheet, Save all (.zip),
  │                                                              "destroyed in 58 min"
  │ status collected → drop backup   collectedAt + 1 h → delete
  │                                  or readyAt + 30 d → delete (never collected)
```

Server states: `uploading → developing → ready → collected → (deleted)`.
An abandoned upload (no commit) is deleted after 24 h.

## Timings

| What | Value |
|---|---|
| Ready time | drawn uniformly in [creation + 24 h, creation + 72 h], by the **server** (an upload takes minutes) |
| Window shown on the ticket | the two calendar days bounding that range ("between Thu 25 and Sat 27 Sep") |
| Grace after collection | 1 h, then deleted |
| Expiry if never collected | ready + 30 days |
| "The lab called" | in the app, from expiry − 7 days, while still unclaimed |
| Abandoned upload | deleted 24 h after creation |

## The ticket

```
https://retroviseur.37m.gr/lab/<id>#<key>
```

- `<id>`: 128 random bits, base64url (22 chars), chosen by the server. Unguessable.
- `<key>`: the roll's AES-GCM-256 key, raw, base64url (43 chars). In the URL
  fragment, so it never reaches the server, nginx logs or referrers.
- Whoever holds the link can collect — like a paper lab receipt.

Shared text (share sheet `text`, the link inside it; any target — mail, messenger, notes):

> **EN** — 🎞 Retroviseur — lab ticket. This is your lab ticket, don't lose it!
> Your prints will be ready between **{Thu 25}** and **{Sat 27 September}**.
> {link} — No ticket, no prints: the lab has no other way to find your roll.
>
> **FR** — 🎞 Retroviseur — ticket de labo. Voici votre ticket de labo, ne le
> perdez pas ! Vos tirages seront prêts entre le **{jeu. 25}** et le
> **{sam. 27 septembre}**. {lien} — Pas de ticket, pas de tirages : le labo n'a
> aucun autre moyen de retrouver votre pellicule.

## Encryption and what is uploaded

- The roll already has an AES-GCM-256 key and every frame is already sealed with
  it on the phone (`src/lib/roll/seal.ts`). Frames are uploaded **as sealed**
  (`iv ‖ ciphertext`), not re-encrypted.
- A **manifest** — roll load date, stock, and per frame its index, time and flash —
  is JSON sealed with the same key (own IV). The server sees none of it.
- The key is exported raw only to build the ticket; after hand-off the phone
  deletes the roll's key record (the hidden backup ticket keeps the link).

What the server knows per roll: `id`, frame count, byte sizes, `createdAt`,
`committedAt`, `readyAt`, window, `collectedAt`, `expiresAt`, a hash of the
upload token. Nothing about the person or the pictures.

## Server API (same origin, `/api/lab`)

All bodies are binary or tiny JSON. No cookies. CORS: same origin only.

| Method & path | Auth | Does |
|---|---|---|
| `POST /api/lab/rolls` `{frames: n}` (1 ≤ n ≤ 27) | — (rate-limited) | creates the roll; draws `readyAt`; returns `{id, uploadToken, window: {from, to}}` — no `expiresAt` yet: it would give `readyAt` away |
| `PUT /api/lab/rolls/:id/frames/:i` (1…n) | `Bearer uploadToken` | stores one sealed frame (≤ 4 MB); idempotent — safe to resend |
| `PUT /api/lab/rolls/:id/manifest` | `Bearer uploadToken` | stores the sealed manifest (≤ 64 KB) |
| `POST /api/lab/rolls/:id/commit` | `Bearer uploadToken` | checks every part is present, burns the token → `developing` |
| `GET /api/lab/rolls/:id` | — | status: `{state, frames, window, missing? (uploading), expiresAt? (ready), collectedUntil? (collected)}`; unknown or destroyed → `404 {state: "gone"}` |
| `GET /api/lab/rolls/:id/archive` | — | `425 Too Early` before `readyAt`; `410 Gone` after deletion; else streams the container; a **completely sent** stream sets `collectedAt` (first time only) |

Archive container (`application/octet-stream`): the magic `RTVL1`, then the
manifest and each frame in order, each as `u32 length (big-endian) ‖ bytes`.
One stream makes "complete download" a single, reliable event.

## Storage on gaff

```
/srv/apps/retroviseur-data/lab/<id>/
  meta.json        state, times, sizes, sha-256 of the upload token
  manifest.bin     sealed
  01.bin … 27.bin  sealed frames
```

Outside the git checkout, so deploys never touch it. A janitor runs every
10 minutes in the same process: deletes collected + 1 h, ready + 30 d,
uncommitted + 24 h, and recomputes the total size.

## Abuse controls (no identity needed)

| Lever | Setting | Stops |
|---|---|---|
| Roll-shaped uploads | ≤ 27 frames, ≤ 4 MB each, manifest ≤ 64 KB, ≤ 100 MB per roll; nginx `client_max_body_size 5m` | using the lab as a file host |
| Time-lock | nothing downloadable for 24–72 h | instant sharing |
| One pickup | collected → deleted 1 h later | distributing to many |
| Expiry | ready + 30 d | long-term storage |
| Global cap | 20 GB stored; beyond: `507` → "the lab is full, try again tomorrow" | filling the disk |
| Per-IP rate limit | ≤ 10 new rolls / IP / day; counters **in memory only**, keyed by `HMAC(dailyRandomSalt, ip)`; salt regenerated daily, never written | scripted floods |
| Token | upload only with the per-roll token, burnt at commit | tampering with committed rolls |

Takedown (LCEN hosting duty): on a report naming a ticket link or id, the
operator deletes `<id>` by hand. The link is the only way to find content.

## Logs and privacy

- The Node service logs no IPs, no ids — only counts and errors.
- **holden**: the `retroviseur.37m.gr` vhost gets `access_log off`.
- **kxkm-prod**: today the `*.37m.gr` catch-all logs every request to
  `holden-edge-access.log`. A dedicated `retroviseur.37m.gr` server block with
  `access_log off` (same TLS + proxy as the catch-all) is **prepared in
  `deploy/kxkm-prod/`, applied by Thomas** — it is a shared gateway.
- About page (FR/EN): "The lab stores your rolls encrypted with a key only your
  ticket holds. We cannot see your photos or know whose they are. Rolls are
  destroyed one hour after pickup, or 30 days after they are ready. Hosting
  contact: {address}."

## Threat model

| If… | Then |
|---|---|
| the server or its disk leaks | encrypted blobs + timestamps; no key, no identity |
| a ticket link leaks | whoever has it can collect — like a receipt; the owner's app will see "collected" |
| someone guesses ids | 128-bit random: not feasible; status reveals only a state |
| the phone is lost before hand-off | the roll is lost (it was never handed off) — same as today |
| the ticket is lost after hand-off | the app's backup ticket; the lab call a week before expiry |
| the operator wants to look | cannot: the key never reaches the server |

## Client changes

- **`RemoteLab implements Lab`** (`src/lib/lab/remote.ts`): `dropOff` creates the
  roll, uploads missing parts (resumable: status reports `missing`), commits, and
  returns a ticket `{id, key, window, expiresAt}`; `status` asks the server;
  `collect` opens the ticket link (the pickup happens on the lab page).
- **Drop-off screen**: uploading progress → "Here is your lab ticket" → **Share
  ticket** (share sheet, prefilled text) / **Copy link**. The roll is wiped from
  the phone only after commit **and** a successful share or copy.
- **Offline / lab full / rate-limited**: "The lab is closed right now — try again
  later"; the roll waits in the camera.
- **At the lab**: the bottom line shows the window; after `ready`, "Your prints
  are ready at the lab" with **Open ticket**; from expiry − 7 d, **"The lab
  called"** banner with the destroy date.
- **Collected / gone**: the backup ticket is dropped; one quiet line "picked up
  on {date}" the next time.
- **`/lab/[id]` page** (same static app; key read from the fragment):
  developing → window + "come back then"; ready → **Collect your prints** with the
  small print *"Once collected, the lab keeps your roll one more hour, then
  destroys it for good. Save your photos."*; collected → contact sheet from the
  decrypted archive, **Save all (.zip)**, per-frame save, countdown to
  destruction; gone → "This roll has left the lab."
- **Dev mode** keeps the local time-lock lab as a "dev lab" switch, so the whole
  ritual can be walked through without waiting on the server.
- Android app (later): a local notification scheduled at hand-off for the
  "lab called" date — still no server push.

## Implementation notes (D45)

- Server: `deploy/lab.mjs`, mounted by `deploy/server.mjs`; env `LAB_DIR`
  (gaff: `/srv/apps/retroviseur-data/lab`), `LAB_PROXY_HOPS=2` (kxkm-prod +
  holden append to `X-Forwarded-For`; the client is the 2nd entry from the end —
  forged earlier entries are ignored). `LAB_TEST_READY_MS` shortens the wait for
  end-to-end tests only; never set in production.
- Client: `src/lib/lab/remote.ts` (`RemoteLab`), `ticket.ts`, `archive.ts`; the
  camera page keeps a pending upload on the roll (`roll.upload`) to resume, shows
  the blocking ticket sheet until hand-off (`roll.handedOff`), then
  `repo.forget()` deletes frames and key. Hand-off = share completed, copy
  succeeded (clipboard API or the older copy command), or "I saved it
  somewhere else". Pickup page: `src/routes/lab/[id]/+page.svelte`.
- Dev mode: a "dev lab" switch drops rolls at the on-phone time-lock instead.
- Tests: `deploy/lab.test.mjs` (server lifecycle, limits, janitor) and
  `src/lib/lab/remote.test.ts` (interrupted + resumed upload, hand-off, pickup
  and decryption with the ticket key alone, then collected → gone).

## Rollout

1. ✅ Server: `/api/lab` + janitor, data dir on gaff, limits, tests.
2. ✅ `RemoteLab`, drop-off + ticket screen, status + lab call in the app.
3. ✅ `/lab/[id]` pickup page.
4. ✅ holden `access_log off` + `client_max_body_size 5m`; kxkm-prod block
   prepared in `deploy/kxkm-prod/` — **Thomas applies it**.
5. ✅ About/privacy lines (hosting contact provisional: the GitHub issues page,
   Q11). ⏳ Walk the whole ritual on the Jelly Star.
