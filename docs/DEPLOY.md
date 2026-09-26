# Deploy (self-hosted)

The app is a static SPA. `npm run build` writes everything to `build/`.

## Production: https://retroviseur.waverz.net

```
phone ──HTTPS──▶ kxkm-prod ──HTTP──▶ holden ──HTTP──▶ gaff:3001
                 (TLS *.waverz.net, (nginx vhost,     (pm2 → deploy/server.mjs
                  no access log)     LXC on rachael)   → build/, VM on rachael)
```

| Hop | What | Where it's defined |
|---|---|---|
| DNS | `retroviseur.waverz.net A 80.14.246.218`, `camera.waverz.net CNAME retroviseur.waverz.net` (Infomaniak); old `retroviseur.37m.gr A 80.14.246.218` (Gandi) | Infomaniak API / Thomas |
| kxkm-prod | `*.waverz.net` cert (acme.sh, DNS-01 `dns_infomaniak`, cron-renewed, installed in `/etc/nginx/ssl/wildcard.waverz.net/`); `retroviseur.waverz.net` block + `camera.waverz.net` 301; the old `retroviseur.37m.gr` block | [`deploy/kxkm-prod/`](../deploy/kxkm-prod/) (mirrors — change both sides) |
| holden | vhost for both names → `10.2.37.103:3001` | [`deploy/holden/retroviseur.conf`](../deploy/holden/retroviseur.conf) (mirror — change both sides) |
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

### The lab's data

Rolls live in `/srv/apps/retroviseur-data/lab` on gaff (`LAB_DIR`), outside the
checkout: deploys never touch them. One folder per roll; the server's janitor
deletes them on time (docs/LAB.md). Nothing in there can be read without the
tickets, which the server never sees.

### Holden vhost changes

```sh
ssh rachael 'pct exec 100 -- sh -c "cat > /etc/nginx/sites-available/retroviseur.conf && nginx -t && systemctl reload nginx"' \
  < deploy/holden/retroviseur.conf
```

### kxkm-prod vhost changes

```sh
ssh kxkm-prod 'cat > /etc/nginx/sites-enabled/retroviseur.waverz.net.conf && nginx -t && systemctl reload nginx' \
  < deploy/kxkm-prod/retroviseur.waverz.net.conf
```

### The old address: soft move, then 301 (D56)

Until about **2026-10-10**, `retroviseur.37m.gr` still serves the app, which moves
each phone over as soon as it holds no roll of its own (`src/lib/move.ts`). Then
replace the body of `deploy/kxkm-prod/retroviseur.37m.gr.conf`'s server block
(keep TLS, `access_log off` and the limits) with:

```nginx
    # uploads already under way on an old page may still finish
    location /api/lab/ { limit_req zone=retro_lab burst=30 nodelay; proxy_pass http://100.67.173.80; proxy_set_header Host $host; proxy_set_header X-Forwarded-Proto $scheme; proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; }
    location / { return 301 https://retroviseur.waverz.net$request_uri; }
```

and apply it like the block above. The app code for the old host can go a release
or two later.

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
