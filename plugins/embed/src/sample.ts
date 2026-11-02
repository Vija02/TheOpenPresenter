import { SAMPLE_COLORS as C, type PluginSample } from "@repo/base-plugin";

/** theopenpresenter.com */
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080">
<rect width="1920" height="1080" fill="${C.background}"/>
<rect x="140" y="44" width="44" height="44" rx="10" fill="${C.accent}"/>
<text x="204" y="78" font-family="sans-serif" font-size="32" font-weight="700" fill="${C.text}">TheOpenPresenter</text>
<text x="1290" y="76" font-family="sans-serif" font-size="26" fill="${C.muted}">Church</text>
<text x="1420" y="76" font-family="sans-serif" font-size="26" fill="${C.muted}">Pricing</text>
<text x="1550" y="76" font-family="sans-serif" font-size="26" fill="${C.muted}">Blog</text>
<rect x="1650" y="40" width="130" height="52" rx="8" fill="${C.accent}"/>
<text x="1715" y="75" font-family="sans-serif" font-size="24" font-weight="600" fill="#ffffff" text-anchor="middle">Sign in</text>
<text x="960" y="330" font-family="sans-serif" font-size="80" font-weight="900" fill="${C.text}" text-anchor="middle">Church software that connects</text>
<text x="960" y="430" font-family="sans-serif" font-size="80" font-weight="900" fill="${C.text}" text-anchor="middle">your pastor, worship and tech team</text>
<text x="960" y="520" font-family="sans-serif" font-size="32" fill="${C.muted}" text-anchor="middle">Lyrics, slides, bible and music in your browser.</text>
<text x="960" y="566" font-family="sans-serif" font-size="32" fill="${C.muted}" text-anchor="middle">Open source and free to start.</text>
<rect x="690" y="630" width="250" height="72" rx="8" fill="${C.accent}"/>
<text x="815" y="676" font-family="sans-serif" font-size="28" font-weight="600" fill="#ffffff" text-anchor="middle">Sign up free</text>
<rect x="970" y="630" width="260" height="72" rx="8" fill="none" stroke="${C.accent}" stroke-width="2"/>
<text x="1100" y="676" font-family="sans-serif" font-size="28" font-weight="600" fill="${C.accent}" text-anchor="middle">See how it works</text>
<rect x="360" y="790" width="1200" height="290" rx="20" fill="${C.surface}"/>
<rect x="400" y="830" width="340" height="250" rx="12" fill="${C.line}"/>
<rect x="780" y="830" width="740" height="24" rx="12" fill="${C.line}"/>
<rect x="780" y="880" width="560" height="24" rx="12" fill="${C.line}"/>
<rect x="780" y="930" width="640" height="24" rx="12" fill="${C.line}"/>
</svg>`;

export const sample: PluginSample = {
  image: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`,
};
