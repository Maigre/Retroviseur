# Retroviseur

**A disposable film camera for your phone.**
27 exposures. No preview, no delete, no settings. Wind the film, shoot, repeat —
and when the roll is full, take it to the lab and wait. You only discover your
pictures once they are developed.

> *Rétro* + *viseur* (viewfinder) — and like a rear-view mirror, it only ever
> shows you what is already behind you.

## Status

🟡 **Bootstrap (phase 0).** Project skeleton, domain model and docs are in place;
the placeholder screen lets you feel the wind → shoot ritual, but there is no
camera feed or film look yet. See [ROADMAP.md](ROADMAP.md).

**Live:** https://retroviseur.37m.gr · deploy = push to `main`, then `deploy/deploy.sh` ([docs/DEPLOY.md](docs/DEPLOY.md))

## The ritual

1. **Load** a roll — 27 frames. One roll in the camera, one at the lab.
2. **Wind** the thumbwheel (a few flicks, ratchet clicks + haptics) to arm the shutter.
3. **Shoot** through a small tunnel viewfinder. The frame is gone: you can't see it or delete it.
4. **Finish** the roll → **drop it at the lab**.
5. **Wait** 1–3 days (you're not told exactly when).
6. **Collect** the roll as an archive and discover it. The photos then leave the app.

## Docs

| | |
|---|---|
| [docs/PRODUCT.md](docs/PRODUCT.md) | Concept, flow, screens, gestures, the "no" list |
| [docs/DECISIONS.md](docs/DECISIONS.md) | Every key product/tech decision, with the why — and open questions |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Stack, roll state machine, sealing, the pluggable *Lab*, platform limits |
| [docs/FILM-LOOK.md](docs/FILM-LOOK.md) | The on-device Fujifilm look: pipeline and stock parameters |
| [docs/DEPLOY.md](docs/DEPLOY.md) | Production path (kxkm-prod → holden → gaff), deploy, LAN testing |
| [ROADMAP.md](ROADMAP.md) | Phases from bench to app stores |

## Develop

Requires Node 24 LTS (`nvm use` reads `.nvmrc`).

```sh
npm install
npm run dev:lan           # HTTPS on the LAN for a phone, see docs/DEPLOY.md
npm run preview:lan       # same, on the production build
npm test                  # vitest — pure domain logic
npm run check             # svelte-check / TypeScript
npm run build             # static SPA in build/
```

## Credits

Font: [VT323](https://fonts.google.com/specimen/VT323) by Peter Hull (SIL Open
Font License 1.1), the same face as waverz.net.

## License

[AGPL-3.0](LICENSE) — the code is open, and so must be any fork, including one
run as a hosted service (e.g. a clone of the future lab backend).
