# Artist House — Style Guide

Design system extracted from the Artist House Submission Portal ([globals.css](app/globals.css) + [admin.css](app/admin/admin.css)). Use this to build a new site in the same visual language.

---

## 1. Core idea

Two surfaces, one token set:

| Surface | Background | Text | Feel |
|---|---|---|---|
| **Public / portal** — marketing, auth, submission forms | Black `#000` | Off-white | Editorial, dark, oversized serif headlines, generous air |
| **Admin ("Beacon")** — tables, calendars, dashboards | Off-white `#fafafa` | Near-black | Dense, utilitarian, mono labels, pill buttons |

Both share `:root` variables. Only the polarity and density change. A black sticky header bridges them.

Fixed rules:
- Only one accent color (`--accent-red`) — used for required marks, errors, hovers, active dates, primary admin buttons. Never for large fills on the dark surface.
- Borders, not shadows. Dark surface uses `rgba(250,250,250,0.12)` hairlines; light surface uses `--light-gray`. The only shadow in the system is on the admin dropdown menu.
- No gradients except the CSS-drawn `<select>` caret.
- Serif for headlines, sans for body, mono for labels/metadata. Never mix roles.

---

## 2. Tokens

Copy this block verbatim into `:root`.

```css
:root {
  /* Type families */
  --font-heading: "Instrument Serif", Georgia, serif;
  --font-body: "Helvetica Neue", Helvetica, Arial, sans-serif;
  --font-meta: "Helvetica Neue", Helvetica, Arial, sans-serif;
  --font-mono: "IBM Plex Mono", monospace;

  /* Palette — 8 values, no more */
  --black: #000000;
  --near-black: #0e0e0e;
  --dark-gray: #272727;
  --mid-gray: #3e3e3e;
  --light-gray: #dcdcdc;
  --off-white: #fafafa;
  --white: #ffffff;
  --accent-red: #f0523d;

  /* Type scale */
  --heading-1: 6.1rem;
  --heading-2: 5.5rem;
  --heading-3: 2.5rem;
  --heading-4: 1.6rem;
  --large-text: 2.2rem;
  --normal-text: 1.1rem;
  --small-text: 0.9rem;
  --meta-text: 1rem;

  /* Layout */
  --gutter: 6vw;
  --mobile-gutter: 24px;
  --grid-gap: 18px;
  --header-height: 88px;
  --radius-sm: 12px;
  --radius-md: 16px;
  --radius-lg: 22px;
}
```

Fonts are self-hosted via `@font-face` pointing at `fonts.gstatic.com` woff2 URLs (Instrument Serif 400 roman + italic; IBM Plex Mono 400). Keep that approach — no `<link>` to Google Fonts, no font loader.

**Derived values used repeatedly** (not tokenized, but keep consistent):
- Dark hairline: `1px solid rgba(250, 250, 250, 0.08)` (section dividers) / `0.12` (cards, panels) / `0.18`–`0.24` (inputs, buttons)
- Panel fill on dark: `rgba(14, 14, 14, 0.72)`
- Input fill on dark: `rgba(250, 250, 250, 0.02)`
- Muted dark text: `rgba(250, 250, 250, 0.6)`
- Row hover on dark: `rgba(250, 250, 250, 0.04)`; on light: `#f4f4f4`
- Inner table border on light: `#ececec`
- Footer background: `#232220` (deliberately warmer than `--black`)

---

## 3. Typography rules

**Headings — `--font-heading`, weight 400 always.** Never bold a serif heading.
```css
font-family: var(--font-heading);
font-weight: 400;
letter-spacing: -0.06rem;
line-height: 1;   /* 0.92–0.98 at display sizes */
```
Fluid sizes, always `clamp()`:

