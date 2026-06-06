// src/theme/courtside.ts
// ═══════════════════════════════════════════════════════════════
//  COURTSIDE LIGHT-MODE TOKEN SYSTEM
//
//  JS export of the Courtside design tokens for components that
//  use inline `style={{}}` (Splash, broadcast-style numerics, any
//  page that mirrors the LIGHT_ARENA pattern in ArenaView.tsx).
//
//  Tailwind-class consumers should use the `cs.*` color utilities
//  from tailwind.config.ts instead of importing this file.
//
//  Usage:
//    import { useTheme } from '../contexts/ThemeContext';
//    import { LIGHT_COURTSIDE, DARK_COURTSIDE } from '../theme/courtside';
//    const { theme } = useTheme();
//    const c = theme === 'light' ? LIGHT_COURTSIDE : DARK_COURTSIDE;
//    <div style={{ background: c.bgPrimary, color: c.textPrimary }} />
//
//  Dark mode is intentionally untouched — DARK_COURTSIDE values
//  match the legacy hardcoded dark palette and are only here so
//  components can switch on theme without conditionals.
// ═══════════════════════════════════════════════════════════════

export interface CourtsideTokens {
    // Surfaces (4 levels — use all)
    bgPrimary:       string;
    surfacePrimary:  string;
    surfaceElevated: string;
    surfaceOverlay:  string;

    // Accent (brand red — sparingly)
    accentPrimary:   string;
    accentPressed:   string;
    accentSubtle:    string;

    // Text (4 levels)
    textPrimary:     string;
    textSecondary:   string;
    textTertiary:    string;
    textOnAccent:    string;

    // Borders
    borderSubtle:    string;
    borderMedium:    string;

    // Semantic
    success:         string;
    warning:         string;
    error:           string;
    info:            string;

    // Shadows (CSS box-shadow strings)
    shadowCard:         string;
    shadowCardElevated: string;
    shadowNavbar:       string;
    shadowFab:          string;
    shadowSearch:       string;
}

export const LIGHT_COURTSIDE: CourtsideTokens = {
    bgPrimary:       '#F6F7F9',
    surfacePrimary:  '#FFFFFF',
    surfaceElevated: '#F0F2F5',
    surfaceOverlay:  '#E8EAED',

    accentPrimary:   '#E8112D',
    accentPressed:   '#B50022',
    accentSubtle:    'rgba(232,17,45,0.08)',

    textPrimary:     '#111827',
    textSecondary:   '#6B7280',
    textTertiary:    '#9CA3AF',
    textOnAccent:    '#FFFFFF',

    borderSubtle:    '#E5E7EB',
    borderMedium:    '#D1D5DB',

    success:         '#22C55E',
    warning:         '#F59E0B',
    error:           '#EF4444',
    info:            '#3B82F6',

    shadowCard:         '0 4px 10px rgba(0,0,0,0.05)',
    shadowCardElevated: '0 6px 16px rgba(0,0,0,0.08)',
    shadowNavbar:       '0 4px 20px rgba(0,0,0,0.07)',
    shadowFab:          '0 4px 16px rgba(232,17,45,0.28)',
    shadowSearch:       '0 1px 4px rgba(0,0,0,0.04)',
};

// Dark = legacy hardcoded values, kept identical to pre-redesign.
// DO NOT MODIFY without explicit approval — dark mode is frozen.
export const DARK_COURTSIDE: CourtsideTokens = {
    bgPrimary:       '#000000',
    surfacePrimary:  '#0A0A0A',
    surfaceElevated: '#18181B',
    surfaceOverlay:  '#27272A',

    accentPrimary:   '#DC2626',
    accentPressed:   '#B91C1C',
    accentSubtle:    'rgba(220,38,38,0.12)',

    textPrimary:     '#FAFAFA',
    textSecondary:   '#A1A1AA',
    textTertiary:    '#52525B',
    textOnAccent:    '#FFFFFF',

    borderSubtle:    '#27272A',
    borderMedium:    '#3F3F46',

    success:         '#22C55E',
    warning:         '#F59E0B',
    error:           '#EF4444',
    info:            '#3B82F6',

    shadowCard:         'none',
    shadowCardElevated: 'none',
    shadowNavbar:       'none',
    shadowFab:          '0 0 24px rgba(220,38,38,0.4)',
    shadowSearch:       'none',
};

// Typography helpers — matches the Courtside type spec.
// Components prefer Tailwind classes; this is for inline styles.
export const CS_TYPE = {
    displayXL: { fontSize: 48, fontWeight: 800, letterSpacing: '-0.031em', fontFamily: 'Inter, sans-serif' },
    displayL:  { fontSize: 32, fontWeight: 800, letterSpacing: '-0.031em', fontFamily: 'Inter, sans-serif' },
    displayM:  { fontSize: 24, fontWeight: 700, letterSpacing: '-0.025em', fontFamily: 'Inter, sans-serif' },
    headingL:  { fontSize: 18, fontWeight: 700, letterSpacing: '-0.011em', fontFamily: 'Inter, sans-serif' },
    headingM:  { fontSize: 15, fontWeight: 600, letterSpacing: 0,          fontFamily: 'Inter, sans-serif' },
    headingS:  { fontSize: 13, fontWeight: 600, letterSpacing: 0,          fontFamily: 'Inter, sans-serif' },
    bodyL:     { fontSize: 16, fontWeight: 400, lineHeight: 1.5,           fontFamily: 'Inter, sans-serif' },
    bodyM:     { fontSize: 14, fontWeight: 400, lineHeight: 1.5,           fontFamily: 'Inter, sans-serif' },
    bodyS:     { fontSize: 12, fontWeight: 400, lineHeight: 1.4,           fontFamily: 'Inter, sans-serif' },
    labelM:    { fontSize: 11, fontWeight: 600, letterSpacing: '0.073em',  textTransform: 'uppercase' as const, fontFamily: 'Inter, sans-serif' },
    labelS:    { fontSize: 10, fontWeight: 600, letterSpacing: '0.12em',   textTransform: 'uppercase' as const, fontFamily: 'Inter, sans-serif' },
    // Broadcast / scoreboard — Oswald reserved for these only
    scoreXL:   { fontFamily: 'Oswald, sans-serif', fontWeight: 900, fontSize: 64, fontVariantNumeric: 'tabular-nums' as const, letterSpacing: '-0.01em' },
    scoreL:    { fontFamily: 'Oswald, sans-serif', fontWeight: 900, fontSize: 40, fontVariantNumeric: 'tabular-nums' as const },
    scoreM:    { fontFamily: 'Oswald, sans-serif', fontWeight: 800, fontSize: 28, fontVariantNumeric: 'tabular-nums' as const },
    overlineLg:{ fontFamily: 'Oswald, sans-serif', fontWeight: 700, fontSize: 12, letterSpacing: '0.3em',  textTransform: 'uppercase' as const },
    overlineSm:{ fontFamily: 'Oswald, sans-serif', fontWeight: 700, fontSize: 10, letterSpacing: '0.35em', textTransform: 'uppercase' as const },
    wordmark:  { fontFamily: 'Oswald, sans-serif', fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase' as const },
};

// Spacing scale (8pt grid) — matches Courtside spec.
export const CS_SPACE = {
    xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, section: 40,
};

export const CS_RADIUS = {
    sm: 8, md: 12, card: 16, lg: 16, xl: 20, pill: 9999,
};
