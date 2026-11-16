import React from "react";

import musicCover from "./assets/music-cover.webp";
import sermonPhoto from "./assets/sermon-photo.webp";

/**
 * How each built-in scene creator is shown on the "Add component" page.
 *
 * - "popular": big cards with a preview of what shows on the screen.
 * - "more": smaller tiles.
 * - anything not listed falls into "other": a plain compact list at the end.
 */
export type SceneCreatorTier = "popular" | "more" | "other";

type SceneCreatorStyle = {
  tier: SceneCreatorTier;
  /** Lower comes first */
  rank: number;
  tagline?: string;
  preview?: React.FC;
};

const svgProps = {
  viewBox: "0 0 320 180",
  className: "block w-full h-full",
  preserveAspectRatio: "xMidYMid slice",
  "aria-hidden": true,
} as const;

const SermonSlide = () => (
  <>
    <rect width="320" height="180" fill="#faf7f2" />
    <image
      href={sermonPhoto}
      x="180"
      y="0"
      width="140"
      height="180"
      preserveAspectRatio="xMidYMid slice"
    />
    <text
      x="24"
      y="54"
      fontSize="9"
      fontWeight="700"
      fill="#b45309"
      style={{ letterSpacing: "0.14em" }}
    >
      PARABLES OF JESUS
    </text>
    <text x="24" y="84" fontSize="21" fontWeight="800" fill="#212529">
      The Prodigal
    </text>
    <text x="24" y="109" fontSize="21" fontWeight="800" fill="#212529">
      Son
    </text>
    <text x="24" y="130" fontSize="10" fill="#495057">
      Luke 15:11-32
    </text>
  </>
);

const thumbnails: React.ReactNode[] = [
  <SermonSlide key="sermon" />,
  <g key="verse">
    <rect width="320" height="180" fill="#1e293b" />
    <rect x="70" y="60" width="180" height="12" rx="6" fill="#f8fafc" />
    <rect x="96" y="86" width="128" height="12" rx="6" fill="#f8fafc" />
    <rect x="130" y="118" width="60" height="8" rx="4" fill="#94a3b8" />
  </g>,
  <g key="points">
    <rect width="320" height="180" fill="#fff" />
    <rect x="28" y="30" width="150" height="16" rx="3" fill="#212529" />
    {[70, 96, 122].map((y) => (
      <g key={y}>
        <circle cx="34" cy={y + 5} r="5" fill="#d97706" />
        <rect x="48" y={y} width="200" height="10" rx="5" fill="#ced4da" />
      </g>
    ))}
  </g>,
];

const SlidesPreview: React.FC = () => (
  <svg {...svgProps}>
    <rect width="320" height="180" fill="#e9ecef" />
    <rect width="64" height="180" fill="#f8f9fa" />
    <rect x="64" width="0.75" height="180" fill="#ced4da" />
    {thumbnails.map((thumb, i) => {
      const y = 24 + i * 34;
      const selected = i === 0;
      return (
        <g key={i}>
          <text
            x="9"
            y={y + 10}
            fontSize="6"
            fill={selected ? "#b45309" : "#868e96"}
            fontWeight={selected ? 700 : 400}
          >
            {i + 1}
          </text>
          <svg x="16" y={y} width="42" height="23.6" viewBox="0 0 320 180">
            {thumb}
          </svg>
          <rect
            x="16"
            y={y}
            width="42"
            height="23.6"
            fill="none"
            stroke={selected ? "#d97706" : "#ced4da"}
            strokeWidth={selected ? 1.5 : 0.75}
          />
        </g>
      );
    })}
    <rect
      x="77"
      y="25"
      width="232"
      height="130.5"
      fill="rgba(0,0,0,0.08)"
      transform="translate(1.5 2)"
    />
    <svg x="77" y="25" width="232" height="130.5" viewBox="0 0 320 180">
      <SermonSlide />
    </svg>
  </svg>
);

const stars = [
  [24, 22],
  [58, 40],
  [92, 16],
  [140, 24],
  [196, 14],
  [236, 34],
  [280, 20],
  [300, 54],
  [18, 150],
  [304, 136],
  [60, 160],
  [250, 158],
];

// Chorus of The Heart of Worship, as used on the homepage (licensed)
const LYRIC_LINES = [
  "I'm coming back to the heart of worship",
  "And it's all about You",
  "It's all about You, Jesus",
];

const LyricsPreview: React.FC = () => (
  <svg {...svgProps}>
    <defs>
      <radialGradient id="tp-lyrics-sky" cx="0.3" cy="0.2" r="1">
        <stop offset="0" stopColor="#3b4fa8" />
        <stop offset="0.5" stopColor="#1e1b4b" />
        <stop offset="1" stopColor="#0b0a1f" />
      </radialGradient>
    </defs>
    <rect width="320" height="180" fill="url(#tp-lyrics-sky)" />
    {stars.map(([x, y], i) => (
      <circle
        key={i}
        cx={x}
        cy={y}
        r={i % 3 === 0 ? 1.2 : 0.8}
        fill="#fff"
        opacity={i % 2 ? 0.5 : 0.85}
      />
    ))}
    <g
      fill="#fff"
      textAnchor="middle"
      style={{ textShadow: "0 1px 3px rgba(0,0,0,0.6)" }}
    >
      {LYRIC_LINES.map((line, i) => (
        <text
          key={i}
          x="160"
          y={95 - ((LYRIC_LINES.length - 1) * 21) / 2 + i * 21}
          fontSize="14"
          fontWeight="600"
        >
          {line}
        </text>
      ))}
    </g>
  </svg>
);

