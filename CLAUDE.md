# Retroviseur — notes for coding agents

Disposable-film-camera PWA (SvelteKit static SPA → Capacitor later). Read
`docs/PRODUCT.md` (what/why) and `docs/DECISIONS.md` (settled choices + open
questions) before changing behaviour.

- Node 24 LTS (`.nvmrc`). `npm test`, `npm run check`, `npm run build` must stay green.
- Domain logic lives in framework-free TS under `src/lib/` with Vitest tests next to it.
- **Never** add user-facing settings, previews, delete, or a gallery — see the "no" list.
- UI components never hold frame pixels; frames go capture → film look → seal → storage.
- New develop backends implement `Lab` (`src/lib/lab/types.ts`); the camera must not know which lab it has.
- Every user-visible string goes through `src/lib/i18n.ts` (FR + EN) — except the hidden dev panel (`src/lib/dev.ts`, `DevPanel.svelte`), which is English-only and the one place allowed to unseal frames.
- Layout lives inside `.device` (a size container): use `cq*` units / `@container device` queries, not `dv*` units or `@media` orientation; overlays are `position: absolute`, not `fixed`.
- A changed decision gets a new entry in `docs/DECISIONS.md`; don't rewrite old ones.
