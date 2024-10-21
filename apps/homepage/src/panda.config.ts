import { defineConfig } from "@pandacss/dev";
import { defineTextStyles } from "@pandacss/dev";

export const textStyles = defineTextStyles({
  body: {
    value: {
      fontWeight: "400",
      fontSize: "16px",
      lineHeight: "24px",
      letterSpacing: "0",
      textDecoration: "None",
      textTransform: "None",
    },
  },
  heading: {
    value: {
      md: {
        fontSize: "2.25rem",
        marginBottom: "30px" as any,
      },
      marginBottom: "20px" as any,
      fontSize: "1.68rem",
      lineHeight: 1.111,
      fontWeight: "700",
      letterSpacing: "0",
    },
  },
  link: {
    value: {
      textDecoration: "none",
      color: "#0076d1" as any,
      _osDark: {
        color: "#41adff" as any,
      },
      _hover: {
        textDecoration: "underline",
      },
    },
  },
});

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
      textStyles,
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
