// src/components/refereebox/court/HeatmapLegend.tsx
// Compact in-court legend that updates with the active palette.
// Drawn as an SVG <g> inside the parent court SVG (or as a standalone SVG).

import React from 'react';
import { paletteById, type HeatPaletteId } from '../../../lib/colorPalettes';

interface LegendProps {
    palette: HeatPaletteId;
    /** Origin in SVG user units; e.g. (3, 90) in the landscape 188×100 viewBox. */
    x: number;
    y: number;
}

/** Inline SVG legend — render inside the court SVG. */
const HeatmapLegend: React.FC<LegendProps> = ({ palette, x, y }) => {
    const pal = paletteById(palette);
    const steps = 9;
    const w = 22, h = 3.4;
    const stepW = w / steps;
    const stops = Array.from({ length: steps }, (_, i) => pal(i / (steps - 1)));

    return (
        <g pointerEvents="none">
            {/* Container background */}
            <rect x={x - 0.5} y={y - 4} width={w + 5} height={6.5}
                fill="rgba(0,0,0,0.45)"
                stroke="rgba(255,255,255,0.15)" strokeWidth={0.2}
                rx={0.8} />

            {/* "FG%" label */}
            <text x={x} y={y - 1.4}
                fontSize={1.8}
                fill="rgba(255,255,255,0.78)"
                fontFamily="'JetBrains Mono', monospace"
                fontWeight={700}>
                FG%
            </text>

            {/* Color strip */}
            {stops.map((c, i) => (
                <rect key={i}
                    x={x + 4 + i * stepW} y={y - 0.3}
                    width={stepW + 0.05} height={h}
                    fill={c}
                />
            ))}

            {/* End labels */}
            <text x={x + 4} y={y + h + 1.6}
                fontSize={1.3}
                fill="rgba(255,255,255,0.7)"
                fontFamily="'JetBrains Mono', monospace"
                fontWeight={700}
                textAnchor="start">LOW</text>
            <text x={x + 4 + w} y={y + h + 1.6}
                fontSize={1.3}
                fill="rgba(255,255,255,0.7)"
                fontFamily="'JetBrains Mono', monospace"
                fontWeight={700}
                textAnchor="end">HIGH</text>
        </g>
    );
};

export default React.memo(HeatmapLegend);
