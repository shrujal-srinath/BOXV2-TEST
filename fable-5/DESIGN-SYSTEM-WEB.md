# THE BOX Website — Design System (full reference)

> Extracted 2026-07-07 from the original root CLAUDE.md so the root file can stay lean.
> Load this whenever the session touches website UI. Nothing here was changed in the
> extraction — this is the authoritative style spec for `BOXV2-TEST-main`.

## Light Mode Aesthetic

The Dashboard light mode targets a **professional sports SaaS** aesthetic — think ESPN, NBA.com,
Sofascore. The design language uses:

- Warm off-white page background (`#F0EEE9` / `bg-[#F0EEE9]`)
- White card surfaces with soft box-shadows (no flat borders)
- Red (`red-600`) as the primary action/accent colour (section headers, buttons, CTAs)
- Full-gradient sport cards with large decorative emoji watermarks

The Player Passport Page (`src/pages/PlayerPassportPage.tsx`) remains the reference for
**form/wizard flows**. The Dashboard (`src/pages/Dashboard.tsx`) is the reference for the main
product shell.

---

## Color Tokens

| Role                | Light mode                                              | Dark mode                     |
|---------------------|---------------------------------------------------------|-------------------------------|
| Page background     | `bg-[#F0EEE9]`                                          | `dark:bg-zinc-950`            |
| Card surface        | `bg-white` + `[box-shadow:0_1px_3px_rgba(0,0,0,0.08),0_4px_16px_rgba(0,0,0,0.04)]` | `dark:bg-zinc-900`   |
| Card border         | `border-slate-100` (subtle, shadow does the lifting)    | `dark:border-zinc-700`        |
| Navbar              | `bg-white [box-shadow:0_1px_0_rgba(0,0,0,0.08)]`       | `dark:bg-zinc-950/95`         |
| Section header      | `border-l-4 border-red-600 pl-3 text-base font-bold`   | same structure, zinc colours  |
| Primary text        | `text-slate-900`                                        | `dark:text-zinc-50`           |
| Secondary text      | `text-slate-600`                                        | `dark:text-zinc-400`          |
| Muted / captions    | `text-slate-400`                                        | `dark:text-zinc-500`          |
| Field labels        | `text-slate-700`                                        | `dark:text-zinc-300`          |
| Brand primary (forms)| `violet-600` / `violet-700`                           | same                          |
| CTA / actions       | `bg-red-600 hover:bg-red-700 text-white`               | same or context-specific      |
| Active tab          | `border-b-2 border-red-600 text-slate-900`             | `dark:border-white dark:text-white` |
| Destructive         | `red-500`                                               | `dark:red-400`                |

---

## Sport Card (Light Mode)

Each sport card is a full-gradient tile, `h-48 rounded-2xl`. Structure:

```tsx
<button className={`bg-gradient-to-br ${gradient} p-5 h-48 rounded-2xl flex flex-col justify-between hover:scale-[1.02] hover:shadow-xl ...`}>
  {/* Large decorative emoji watermark — bottom-right, 15% opacity, text-7xl */}
  <div className="absolute bottom-3 right-3 text-7xl opacity-[0.15] rotate-12">{icon}</div>

  {/* Top: sport name */}
  <h3 className="text-2xl font-black text-white">{name}</h3>

  {/* Bottom: desc + CTA */}
  <div className="flex flex-col gap-2">
    <p className="text-white/70 text-[11px]">{desc}</p>
    <span className="self-start px-3 py-1.5 bg-white/20 text-white text-xs font-bold rounded-full border border-white/30">Start Game</span>
  </div>
</button>
```

Gradient map by accent colour:
- `red` / `orange` → `from-orange-500 to-red-600`
- `teal` / `green` → `from-emerald-500 to-teal-600`
- `yellow` → `from-amber-400 to-orange-500`
- `blue` → `from-blue-500 to-indigo-600`
- `purple` / `pink` → `from-violet-500 to-purple-700`
- `zinc` (default) → `from-slate-600 to-slate-800`

> The "Start Game" CTA inside the card must be a `<span>`, not a `<button>`, because `SportCard`
> is itself a `<button>`.

---

## Section Headers

```tsx
<h2 className="text-base font-bold text-slate-800 dark:text-zinc-200 border-l-4 border-red-600 pl-3 mb-5">
  Section Title
</h2>
```

No italic. No ALL-CAPS for section headings. The `border-l-4 border-red-600` left bar is the
primary visual anchor.

---

## Navbar

```tsx
<header className="bg-white dark:bg-zinc-950/95 [box-shadow:0_1px_0_rgba(0,0,0,0.08)] dark:border-b dark:border-zinc-800 ...">
  {/* Left: THE BOX wordmark */}
  <span className="text-sm font-black tracking-tight text-slate-900 dark:text-white uppercase">THE BOX</span>
  {/* Right: connectivity pill + avatar */}
  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-xs font-semibold text-slate-700">
    <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
    Cloud
  </span>
</header>
```

---

## Game Cards (Live Feed)

