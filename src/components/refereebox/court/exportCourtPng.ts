// src/components/refereebox/court/exportCourtPng.ts
// Snapshot the live shot-chart court as a PNG and trigger a download.
// Walks the container's child SVGs (background lines / hex layer / markers / ruler /
// foreground lines), serializes each, draws them sequentially to a 2× canvas.

import { LS_W, LS_H } from './CourtGeometry';

export interface ExportCourtOptions {
    /** Filename root — receives `.png` extension and `-${gameCode}-${ts}` suffix. */
    filename?: string;
    /** Game code (e.g. "ABC123") inserted into the filename. */
    gameCode?: string | null;
    /** Pixel scale (2 = retina). */
    scale?: number;
    /** Background floor color (matches the active theme — e.g. T.floor). */
    bg?: string;
}

/** Find every SVG descendant inside the court container in DOM order. */
function collectSvgs(root: HTMLElement): SVGSVGElement[] {
    return Array.from(root.querySelectorAll('svg')) as SVGSVGElement[];
}

function svgToString(svg: SVGSVGElement): string {
    const clone = svg.cloneNode(true) as SVGSVGElement;
    if (!clone.getAttribute('xmlns')) {
        clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    }
    // Ensure preserveAspectRatio is honored even when rendered standalone
    if (!clone.getAttribute('preserveAspectRatio')) {
        clone.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    }
    return new XMLSerializer().serializeToString(clone);
}

function svgToImage(svgStr: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
        img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
        img.src = url;
    });
}

export async function exportCourtPng(
    container: HTMLElement,
    opts: ExportCourtOptions = {},
): Promise<void> {
    const { filename = 'shotchart', gameCode = null, scale = 2, bg = '#0A1322' } = opts;

    const svgs = collectSvgs(container);
    if (svgs.length === 0) throw new Error('No SVG layers found in court container');

    // All court SVGs share the 188×100 viewBox; render at scale × that.
    const w = LS_W * scale;
    const h = LS_H * scale;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');

    // Floor backdrop
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Draw layers in DOM order
    for (const svg of svgs) {
        try {
            const str = svgToString(svg);
            const img = await svgToImage(str);
            ctx.drawImage(img, 0, 0, w, h);
        } catch (err) {
            // Skip layers that fail to serialize (e.g. CORS-tainted defs)
            // eslint-disable-next-line no-console
            console.warn('[exportCourtPng] layer skipped:', err);
        }
    }

    const blob: Blob = await new Promise((resolve, reject) => {
        canvas.toBlob(b => b ? resolve(b) : reject(new Error('toBlob failed')), 'image/png');
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    a.href = url;
    a.download = `${filename}${gameCode ? `-${gameCode}` : ''}-${ts}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
}
