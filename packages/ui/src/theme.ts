import { createSystem, defaultConfig, defineRecipe } from "@chakra-ui/react";

export const system = createSystem(defaultConfig, {
  globalCss: {
    body: {
      fontSize: "14px",
    },
  },
  theme: {
    recipes: {
      // heading: defineRecipe({
      //   base: {
      //     size: "lg",
      //   },
      // }),
      heading: defineRecipe({
        base: {
          fontWeight: "medium",
          // lineHeight: "54px",
          // letterSpacing: "1.5px",
          marginBottom: 3,
          color: "gray.800",
        },
      }),
      Text: defineRecipe({
        base: {
          letterSpacing: "0.4px",
          color: "gray.700",
        },
        variants: {
          variant: {
            subtitle: {
              color: "subtitle",
            },
          },
        },
      }),
      Button: defineRecipe({
        variants: {
          variant: {
            ghost: {
              rounded: "none",
            },
          },
        },
      }),
      // Link: {
      //   baseStyle: {
      //     color: "blue.600",
      //     textDecoration: "underline",
      //   },
      //   variants: {
      //     footer: {
      //       color: "white",
      //       textDecoration: "none",
      //       fontWeight: "bold",
      //       _hover: {
      //         color: "white",
      //         textDecoration: "underline",
      //       },
      //     },
      //     linkButton: {
      //       color: "gray.700",
      //       textDecoration: "none",
      //       _hover: {
      //         color: "blue.600",
      //         textDecoration: "underline",
      //       },
      //     },
      //     button: {
      //       color: "gray.700",
      //       textDecoration: "none",
      //       _hover: {
      //         textDecoration: "none",
      //       },
      //     },
      //   },
      // },
    },
    tokens: {
      fonts: {
        heading: { value: "'Source Sans 3 Variable', sans-serif" },
        body: { value: "'Inter Variable', sans-serif" },
      },
      colors: {
        subtitle: { value: "#718096" }, // gray.500
        secondary: { value: "#ddd" },
        brand: {
          100: { value: "#fde9ea" },
          200: { value: "#fcd8db" },
          300: { value: "#fac6ca" },
          400: { value: "#f8b1b6" },
          500: { value: "#f699a0" },
          600: { value: "#f37b84" },
          700: { value: "#ef515c" },
          800: { value: "#c63640" },
          900: { value: "#762026" },
        },
      },
    },
  },
});
