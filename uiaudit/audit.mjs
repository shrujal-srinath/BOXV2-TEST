// uiaudit/audit.mjs
// ─────────────────────────────────────────────────────────────
// Visual + accessibility audit for the referee scoreboard + touch deck.
// Captures screenshots at Waveshare 7" (1024×600) and runs axe-core
// against the rendered DOM, then prints a punch list.
//
// Usage:
//   npm run uiaudit            (uses VITE_URL or http://localhost:5174)
//   VITE_URL=http://192.168.1.42:5174 npm run uiaudit
// ─────────────────────────────────────────────────────────────

import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT  = resolve(HERE, 'out');
mkdirSync(OUT, { recursive: true });

const URL_BASE = process.env.VITE_URL ?? 'http://localhost:5174';

// Waveshare 7" HDMI runs at 1024×600 native.
const VIEWPORT = { width: 1024, height: 600 };

// Routes to audit. Uses /uiaudit/* fixture routes so the components render with
// seeded data — no daemon, no game-setup wizard required.
const ROUTES = [
    { id: 'sb-minimal',           path: '/uiaudit/scoreboard-minimal',                title: 'Scoreboard · Minimal (default)' },
    { id: 'sb-minimal-bonus',     path: '/uiaudit/scoreboard-minimal?bonus=1',        title: 'Scoreboard · Minimal — both teams in BONUS' },
    { id: 'sb-minimal-lowshot',   path: '/uiaudit/scoreboard-minimal?lowshot=1',      title: 'Scoreboard · Minimal — shot clock <5s' },
    { id: 'sb-minimal-shotzero',  path: '/uiaudit/scoreboard-minimal?shotzero=1',     title: 'Scoreboard · Minimal — shot clock at 0' },
    { id: 'sb-minimal-periodend', path: '/uiaudit/scoreboard-minimal?periodOver=1',   title: 'Scoreboard · Minimal — period ended' },
    { id: 'sb-classic',           path: '/uiaudit/scoreboard-classic',                title: 'Scoreboard · Classic (FUI)' },
    { id: 'td-minimal',           path: '/uiaudit/touchdeck-minimal',                 title: 'Touch deck · Minimal' },
    { id: 'td-classic',           path: '/uiaudit/touchdeck-classic',                 title: 'Touch deck · Classic (FUI)' },
    { id: 'shot-advanced-p2',     path: '/uiaudit/shotflow-advanced?points=2',        title: 'Shot popup · Advanced (+2 court → player → context)' },
    { id: 'shot-advanced-p1',     path: '/uiaudit/shotflow-advanced?points=1',        title: 'Shot popup · Advanced (+1 free throw — no court step)' },
    { id: 'shot-stats-p2',        path: '/uiaudit/shotflow-stats?points=2',           title: 'Shot popup · Stats player picker' },
];

async function injectAxe(page) {
    // axe-core ships as a single UMD script; inject it via addScriptTag.
    await page.addScriptTag({
        path: resolve(HERE, '..', 'node_modules', 'axe-core', 'axe.min.js'),
    });
}

async function auditRoute(browser, route) {
    const ctx = await browser.newContext({
        viewport: VIEWPORT,
        deviceScaleFactor: 1,
        // Force colorblind-test friendly settings
        colorScheme: 'dark',
    });
    const page = await ctx.newPage();

    const url = URL_BASE + route.path;
    console.log(`→ ${route.id.padEnd(12)} ${url}`);

    const consoleErrors = [];
    page.on('pageerror',  err => consoleErrors.push(`page: ${err.message}`));
    page.on('console',    msg => {
        if (msg.type() === 'error') consoleErrors.push(`console: ${msg.text()}`);
    });

    try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
    } catch (err) {
        console.log(`  ✗ navigation failed: ${err.message}`);
        await ctx.close();
        return { route, error: err.message };
    }

    // Give the lazy components a tick to settle.
    await page.waitForTimeout(800);

    // Screenshot
    const shot = resolve(OUT, `${route.id}.png`);
    await page.screenshot({ path: shot, fullPage: false });

    // axe-core accessibility scan
    await injectAxe(page);
    const axeResult = await page.evaluate(async () => {
        // @ts-ignore
        return await window.axe.run(document, {
            runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'],
            resultTypes: ['violations'],
        });
    });

    // Touch-target probe — flag any <button>/<a>/role=button under 44×44.
    const tinyTargets = await page.$$eval(
        'button, a, [role="button"]',
        nodes => nodes
            .map(n => {
                const r = n.getBoundingClientRect();
                return { tag: n.tagName, text: (n.textContent || '').trim().slice(0, 40), w: Math.round(r.width), h: Math.round(r.height) };
            })
            .filter(n => n.w > 0 && n.h > 0 && (n.w < 44 || n.h < 44))
    );

    // Header overflow probe — any element that scrolls horizontally.
    const horizontalOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth - document.documentElement.clientWidth;
    });

    await ctx.close();

    return {
        route,
        screenshot: shot,
        axe: axeResult,
        tinyTargets,
        horizontalOverflow,
        consoleErrors,
    };
}

function summarize(results) {
    const lines = [];
    lines.push('# UI/UX Audit Report');
    lines.push(`Viewport: ${VIEWPORT.width}×${VIEWPORT.height} (Waveshare 7")\n`);

    for (const r of results) {
        lines.push(`## ${r.route.title}  \`${r.route.path}\``);
        if (r.error) {
            lines.push(`> **Navigation failed:** ${r.error}\n`);
            continue;
        }
        lines.push(`Screenshot: \`${r.screenshot.replace(process.cwd() + '/', '')}\``);

        // a11y
        const v = r.axe.violations;
        lines.push(`### axe-core (${v.length} violations)`);
        if (v.length === 0) lines.push('_None._');
        for (const vi of v) {
            lines.push(`- **${vi.impact?.toUpperCase() ?? 'INFO'}** \`${vi.id}\` — ${vi.help}  `);
            lines.push(`  Affected: ${vi.nodes.length} node${vi.nodes.length === 1 ? '' : 's'}. ${vi.helpUrl}`);
        }

        // touch targets
        lines.push(`### Touch targets under 44×44 (${r.tinyTargets.length})`);
        if (r.tinyTargets.length === 0) lines.push('_None._');
        for (const t of r.tinyTargets) {
            lines.push(`- ${t.tag} \`${t.text || '(no text)'}\` — ${t.w}×${t.h}`);
        }

        // overflow
        if (r.horizontalOverflow > 0) {
            lines.push(`### Horizontal overflow: ${r.horizontalOverflow}px — header probably wrapping`);
        }

        // console errors
        if (r.consoleErrors.length) {
            lines.push(`### Console errors (${r.consoleErrors.length})`);
            for (const e of r.consoleErrors.slice(0, 10)) lines.push(`- ${e}`);
        }
        lines.push('');
    }
    return lines.join('\n');
}

(async () => {
    const browser = await chromium.launch();
    const results = [];
    for (const route of ROUTES) results.push(await auditRoute(browser, route));
    await browser.close();

    const report = summarize(results);
    const reportPath = resolve(OUT, 'report.md');
    writeFileSync(reportPath, report);
    console.log(`\n✓ Wrote ${reportPath}`);
    console.log('\n' + report);
})();
