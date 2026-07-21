# Branding Guide

## Re-theming in one place (read this first)

The entire look is driven by **one token block** at the top of `app/globals.css`:

- **Colours** — edit the hex values under `:root` (paper, linen, seam, ink, graphite, stone, thread, statuses). Every component follows; nothing is hardcoded.
- **Dark mode** — set `NEXT_PUBLIC_THEME=midnight` in `.env.local` to switch the whole site to the dark "Midnight Archive" theme. Its palette lives in the `[data-theme='midnight']` block of the same file.
- **Grain** — `--grain-opacity` (0 = flat digital, 1 = heavy paper).
- **Accent** — `--c-thread` is the single selvedge-red accent. Change one line to rebrand the accent everywhere (hero edge, hovers, focus rings, crosshairs).
- **Name** — `NEXT_PUBLIC_APP_NAME` in `.env.local` changes the wordmark, page titles and footer.
- **Type voice** — swap the three fonts in `app/layout.tsx` (display / body / mono); every component uses the font variables, never font names.
- **Shared vocabulary** — `.t-label`, `.btn-technical`, `.stitch`, `.selvedge`, `.display-hero`, `.display-page` in `globals.css`, plus `<TechnicalLabel>` and `<CornerFrame>` in `components/ui/`. Edit once, applied everywhere.


The interface is deliberately quiet — an archival, editorial frame in warm neutrals so the fabric photography supplies all the colour. Re-skinning touches three files.

## 1. Name & identity

- `NEXT_PUBLIC_APP_NAME` env var → header wordmark, page titles, login button.
- `lib/config/app.config.ts` → `tagline` (homepage), `company.logoPath`.
- `public/logo.svg` → replace with your mark (the header currently sets the name in type; wire the logo in `SiteHeader` if preferred).

## 2. Palette — `tailwind.config.ts`

| Token | Default | Role |
|---|---|---|
| `paper` | `#FAF9F6` | page background (warm ivory) |
| `linen` | `#F1EFE9` | raised surfaces, image placeholders |
| `seam` | `#E3E0D8` | hairline rules and borders |
| `ink` | `#191817` | primary text, strong rules, buttons |
| `graphite` | `#55524C` | secondary text |
| `stone` | `#8C887F` | captions, mono metadata |
| `approve` / `review` / `reject` | green/amber/red, desaturated | status only |

Change the hex values and the whole app follows — components only use token names. Keep `paper`→`ink` contrast ≥ 7:1 and keep the status colours muted; they're annotations, not alerts.

## 3. Typography — `app/layout.tsx`

| Slot | Default | Used for |
|---|---|---|
| `--font-display` | **Newsreader** (serif, incl. italic) | headings, fabric names, spec values |
| `--font-body` | **Archivo** (grotesque) | body copy |
| `--font-mono` | **IBM Plex Mono** | fabric codes, labels, metadata |

Swap any `next/font` import; the CSS variables keep Tailwind's `font-display/body/mono` working. Sensible pairings that preserve the voice: Fraunces + Inter + JetBrains Mono, or Source Serif 4 + Public Sans + Space Mono.

## The signature element — keep it

`FabricTechnicalData` renders specs like a mill testing report: hairline-ruled rows, tracked mono caps labels, serif values. This strip and the specimen-plate fabric cards (image, ruled caption line, mono code) carry the archive identity. Restyle freely, but keep labels-mono / values-serif and the ruled rows.

## Voice & layout rules

- Microcopy is archival and concrete: "qualities", "the archive", "Mill archive · 8 qualities indexed". Avoid SaaS phrasing ("dashboard", "manage your assets").
- Whitespace over boxes; rules (`border-seam`, `border-ink`) over cards with shadows. No rounded corners, no drop shadows.
- The fabric image is always the hero — never crop it behind overlays; status badges sit quietly on `paper/90`.
- Label style is one utility cluster: `font-mono text-[11px] uppercase tracking-label text-stone`. Reuse it verbatim for any new metadata.
