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
- [ ] Check on the Jelly Star: vibration (dev panel → test vibration), saved-frame orientation in portrait and landscape (dev panel → view frames)
- [x] LAN validation from the laptop (`npm run preview:lan`, self-signed HTTPS)
- [x] Deployed to gaff → https://retroviseur.37m.gr (`deploy/deploy.sh`, D19)

## Phase 2 — Film look
- [ ] WebGL2 pipeline (FILM-LOOK.md pass order)
- [ ] `/bench` route: both stocks on reference photos
- [ ] Flash switch: Android torch; hidden on iOS (D15)
- [ ] Date stamp, light leaks
- [ ] Pick `FILM_STOCK`

## Phase 3 — Develop & collect (local lab)
- [ ] Drop-off screen, developing state, ready check on open (D16)
- [ ] Next roll loadable while one is at the lab (D14)
- [x] Collect: unseal → zip (fflate) → share sheet / download → confirmed wipe
- [ ] Settle Q4 (contact sheet / roll.json in the archive?)

## Phase 4 — Remote lab (email)
- [ ] Small lab backend: upload sealed roll + wrapped key, develop, email a link
- [ ] Key leaves the phone at drop-off (true lock)
- [ ] Web Push "your prints are ready"

## Phase 5 — Native apps
- [ ] Capacitor wrap (iOS/Android): native camera, haptics, local notifications
- [ ] Flash switch back on iOS with the native flash
- [ ] Store listings as **Retroviseur**

## Someday
- [ ] Real photo lab integration (prints by post)
