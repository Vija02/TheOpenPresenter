import { SAMPLE_COLORS as C, type PluginSample } from "@repo/base-plugin";

/** A shared desktop with a document open */
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080">
<rect width="1920" height="1080" fill="${C.accentDark}"/>
<rect x="240" y="120" width="1440" height="800" rx="16" fill="${C.surface}"/>
<rect x="240" y="120" width="1440" height="56" rx="16" fill="${C.line}"/>
<rect x="240" y="150" width="1440" height="26" fill="${C.line}"/>
<circle cx="280" cy="148" r="10" fill="${C.muted}"/><circle cx="314" cy="148" r="10" fill="${C.muted}"/><circle cx="348" cy="148" r="10" fill="${C.muted}"/>
<text x="960" y="157" font-family="sans-serif" font-size="24" fill="${C.muted}" text-anchor="middle">Service plan.docx</text>
<text x="340" y="280" font-family="sans-serif" font-size="56" font-weight="700" fill="${C.text}">Sunday service plan</text>
<rect x="340" y="330" width="1000" height="18" rx="9" fill="${C.line}"/>
<rect x="340" y="370" width="1180" height="18" rx="9" fill="${C.line}"/>
<rect x="340" y="410" width="900" height="18" rx="9" fill="${C.line}"/>
<rect x="340" y="490" width="1240" height="300" rx="12" fill="${C.background}"/>
<rect x="380" y="530" width="420" height="22" rx="11" fill="${C.accent}"/>
<rect x="380" y="580" width="1100" height="16" rx="8" fill="${C.line}"/>
<rect x="380" y="616" width="980" height="16" rx="8" fill="${C.line}"/>
<rect x="380" y="652" width="1060" height="16" rx="8" fill="${C.line}"/>
<rect x="640" y="970" width="640" height="76" rx="22" fill="${C.background}" fill-opacity="0.6"/>
<rect x="676" y="986" width="44" height="44" rx="10" fill="${C.accent}"/><rect x="740" y="986" width="44" height="44" rx="10" fill="${C.muted}"/><rect x="804" y="986" width="44" height="44" rx="10" fill="${C.muted}"/><rect x="868" y="986" width="44" height="44" rx="10" fill="${C.muted}"/>
</svg>`;

export const sample: PluginSample = {
  image: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`,
};
