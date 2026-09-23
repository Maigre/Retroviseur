# Architecture

## Stack

- **SvelteKit 2 + Svelte 5**, `adapter-static` with SPA fallback, `ssr = false`
  → a static bundle for any HTTPS host, wrappable by **Capacitor** later.
- **TypeScript** throughout; domain logic in framework-free modules.
- **Vitest** for domain tests (`npm test`).
- Browser APIs: `getUserMedia` / `ImageCapture`, WebGL2, WebCrypto, IndexedDB,
  Storage API (`persist()`), Web Share Level 2, Vibration.

## Layout

```
src/lib/
  config.ts            developer constants (roll size, wind clicks, develop window, stock)
  i18n.ts              FR/EN strings, browser language detection
  platform.ts          platform quirks (iOS detection → flash availability)
  roll/                Roll model, forward-only state machine, camera/lab occupancy rules
  camera/winder.ts     thumbwheel logic (shutter lock)
  camera/flick.ts      pointer stroke → one ratchet click
  camera/capture.ts    getUserMedia, full-res still, 3:2 crop (crop.ts), JPEG
  camera/sound.ts      synthesized mechanical sounds (WebAudio) + haptics
  storage/db.ts        IndexedDB promise layer
  roll/seal.ts         AES-GCM per-roll key, seal/unseal
  roll/repository.ts   the only door to stored rolls and sealed frames
  components/          Thumbwheel.svelte
  lab/                 Lab interface + implementations (local time-lock today)
  film/stocks.ts       film look parameter sets (shader coming in phase 2)
src/routes/            the camera body screen
static/                manifest, icons
```

Rule: **UI components never hold frame pixels.** Captured frames go straight
from the capture pipeline into sealed storage; the UI only knows the counter.

## Roll state machine

```mermaid
stateDiagram-v2
    [*] --> loaded: load roll
    loaded --> loaded: expose (shot < 27)
    loaded --> full: expose (27th)
    full --> developing: Lab.dropOff → ticket
    developing --> ready: Lab.status = ready
    ready --> collected: Lab.collect → Delivery
    collected --> [*]
```

Transitions are pure functions in [`roll/roll.ts`](../src/lib/roll/roll.ts);
illegal moves throw `RollError`. States only ever move forward.

Occupancy (D14, [`roll/rules.ts`](../src/lib/roll/rules.ts)): at most one roll
in the camera (`loaded`/`full`) and one at the lab (`developing`/`ready`).
`canLoad` / `canDropOff` gate the two user actions.

## Capture pipeline (phase 1–2)

```
getUserMedia (rear, max res)
   │  shutter
   ▼
grab full-res frame ── ImageCapture.takePhoto() where available (Chrome Android)
   │                    else draw the <video> frame to a canvas (iOS Safari)
   ▼
film look (WebGL2) ─── stock curves, grain, vignette, halation, flash look,
   │                    light leak (head/tail frames), date stamp
   ▼
encode JPEG (q ≈ 0.9, 3:2)
   ▼
seal (AES-GCM, per-roll key) ──▶ IndexedDB  { rollId, index, meta, sealed }
```

The viewfinder is a separate, cheap path (small `<video>` + CSS vignette/blur);
it never shows the look.

## Storage

IndexedDB `retroviseur`, two stores:

| Store | Key | Value |
|---|---|---|
| `rolls` | `roll.id` | `{ roll: Roll, key: CryptoKey }` |
| `frames` | `[rollId, index]` (index `byRoll`) | `{ rollId, index, meta, iv, data }` — `data` is ciphertext |

`RollRepository.recordFrame` seals the JPEG first (crypto awaits would close an
IndexedDB transaction), then writes the frame **and** the advanced roll in one
transaction, re-checking the counter inside it. The UI consumes the wound film
only after that commit: a failed capture never costs a frame.

## Sealing

- At load, each roll gets a random **AES-GCM 256** key (WebCrypto). Every frame
  is encrypted with its own IV before it touches storage.
- The key is stored alongside the roll in IndexedDB (a `CryptoKey` survives
  structured clone).
- **Local lab**: the key never leaves; collection decrypts and zips. It's a
  ritual lock, not security (D2).
- **Server labs (later)**: at drop-off the key is wrapped with the lab's public
  key and uploaded with the sealed frames, then **deleted locally** — from that
  moment the phone genuinely cannot open the roll. This is why the key is
  generated extractable and why sealing exists from day one: switching labs
  changes where the key goes, not how frames are stored.

## Labs

```ts
interface Lab {
  kind: 'local-timelock' | 'email' | 'photolab';
  dropOff(roll, frames: AsyncIterable<SealedFrame>): Promise<LabTicket>;
  status(ticket): Promise<{ state: 'developing' | 'ready' }>;
  collect(roll): Promise<Delivery>;   // archive to the device, or "sent elsewhere"
}
```

| Lab | dropOff | status | collect |
|---|---|---|---|
| `local-timelock` (MVP) | draw readyAt ∈ [24 h, 72 h], keep frames | compare clock | unseal + zip → share/download |
| `email` (next) | upload sealed frames + wrapped key | poll / push | "sent to your inbox" (`elsewhere`) |
| `photolab` (someday) | upload to a real lab API | lab status | prints by post, scans by mail |

The ticket is persisted on the roll; its `data` is private to the lab. Adding a
lab never touches the camera or the roll model.

## Storage durability

Losing a roll is the worst bug, so:

- Call `navigator.storage.persist()` at first launch.
- **iOS**: Safari can evict a *website's* storage after ~7 days without a visit;
  a PWA **installed to the home screen** is not subject to that. Onboarding on
  iOS must push "Add to Home Screen" before loading the first roll.
- Write each frame in its own IndexedDB transaction before the counter moves.

## Platform limits

| Topic | Android Chrome | iOS Safari (PWA) | Plan |
|---|---|---|---|
| Rear camera via `getUserMedia` | ✅ | ✅ (installed PWA ok) | — |
| Full-res still (`ImageCapture.takePhoto`) | ✅ | ❌ | fall back to video-frame grab; request 4K stream |
| Torch for the flash | ✅ `torch` constraint | ⚠️ unreliable | switch hidden on iOS until native (D15) |
| Background "ready" notification | Web Push (server) | Web Push for installed PWAs, iOS 16.4+ (server) | check on open (D16); native local notifications later |
| Haptics (`navigator.vibrate`) | ✅ | ❌ | sound carries the feedback on iOS |
| Share files (Web Share L2) | ✅ | ✅ | download fallback |

Capacitor removes most of these limits (native camera, haptics, local
notifications) without changing the domain code.
