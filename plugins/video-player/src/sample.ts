import { SAMPLE_COLORS as C, type PluginSample } from "@repo/base-plugin";

/** A still from a motion background: soft light drifting over dark */
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080">
<defs>
<radialGradient id="a"><stop offset="0" stop-color="${C.accent}" stop-opacity="0.55"/><stop offset="1" stop-color="${C.accent}" stop-opacity="0"/></radialGradient>
<radialGradient id="b"><stop offset="0" stop-color="${C.accentDark}" stop-opacity="0.8"/><stop offset="1" stop-color="${C.accentDark}" stop-opacity="0"/></radialGradient>
<radialGradient id="c"><stop offset="0" stop-color="${C.text}" stop-opacity="0.18"/><stop offset="1" stop-color="${C.text}" stop-opacity="0"/></radialGradient>
</defs>
<rect width="1920" height="1080" fill="${C.background}"/>
<ellipse cx="480" cy="760" rx="900" ry="560" fill="url(#b)"/>
<ellipse cx="1420" cy="360" rx="760" ry="480" fill="url(#a)"/>
<circle cx="1180" cy="700" r="180" fill="url(#c)"/>
<circle cx="620" cy="300" r="120" fill="url(#c)"/>
<circle cx="1620" cy="860" r="90" fill="url(#c)"/>
<circle cx="300" cy="520" r="60" fill="url(#c)"/>
</svg>`;

export const sample: PluginSample = {
  image: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`,
};