| Role | Size |
|---|---|
| Hero `h1` | `clamp(52px, 7.5vw, 118px)`, `line-height: 0.95` |
| Section title | `clamp(36px, 5vw, 72px)` |
| Card / portal title | `clamp(32px, 3vw, 56px)`, `line-height: 0.98` |
| Auth / step title | `clamp(30px, 3vw, 52px)` |
| Admin page title | `2.4rem` (fixed — admin doesn't scale fluidly) |

**Body — `--font-body`.** The signature is negative tracking:
```css
font-size: 1.1rem;
line-height: 1.5;      /* 1.45 for hero meta */
letter-spacing: -0.02em;
```
Admin body drops to `0.92–0.95rem` with no negative tracking.

**Labels (uppercase eyebrows, field labels, card labels, step counts):**
```css
font-size: 14px;
text-transform: uppercase;
letter-spacing: 0.03em;
```
Color `--light-gray` on dark. Eyebrows are `0.9rem` / `0.01em` in `--font-body`.

**Mono — admin and metadata only.** Every admin label, badge, button, nav item, count, and table header is mono uppercase:
```css
font-family: var(--font-mono);
font-size: 0.72rem – 0.85rem;
text-transform: uppercase;
letter-spacing: 0.06em – 0.1em;
color: var(--mid-gray);
```
On the dark surface, mono appears only in modal section headings (`0.8rem`, uppercase, `0.08em`, `--accent-red`) and sub-heads (`0.75rem`, 60% white).

**Footer is the exception:** `--font-body` at weight 500 for headings, 300 for links, `15px`, `letter-spacing: -0.025em`, `line-height: 1.28`. The wordmark cell is `clamp(48px, 4.7vw, 72px)` at `-0.055em`, `white-space: nowrap` (unset on mobile).

---

## 4. Layout

```
.site-shell (flex column, min-height 100dvh, black)
  .header       fixed, white, 88px tall, z-100
  main          flex:1, padding-top: var(--header-height)
    .section    padding: 48px var(--gutter) 42px + bottom hairline
  .footer       margin-top: auto, #232220
```

- **Horizontal rhythm:** everything is inset by `--gutter` (`6vw`, collapsing to `24px` under 767px). Header and footer use their own fixed padding (`14px 24px` / `66px 68px 74px`).
- **Grids:** `minmax(160px, 240px) minmax(0, 1fr)` for label-beside-content sections; `minmax(0, 380px) minmax(0, 1fr)` for portal sidebar+content; `repeat(N, minmax(0, 1fr))` for card/tab/field grids. Always `minmax(0, 1fr)`, never bare `1fr`.
- **Full-height panels:** `min-height: calc(100dvh - var(--header-height))` on the portal section; `dvh` not `vh`.
- **Breakpoints — only two:**
  - `≤1080px`: multi-column grids → `1fr`; 4-up tabs → 3-up; admin dashboard → 1 column.
  - `≤767px`: redefine `--gutter: var(--mobile-gutter)` and `--header-height: 74px` inside the media query, everything else follows; all grids → `1fr`; stacked action rows.

---

## 5. Components

### Header (public)
Fixed, `background: var(--white)`, `border-bottom: 1px solid rgba(0,0,0,0.08)`, padding `14px 24px`. Logo `width: min(190px, 34vw)`. Actions are borderless text buttons, `13px`, `letter-spacing: -0.02em`, black, hover → `--accent-red`.

### Header (admin)
Sticky, `background: var(--black)`, padding `18px var(--gutter)`, `gap: 28px`. Title in `--font-heading` at `1.7rem` with the second word wrapped in a `<span>` colored `--accent-red`. Nav links mono uppercase `0.95rem`/`0.06em` in `--light-gray`, hover → white. The "+ New" link is a `999px` pill outlined in `--accent-red`.

### Cards & panels (dark)
```css
border: 1px solid rgba(250, 250, 250, 0.12);
border-radius: var(--radius-lg);   /* 22px */
padding: 30–34px;
background: rgba(14, 14, 14, 0.72);  /* panels only; .card stays transparent */
```
`.card` is `min-height: 260px`, flex column, `justify-content: space-between` — label top, title bottom.

### Buttons
| Variant | Spec |
|---|---|
| Ghost (dark) | `radius-md`, `1px solid rgba(250,250,250,0.24)`, transparent, off-white text; hover → border `0.5` alpha |
| Solid (dark) | `background/border: var(--off-white)`, text `--black`; hover → `--light-gray` |
| Primary (admin) | `background: var(--accent-red)`, white text, no border, `border-radius: 999px`, mono uppercase `0.8rem`/`0.06em`, padding `9–12px 18–26px` |
| Ghost (admin) | white fill, `1px solid var(--light-gray)`, `999px`, mono `0.78rem`; hover → border `--accent-red` |

Sizes: `.button` min-height `54px`, `.ghost-button` `48px`, in-table ghost `38px`. Transition always `background .2s ease, color .2s ease, border-color .2s ease`. Disabled = `opacity: 0.4–0.5; cursor: default`.

Rule of thumb: **dark surface → rounded rectangles (`radius-md`). Light surface → pills (`999px`).**

### Selectable options (tabs, release options, multiselect)
Same base as ghost buttons, left-aligned, `strong` block title + `span` description (`0.92rem`, `line-height 1.45`). Active state inverts: `background: var(--off-white); color: var(--black); border-color: var(--off-white)` on dark, `--black`/`--white` on light. Step tabs are `min-height: 122px` in a 4-column grid with a mono index above the title.

### Form fields (dark)
```css
width: 100%;
border-radius: var(--radius-md);
border: 1px solid rgba(250, 250, 250, 0.18);
background: rgba(250, 250, 250, 0.02);
color: var(--off-white);
padding: 16px 18px;
```
Focus: `outline: none; border-color: rgba(250,250,250,0.55)`. Textarea `min-height: 160px; resize: vertical`. `.field` is a flex column with `gap: 14px`; `.field-grid` is 2-up with `gap: 26px var(--grid-gap)`; `.field--full` spans `1 / -1`. Required marks are `--accent-red`. `<select>` keeps `appearance: none` with the two-gradient caret at `calc(100% - 22px)`.

Admin fields are tighter: `radius: 10px`, `padding: 9px 12px`, `0.95rem`, and focus is `outline: 2px solid var(--accent-red); outline-offset: 1px` (not a border change).

### Banners & status
- Dark: `radius-md`, hairline border, `padding: 18px 20px`, `margin-top: 12px`, `white-space: pre-wrap`. Error → `border-color: rgba(240,82,61,0.6)`. Success fades out via `opacity`/`translateY(-6px)` over `0.45s`.
- Admin: tinted fills — success `#e7f4ec`/`#1d7a3c`, warning `#fdf3e0`/`#b07d0e`, error `#fdeae7`/`--accent-red`, `radius: 12px`.
- Callouts: `1px solid var(--accent-red)` + `background: rgba(240,82,61,0.08)`, `radius: 12px`.

### Badges (admin)
`999px` outline pills, mono `0.72rem`, colored border **and** text, transparent fill. Status palette: delivered `#1d7a3c`, scheduled `#b07d0e`, in-progress `#23548f`, external `#6b3fa0`, not-started `--mid-gray`, taken-down `--accent-red`.

### Tables
- Dark: `border-collapse: collapse`, `0.95rem`, cells `14px 16px`, bottom hairlines, `th` uppercase `0.82rem`/`0.08em` at 60% white, weight 500. Row hover `rgba(250,250,250,0.04)`. Wrap in `overflow-x: auto`.
- Admin: wrapper is white with `1px solid var(--light-gray)` and `radius: 16px`; `th` mono `0.72rem` uppercase; `td` `12px 16px` with `#ececec` borders and `vertical-align: top`; row hover `#f4f4f4` + `cursor: pointer`; last row loses its border. Truncate long cells with a `max-width: 240px` ellipsis span.

### Modal
Overlay `rgba(0,0,0,0.72)`, `inset: 0`, centered, `padding: 24px`, `z-index: 200`. Dialog `background: var(--near-black)`, `1px solid rgba(250,250,250,0.16)`, `radius: 22px`, `width: min(760px, 100%)`, `max-height: min(82vh, 900px)`, flex column with a bordered header (`22px 28px`) and scrolling body (`0.95rem`, `line-height 1.6`). Close button is a `34×34` circle, hover → `--accent-red`.

### Footer
4-column grid: `minmax(420px,1.8fr) minmax(220px,1fr) minmax(180px,0.9fr) minmax(240px,1.05fr)`, `gap: 54px`, `align-items: start`, no top border. First cell is the oversized wordmark. Links underlined at `1px` with `text-underline-offset: 4px`, `opacity: 0.94`, hover → `--light-gray`. Collapses to one column at 767px.

### Progress
Thin `4px` bar, `border-radius: 999px`, `background: rgba(250,250,250,0.85)`, width transitions `0.2s`. Label `0.82rem` at 70% white. Errors use `#ff9a9a` (lighter than the accent, for legibility on black).

---

## 6. Interaction & motion

- Transitions are `0.2s ease` for color/border, `0.45s ease` for banner fades. Nothing else animates.
- `html { scroll-behavior: smooth }`.
- Hover on dark = raise border alpha or invert fill. Hover on light = swap border to `--accent-red`.
- Every interactive element that isn't a link gets `cursor: pointer`; disabled gets `cursor: default`.
- Focus is visible everywhere: border brightening on dark, a 2px red outline on light. Don't remove it.

---

## 7. Voice

Sentence case, plain, direct, ends in a period even for headlines: "Sign in to open the Artist House portal." "Welcome back, Grant." Eyebrows are two-word uppercase status labels ("Authorized Session", "Access Requested"). Errors state the fix, not the blame. Em dash `—` for empty table cells. `+ New Submission` for create actions.

---

## 8. Starter skeleton

```css
/* 1. @font-face for Instrument Serif (400 roman + italic) and IBM Plex Mono (400) */
/* 2. the :root block from §2 verbatim */

* { box-sizing: border-box; }
html { scroll-behavior: smooth; min-height: 100%; }
body {
  margin: 0;
  background: var(--black);
  color: var(--off-white);
  font-family: var(--font-body);
  min-height: 100%;
}
a { color: inherit; }
button, input, textarea, select { font: inherit; }
button { cursor: pointer; }
img { max-width: 100%; display: block; }
```

Then build in this order: shell → header → section/grid primitives → cards & panels → buttons → fields → tables → banners → footer → the two media queries.

### Do
- Use `clamp()` for every display size.
- Keep `letter-spacing: -0.02em` on body copy and negative tracking on headlines.
- Reach for a border before a shadow, and a hairline before a border.
- Redefine `--gutter`/`--header-height` in the mobile query rather than overriding dozens of rules.
- Group shared properties on comma-separated selector lists (as both stylesheets do) instead of repeating blocks.

### Don't
- Add a second accent color or a heading weight above 400.
- Use pill radii on the dark surface or rectangular buttons in admin.
- Introduce `vh` where `dvh` matters, or a third breakpoint.
- Let mono type onto the public surface outside metadata and modal labels.
