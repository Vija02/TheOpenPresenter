import { SAMPLE_COLORS as C, type PluginSample } from "@repo/base-plugin";

const bar = (y: number, label: string, percent: number, color: string) => `
<text x="200" y="${y}" font-family="sans-serif" font-size="38" fill="${C.text}">${label}</text>
<text x="1720" y="${y}" font-family="sans-serif" font-size="38" font-weight="700" fill="${C.text}" text-anchor="end">${percent}%</text>
<rect x="200" y="${y + 24}" width="1520" height="36" rx="18" fill="${C.line}"/>
<rect x="200" y="${y + 24}" width="${Math.round(15.2 * percent)}" height="36" rx="18" fill="${color}"/>`;

/** A live poll */
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080">
<rect width="1920" height="1080" fill="${C.background}"/>
<rect width="1920" height="12" fill="${C.accent}"/>
<text x="200" y="200" font-family="sans-serif" font-size="30" font-weight="600" fill="${C.accent}">LIVE POLL · 128 votes</text>
<text x="200" y="290" font-family="sans-serif" font-size="64" font-weight="700" fill="${C.text}">Which song should we sing next week?</text>
${bar(420, "Amazing Grace", 46, C.accent)}
${bar(560, "How Great Thou Art", 31, C.accentDark)}
${bar(700, "Be Thou My Vision", 15, C.accentDark)}
${bar(840, "Something new", 8, C.accentDark)}
</svg>`;

export const sample: PluginSample = {
  image: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`,
};
