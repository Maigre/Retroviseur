# Deploy (self-hosted)

The app is a static SPA. `npm run build` writes everything to `build/`.

## Production: https://retroviseur.37m.gr

```
phone ──HTTPS──▶ kxkm-prod ──HTTP──▶ holden ──HTTP──▶ gaff:3001
                 (TLS, *.37m.gr     (nginx vhost,     (pm2 → deploy/server.mjs
                  catch-all)         LXC on rachael)   → build/, VM on rachael)
```

| Hop | What | Where it's defined |
|---|---|---|
| DNS | `retroviseur.37m.gr A 80.14.246.218` (Gandi) | Thomas |
| kxkm-prod | wildcard `*.37m.gr` cert + catch-all → holden | nothing specific to add |
| holden | vhost → `10.2.37.103:3001` | [`deploy/holden/retroviseur.37m.gr.conf`](../deploy/holden/retroviseur.37m.gr.conf) (mirror — change both sides) |
| gaff | git checkout of this repo at `/srv/apps/retroviseur`, pm2 app `retroviseur` serving `dist/` | [`deploy/ecosystem.config.cjs`](../deploy/ecosystem.config.cjs), [`deploy/server.mjs`](../deploy/server.mjs), [`deploy/update.sh`](../deploy/update.sh) |

`deploy/server.mjs` is a zero-dependency static server: SPA fallback to
`index.html`, `immutable` caching for `/_app/immutable/*`, `no-cache` for the
rest, `Permissions-Policy: camera=(self)`.

### Deploy / upgrade

Push to `main`, then from the laptop:

```sh
deploy/deploy.sh          # = ssh -J rachael mgr@10.2.37.103 /srv/apps/retroviseur/deploy/update.sh
```

On gaff, `deploy/update.sh` does `git fetch` + `reset --hard origin/main` (the
checkout is deploy-only — never edit there), `npm ci`, tests, build, then
`rsync build/ → dist/` so the live site keeps serving the old version until the
new one is complete, `pm2 startOrReload` + `pm2 save`, and a local health check.

### First install on a fresh VM

```sh
git clone https://github.com/Maigre/Retroviseur.git /srv/apps/retroviseur
/srv/apps/retroviseur/deploy/update.sh
```

### Holden vhost changes

```sh
ssh rachael 'pct exec 100 -- sh -c "cat > /etc/nginx/sites-available/retroviseur.37m.gr.conf && nginx -t && systemctl reload nginx"' \
  < deploy/holden/retroviseur.37m.gr.conf
```

## Validating on a phone from the laptop (LAN)

```sh
npm run preview:lan     # production build, served on https://<laptop-ip>:4173
npm run dev:lan         # same, with hot reload, on https://<laptop-ip>:5173
```

`HTTPS=1` turns on a **self-signed** certificate (`@vitejs/plugin-basic-ssl`),
enough for a secure context — the camera works once the warning is accepted:

- **Android Chrome**: *Advanced → Proceed to …*
- **iOS Safari**: *Show Details → visit this website*

Limits: a self-signed origin won't register a service worker reliably and
can't be installed as a real PWA; use the Rachael deployment for install tests.
The phone must be on the same Wi-Fi as the laptop.