```tsx
<div className="bg-white ... rounded-2xl [box-shadow:0_1px_3px_rgba(0,0,0,0.08),0_4px_16px_rgba(0,0,0,0.04)] relative overflow-hidden">
  {/* Top accent bar */}
  <div className="absolute top-0 inset-x-0 h-1 rounded-t-2xl bg-red-600 dark:bg-blue-600" />
  {/* Score */}
  <div className="text-5xl font-black tabular-nums">{score}</div>
  {/* Watch button */}
  <button className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-xl ...">Watch Stream</button>
</div>
```

---

## Input Field Standard

```tsx
const inp = [
  'w-full rounded-xl border px-4 py-3 text-sm outline-none transition-all duration-150',
  'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400',
  'focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10',
  'dark:bg-zinc-800 dark:border-zinc-600 dark:text-zinc-100 dark:placeholder:text-zinc-500',
  'dark:focus:border-violet-500 dark:focus:ring-violet-500/10',
].join(' ');
```

Key rules:
- `border-slate-300` in light (NOT `slate-200` — too faint)
- `dark:bg-zinc-800` (NOT `zinc-900` — too dark, low contrast)
- `dark:border-zinc-600` (NOT `zinc-700/800` — too faint)
- `focus:ring-2 focus:ring-violet-500/10` — subtle glow, NOT just border color change

---

## Form/Wizard Card Pattern

Used in Player Passport registration. Each logical group of fields lives inside a `SectionCard`:

```tsx
<SectionCard icon={<svg ... />} title="Section Title" description="One-line description">
  {/* fields */}
</SectionCard>
```

Structure: `bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl`
Header: icon in violet-tinted container + bold title + muted description
Body: `p-5 space-y-4`

---

## Typography Hierarchy

| Element            | Class                                                                     |
|--------------------|---------------------------------------------------------------------------|
| Page/wizard title  | `text-3xl font-black uppercase tracking-tight italic`                     |
| Section header     | `text-base font-bold border-l-4 border-red-600 pl-3` (Dashboard)         |
| Section card title | `text-sm font-bold text-slate-800 dark:text-zinc-100`                     |
| Field label        | `text-xs font-semibold text-slate-700 dark:text-zinc-300 uppercase tracking-wide` |
| Body / helper      | `text-sm text-slate-600 dark:text-zinc-400`                               |
| Captions / hints   | `text-[11px] text-slate-400 dark:text-zinc-500`                           |
| Required badge     | `text-[9px] font-bold text-red-500 uppercase tracking-wider`              |
| Optional tag       | `text-[9px] text-slate-400 dark:text-zinc-500`                            |

> No italic for Dashboard body text or section headers. Italic reserved for step/wizard page
> titles only.

---

## Icons

- **Structural icons** (navigation, actions, status): inline SVG only. **Never use emoji as
  structural icons.**
- **Sport identification**: emoji from sport manifest is acceptable
- **CTA containers**: solid `bg-red-600 rounded-xl` (Dashboard/CTA context), violet-tinted
  (form/wizard context)
- **Action icons inside buttons**: SVG, `w-4 h-4` or `w-5 h-5`

---

## Multi-Step Wizard Pattern

1. **Header**: sticky, `bg-white/95 dark:bg-zinc-950/95 backdrop-blur-sm border-b`
2. **Step bar**: numbered circles + connector lines + labels
3. **Scrollable content**: `max-w-xl mx-auto px-4 pt-6 pb-36 space-y-5`
4. **Fixed bottom bar**: `fixed bottom-0 ... bg-white/95 dark:bg-zinc-950/95 backdrop-blur-sm border-t`

Use `min-h-dvh` (not `min-h-screen`) for mobile safe area compatibility.

---

## Progressive Disclosure

- Conditional fields only appear when a parent field is filled
- Use `animate-in fade-in slide-in-from-top-2 duration-200` for revealed sections

---

## Required vs Optional Fields

- Required: `text-[9px] font-bold text-red-500 uppercase tracking-wider` "Required" badge
- Optional: `text-[9px] text-slate-400 dark:text-zinc-500` "Optional" tag
- NEVER rely on placeholder text alone to label a field

---

## Sport Selection Grid (Wizard)

Sport cards: `grid grid-cols-3 gap-2`. Each card:
- `rounded-xl border-2`
- Selected: `border-violet-500 bg-violet-50 dark:bg-violet-900/20`
- Default: `border-slate-200 dark:border-zinc-700`
- Selected check: absolute `w-4 h-4 bg-violet-600 rounded-full` top-right with SVG checkmark

---

## Player ID Card (`src/components/PlayerIdCard.tsx`)

Virtual credential card. Landscape 1.586:1 aspect ratio. Dark gradient background
(`#18181b → #1e1b4b → #2e1065`).

Contains:
- Left violet accent bar (4 gradient colors)
- THE BOX wordmark (top-left)
- Verified badge (top-right, conditional)
- Avatar (rounded-xl, 64×64px)
- Jersey number below avatar
- Name, display name, sport icons, position, college
- Physical stats row (height · weight · dominant hand)
- Bottom bar: `player_code` in monospace + issue year

Shown on success screen after registration. Can be reused in profile views.
