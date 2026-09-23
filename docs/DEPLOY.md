# Deploy (self-hosted)

The app is a static SPA. `npm run build` writes everything to `build/`.

## Requirements

- **HTTPS** — mandatory: the camera, service worker and install prompt only
  work in a secure context.
- **SPA fallback** — unknown paths must serve `index.html` (the build ships
  `build/index.html` as fallback).
- `manifest.webmanifest` served as `application/manifest+json`.

## Example: Caddy

```caddyfile
retroviseur.example.org {
	root * /srv/retroviseur
	try_files {path} /index.html
	file_server
}
```

## Example: nginx

```nginx
location / {
    root /srv/retroviseur;
    try_files $uri /index.html;
}
```

## Publishing

```sh
npm run build
rsync -a --delete build/ <box>:/srv/retroviseur/
```

Target: a Node VM on Rachael (D17) — box details and domain pending (Q9).

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