const VideoPreview: React.FC = () => (
  <svg {...svgProps}>
    <defs>
      <linearGradient id="tp-video-sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#7cc4ec" />
        <stop offset="1" stopColor="#fbe3b0" />
      </linearGradient>
    </defs>
    <rect width="320" height="180" fill="url(#tp-video-sky)" />
    <circle cx="236" cy="62" r="13" fill="#fff6dd" />
    <path
      d="M0 100 L54 72 L100 92 L160 58 L226 96 L276 78 L320 92 V180 H0 Z"
      fill="#6b8fb3"
    />
    <path
      d="M0 118 L70 96 L132 114 L204 90 L270 112 L320 102 V180 H0 Z"
      fill="#3e5f80"
    />
    <path
      d="M0 138 L90 120 L180 136 L260 122 L320 132 V180 H0 Z"
      fill="#26405a"
    />
    <circle cx="160" cy="90" r="19" fill="rgba(255,255,255,0.95)" />
    <path d="M155 80.5 L170 90 L155 99.5 Z" fill="#26405a" />
  </svg>
);

const MusicPreview: React.FC = () => (
  <svg {...svgProps}>
    <defs>
      <filter id="tp-music-blur" x="0" y="0" width="100%" height="100%">
        <feGaussianBlur stdDeviation="14" />
        <feColorMatrix type="saturate" values="1.8" />
        <feComponentTransfer>
          <feFuncR type="linear" slope="1.5" />
          <feFuncG type="linear" slope="1.5" />
          <feFuncB type="linear" slope="1.5" />
        </feComponentTransfer>
      </filter>
    </defs>
    <image
      href={musicCover}
      x="-40"
      y="-120"
      width="400"
      height="400"
      preserveAspectRatio="xMidYMid slice"
      filter="url(#tp-music-blur)"
    />
    <rect width="320" height="180" fill="rgba(8,10,18,0.35)" />
    <g transform="translate(0 13)">
      <rect x="45" y="30" width="76" height="76" fill="rgba(0,0,0,0.35)" />
      <image href={musicCover} x="44" y="28" width="76" height="76" />
      <text
        x="138"
        y="44"
        fontSize="8"
        fontWeight="600"
        fill="rgba(255,255,255,0.7)"
        style={{ letterSpacing: "0.12em" }}
      >
        NOW PLAYING
      </text>
      <text x="138" y="64" fontSize="14" fontWeight="700" fill="#fff">
        Morning Worship
      </text>
      <text x="138" y="79" fontSize="10" fill="rgba(255,255,255,0.75)">
        Background music
      </text>
      <rect
        x="138"
        y="92"
        width="136"
        height="3"
        rx="1.5"
        fill="rgba(255,255,255,0.25)"
      />
      <rect x="138" y="92" width="58" height="3" rx="1.5" fill="#fff" />
      <path
        d="M152 112 L142 118 L152 124 Z M142 112 h-2 v12 h2 z"
        fill="rgba(255,255,255,0.85)"
      />
      <circle cx="174" cy="118" r="9" fill="#fff" />
      <path d="M171 113 v10 M177 113 v10" stroke="#111" strokeWidth="2.4" />
      <path
        d="M196 112 L206 118 L196 124 Z M206 112 h2 v12 h-2 z"
        fill="rgba(255,255,255,0.85)"
      />
    </g>
  </svg>
);

const sceneCreatorStyles: Record<string, SceneCreatorStyle> = {
  slides: {
    tier: "popular",
    rank: 1,
    tagline: "PowerPoint, Google Slides, PDF and more",
    preview: SlidesPreview,
  },
  "lyrics-presenter": {
    tier: "popular",
    rank: 2,
    tagline: "Song words for worship",
    preview: LyricsPreview,
  },
  "video-player": {
    tier: "popular",
    rank: 3,
    tagline: "YouTube, Vimeo or your own videos",
    preview: VideoPreview,
  },
  radio: {
    tier: "popular",
    rank: 4,
    tagline: "Background music or radio",
    preview: MusicPreview,
  },
  bible: { tier: "more", rank: 1 },
  timer: { tier: "more", rank: 2 },
  "screen-share": { tier: "more", rank: 3 },
  "worship-pads": { tier: "more", rank: 4 },
  slido: { tier: "other", rank: 1 },
  embed: { tier: "other", rank: 2 },
  "audio-recorder": { tier: "other", rank: 3 },
};

export const getSceneCreatorStyle = (pluginName: string): SceneCreatorStyle =>
  sceneCreatorStyles[pluginName] ?? { tier: "other", rank: 100 };
