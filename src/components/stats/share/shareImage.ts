// src/components/stats/share/shareImage.ts
// ─────────────────────────────────────────────────────────────────────────────
// Rasterize a pure-SVG card string to a PNG Blob at exact pixel dimensions, then
// download or native-share it. Deterministic output (no html2canvas), crisp,
// and the same SVG string drives the on-screen preview.
// ─────────────────────────────────────────────────────────────────────────────

/** Render an SVG string (with width/height attrs) to a PNG Blob at w×h px. */
export const svgToPng = (svg: string, width: number, height: number, scale = 1): Promise<Blob> =>
  new Promise((resolve, reject) => {
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(width * scale);
        canvas.height = Math.round(height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('canvas 2d unavailable');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        canvas.toBlob(b => (b ? resolve(b) : reject(new Error('toBlob returned null'))), 'image/png');
      } catch (e) {
        URL.revokeObjectURL(url);
        reject(e);
      }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('SVG failed to rasterize')); };
    img.src = url;
  });

export const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export type ShareResult = 'shared' | 'downloaded' | 'cancelled';

/** Native share the image (with file) when supported; otherwise download it. */
export const shareImage = async (blob: Blob, filename: string, text?: string): Promise<ShareResult> => {
  const file = new File([blob], filename, { type: 'image/png' });
  const nav = navigator as any;
  if (nav.canShare?.({ files: [file] }) && nav.share) {
    try {
      await nav.share({ files: [file], text, title: 'THE BOX' });
      return 'shared';
    } catch (e: any) {
      if (e?.name === 'AbortError') return 'cancelled';
      // fall through to download on share failure
    }
  }
  downloadBlob(blob, filename);
  return 'downloaded';
};
