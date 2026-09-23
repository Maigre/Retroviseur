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
| gaff | pm2 app `retroviseur`, `/srv/apps/retroviseur` | [`deploy/ecosystem.config.cjs`](../deploy/ecosystem.config.cjs), [`deploy/server.mjs`](../deploy/server.mjs) |

`deploy/server.mjs` is a zero-dependency static server: SPA fallback to
`index.html`, `immutable` caching for `/_app/immutable/*`, `no-cache` for the
rest, `Permissions-Policy: camera=(self)`.

### Deploy

```sh
deploy/deploy.sh
```

Runs `npm ci`, tests and the build locally, rsyncs `build/` + the server to
gaff over `ssh -J rachael`, then `pm2 startOrReload` + `pm2 save`. Needs `ssh rachael` to work
from the machine you deploy from.

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
