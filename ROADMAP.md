# Roadmap

## Phase 0 — Bootstrap ✅ 2026-09-23
- [x] Name, public repo, AGPL-3.0
- [x] SvelteKit static SPA, Vitest, TypeScript check
- [x] Domain model: roll state machine, winder, Lab interface, local time-lock, stocks, i18n
- [x] Product / decisions / architecture / film-look / deploy docs
- [x] Placeholder camera body (wind → shoot ritual, no camera)

## Phase 1 — Real camera, sealed roll
- [ ] Rear camera in the tunnel viewfinder (`getUserMedia`)
- [ ] Full-res capture (`ImageCapture` / canvas fallback), 3:2 crop
- [ ] Per-roll AES-GCM sealing, IndexedDB frame store, `storage.persist()`
- [ ] Roll survives reloads; counter restored from storage
- [ ] Thumbwheel gesture (flick recogniser) + ratchet sound + haptics
- [ ] Shutter sound, finder blackout
- [ ] PWA: service worker (offline), icons, iOS "Add to Home Screen" onboarding
- [ ] First self-hosted deploy (Q1)

## Phase 2 — Film look
- [ ] WebGL2 pipeline (FILM-LOOK.md pass order)
- [ ] `/bench` route: both stocks on reference photos
- [ ] Flash switch: torch where available, simulated flash look (Q2)
- [ ] Date stamp, light leaks
- [ ] Pick `FILM_STOCK`

## Phase 3 — Develop & collect (local lab)
- [ ] Drop-off screen, developing state, ready check on open
- [ ] Collect: unseal → zip (fflate) → share sheet / download → wipe
- [ ] Settle Q3–Q6

## Phase 4 — Remote lab (email)
- [ ] Small lab backend: upload sealed roll + wrapped key, develop, email a link
- [ ] Key leaves the phone at drop-off (true lock)
- [ ] Web Push "your prints are ready"

## Phase 5 — Native apps
- [ ] Capacitor wrap (iOS/Android): native camera, haptics, local notifications
- [ ] Store listings as **Rétroviseur**

## Someday
- [ ] Real photo lab integration (prints by post)
