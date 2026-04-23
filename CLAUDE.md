# THE BOX — Codebase Guide

## Design System

### Established Standards (Player Passport Page as Reference)

The Player Passport Page (`src/pages/PlayerPassportPage.tsx`) is the **reference implementation** for THE BOX design language. All new pages and features should follow these patterns.

---

### Color Tokens

| Role              | Light mode                  | Dark mode                     |
|-------------------|-----------------------------|-------------------------------|
| Page background   | `bg-slate-50`               | `dark:bg-zinc-950`            |
| Card surface      | `bg-white`                  | `dark:bg-zinc-900`            |
| Card border       | `border-slate-200`          | `dark:border-zinc-700`        |
| Section divider   | `border-slate-100`          | `dark:border-zinc-800`        |
| Primary text      | `text-slate-900`            | `dark:text-zinc-50`           |
| Secondary text    | `text-slate-600`            | `dark:text-zinc-400`          |
| Muted / captions  | `text-slate-400`            | `dark:text-zinc-500`          |
| Field labels      | `text-slate-700`            | `dark:text-zinc-300`          |
| Brand primary     | `violet-600` / `violet-700` | same                          |
| Brand accent ring | `ring-violet-500/20`        | same                          |
| Destructive       | `red-500`                   | `dark:red-400`                |

> **Why:** Prior to this standard, the dark mode used `zinc-900/60` (semi-transparent) cards and `zinc-800` borders, causing very low contrast and hard-to-read text. Solid backgrounds with `zinc-700` borders are required.

---

### Input Field Standard

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

### Section Card Pattern

Used throughout Player Passport Page. Each logical group of fields lives inside a `SectionCard`:

```tsx
<SectionCard
  icon={<svg ... />}   // SVG icon, NEVER emoji
  title="Section Title"
  description="One-line description"
>
  {/* fields */}
</SectionCard>
```

Structure: `bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl`  
Header: icon in violet-tinted container + bold title + muted description  
Body: `p-5 space-y-4`

---

### Typography Hierarchy

| Element           | Class                                                       |
|-------------------|-------------------------------------------------------------|
| Page step title   | `text-3xl font-black uppercase tracking-tight italic`       |
| Section card title| `text-sm font-bold text-slate-800 dark:text-zinc-100`       |
| Field label       | `text-xs font-semibold text-slate-700 dark:text-zinc-300 uppercase tracking-wide` |
| Body / helper     | `text-sm text-slate-600 dark:text-zinc-400`                 |
| Captions / hints  | `text-[11px] text-slate-400 dark:text-zinc-500`             |
| Required badge    | `text-[9px] font-bold text-red-500 uppercase tracking-wider` |
| Optional tag      | `text-[9px] text-slate-400 dark:text-zinc-500`              |

> **Typography approach:** Large italic uppercase titles for step/page headings (sports-editorial feel). Smaller `font-semibold` for section headers. Clean, minimal labels with "Required" / "Optional" badges instead of asterisks only.

---

### Icons

- **Structural icons** (navigation, actions, status): inline SVG only (Heroicons/Lucide path data). **Never use emoji as structural icons.**
- **Sport identification**: emoji from sport manifest is acceptable (sports context, functional purpose)
- **Section card icons**: SVG in a `w-9 h-9 rounded-xl bg-violet-50 dark:bg-violet-900/20` container
- **Action icons inside buttons**: SVG, `w-4 h-4` or `w-5 h-5`

---

### Multi-Step Wizard Pattern

Used for Player Passport registration. Standard structure:

1. **Header**: sticky, `bg-white/95 dark:bg-zinc-950/95 backdrop-blur-sm border-b`
2. **Step bar**: numbered circles + connector lines + labels (see `StepBar` component)
3. **Scrollable content**: `max-w-xl mx-auto px-4 pt-6 pb-36 space-y-5`
4. **Fixed bottom bar**: `fixed bottom-0 ... bg-white/95 dark:bg-zinc-950/95 backdrop-blur-sm border-t`

Step bar circles: `w-8 h-8 rounded-full`, violet when active/complete, slate-100/zinc-800 when future.  
Bottom bar: Back button (`flex-1`) + primary action (`flex-[2]`).  
Use `min-h-dvh` (not `min-h-screen`) for mobile safe area compatibility.

---

### Progressive Disclosure

- Conditional fields only appear when a parent field is filled (e.g., USN/Roll No. appears after College Name is entered)
- Use `animate-in fade-in slide-in-from-top-2 duration-200` for revealed sections
- Collapsible sections use a chevron toggle, never hide required content

---

### Required vs Optional Fields

- Required: show `text-[9px] font-bold text-red-500 uppercase tracking-wider` "Required" badge inline with the label
- Optional: show `text-[9px] text-slate-400 dark:text-zinc-500` "Optional" tag
- NEVER rely on placeholder text alone to label a field
- Helper text via `hint` prop appears at `text-[11px] text-slate-400` below the input

---

### Sport Selection Grid

Sport cards: `grid grid-cols-3 gap-2`. Each card:
- `rounded-xl border-2` (2px border, not 1px)
- Selected: `border-violet-500 bg-violet-50 dark:bg-violet-900/20`
- Default: `border-slate-200 dark:border-zinc-700`
- Hover: `hover:border-violet-300 dark:hover:border-violet-700`
- Selected check: absolute `w-4 h-4 bg-violet-600 rounded-full` in top-right corner with SVG checkmark

---

### Player ID Card (`src/components/PlayerIdCard.tsx`)

Virtual credential card. Landscape 1.586:1 aspect ratio. Dark gradient background (`#18181b → #1e1b4b → #2e1065`).

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

---

## Stack

- React + TypeScript + Vite
- Tailwind CSS
- Supabase (auth + database + storage)
- React Router v6

## Key Files

| Path | Purpose |
|------|---------|
| `src/pages/PlayerPassportPage.tsx` | Player registration wizard (design reference) |
| `src/components/PlayerIdCard.tsx` | Virtual player ID card component |
| `src/services/playerService.ts` | Player profile CRUD + photo upload |
| `src/services/supabaseGameService.ts` | Game lifecycle + finalize |
| `src/sports/registry.ts` | Sport manifest registry |
| `src/core/types/Game.ts` | BaseTeam, BaseGameState, Game types |
| `src/core/types/Manifest.ts` | GameContext, SportManifest types |
| `supabase/migrations/006_player_profiles_full.sql` | Player schema |

## Database (Player)

Primary table: `player_profiles`  
Photo storage: `player-avatars` bucket (`{profileId}/avatar.{ext}`)  
Player code format: `BOX-XXX-1234` (auto-generated by `generate_player_code` RPC)  
Phone number is unique — used as the primary player identifier.

No schema changes needed for current features — all fields exist in migration 006.
