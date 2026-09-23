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

The target box and domain are still to be decided (DECISIONS.md, Q1).

## Testing on a phone during development

`npm run dev -- --host` serves over plain HTTP on the LAN, where the phone will
refuse camera access. Options: a tunnel with a real certificate, or the
self-hosted staging URL.
