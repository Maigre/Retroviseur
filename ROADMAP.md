# Roadmap

## Phase 0 — Bootstrap ✅ 2026-09-23
- [x] Name, public repo, AGPL-3.0
- [x] SvelteKit static SPA, Vitest, TypeScript check
- [x] Domain model: roll state machine, winder, Lab interface, local time-lock, stocks, i18n
- [x] Product / decisions / architecture / film-look / deploy docs
- [x] Placeholder camera body (wind → shoot ritual, no camera)

## Phase 1 — Real camera, sealed roll
- [x] Rear camera in the tunnel viewfinder (`getUserMedia`)
- [x] Full-res capture (`ImageCapture` / video-frame fallback), 3:2 crop, ≤ 3000 px long side
- [x] Per-roll AES-GCM sealing, IndexedDB frame store, `storage.persist()`
- [x] Roll survives reloads; counter restored from storage
- [x] Thumbwheel gesture (flick recogniser) + synthesized ratchet sound + haptics
- [x] Shutter sound, finder blackout, dry fire when not wound
- [x] PWA: service worker (offline shell), icons, iOS "Add to Home Screen" gate
- [x] Minimal drop-off to the local lab (so a full roll doesn't block testing)
- [ ] **Validate on real phones** (Android Chrome + installed iOS PWA): orientation of saved frames, capture latency, sounds/haptics feel
- [x] Feedback round 1 (Thomas, Jelly Star): Android install gate, continuous wheel ticks, longer blackout + counter roll, top-bar/thumb-corner layout with rotation, flash switch, header band (VT323) with About/Share, phone frame on desktop, wound state kept on reload, stronger haptics
- [x] Hidden dev mode (view frames, fill to last frame, skip the wait) — D27
- [x] Collect early (from phase 3): zip → share/download → confirmed wipe — D26
- [x] Feedback round 2: layout v3 (finder first, one control deck, vertical wheel off the edges, cq-based sizing, no text-scale), back gesture closes overlays, dev viewer with reachable prev/next/close, 90s Fuji/Kodak palette — D28, D29
- [x] Layout v4: landscape camera body on a portrait-locked screen, yellow header — D31
- [x] Real flash: fillLightMode 'flash' or torch around the capture; switch only when supported — D35
- [ ] Vibration + flash on the Jelly Star (installed via Brave): read the dev panel's device report
- [ ] Chrome install fails on the Jelly Star — collect symptoms (Q10)
- [ ] Vibration: fails in the Chrome tab on the Jelly Star — retest in the installed PWA
- [ ] Check on the Jelly Star: vibration (dev panel → test vibration), saved-frame orientation in portrait and landscape (dev panel → view frames)
- [x] LAN validation from the laptop (`npm run preview:lan`, self-signed HTTPS)
- [x] Deployed to gaff → https://retroviseur.37m.gr (`deploy/deploy.sh`, D19)

## Phase 2 — Film look
- [x] WebGL2 pipeline (FILM-LOOK.md) — D40
- [x] `/bench` route: both stocks on your own photos, live sliders, export params
- [x] Flash switch: real flash / torch, shown only when supported (D35)
- [x] Date stamp (`23 9 '26`, small), light leaks on first/last frame
- [x] Pick `FILM_STOCK`: Superia 400 (Thomas, D41)
- [ ] Check develop time on the Jelly Star (dev panel "last shot")

## Phase 3 — Develop & collect (local lab)
- [ ] Drop-off screen, developing state, ready check on open (D16)
- [ ] Next roll loadable while one is at the lab (D14)
- [x] Collect: unseal → zip (fflate) → share sheet / download → confirmed wipe
- [x] Contact sheet + roll.json in every zip (Q4, D53)
- [x] First-launch explanation (D50), storage safety (D51), update prompt (D52)

## Phase 4 — The lab (ticket-based, [docs/LAB.md](docs/LAB.md))
- [x] Design agreed — D44
- [x] `/api/lab` in the server + janitor, data dir on gaff, limits, tests — D45
- [x] RemoteLab: resumable upload, commit, ticket hand-off (share / copy), wipe
- [x] At the lab: window, status on open, "the lab called" a week before expiry
- [x] `/lab/[id]` pickup page: developing / collect / contact sheet + zip / gone
- [x] nginx: holden access_log off + body size 5m
- [x] kxkm-prod `retroviseur.37m.gr` block with access_log off (applied 2026-09-23)
- [ ] Hosting contact for the About page (Q11; GitHub issues meanwhile)
- [ ] Walk the whole ritual on the Jelly Star (real 1–3 day wait)

## Phase 5 — Native apps ([docs/ANDROID.md](docs/ANDROID.md), proposal — decisions pending)
- [ ] Capacitor wrap (iOS/Android): native camera, haptics, local notifications
- [ ] "The lab called" as a phone-scheduled local notification (no server push)
- [ ] Flash switch back on iOS with the native flash
- [ ] Store listings as **Retroviseur**

## Someday
- [ ] Real photo lab integration (prints by post)
