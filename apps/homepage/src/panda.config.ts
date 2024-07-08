import { defineConfig } from "@pandacss/dev";

export default defineConfig({
  // Whether to use css reset
  preflight: true,

  jsxFramework: "react",

  // Where to look for your css declarations
  include: [
    "./components/**/*.{js,jsx,ts,tsx}",
    "./pages/**/*.{js,jsx,ts,tsx}",
    "./app/**/*.{js,jsx,ts,tsx}",
  ],

  // Files to exclude
  exclude: [],

  // Useful for theme customization
  theme: {
    extend: {
      tokens: {
        fonts: {
          inter: { value: ["Inter", "sans-serif"] },
          "inter-tight": { value: ["Inter Tight", "sans-serif"] },
        },
      },
      keyframes: {
        swing: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-100px)" },
        },
      },
    },
  },

  // The output directory for your css system
  outdir: "styled-system",
});
