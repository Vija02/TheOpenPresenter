import { extendTheme, withDefaultSize } from "@chakra-ui/react";


export const theme = extendTheme(
  withDefaultSize({
    size: "lg",
    components: ["Heading"],
  }),
  {
    styles: {
      global: {
        body: {
          fontSize: "14px",
        },
      },
    },
    fonts: {
      heading: "'Source Sans 3 Variable', sans-serif",
      body: "'Inter Variable', sans-serif",
    },
    colors: {
      subtitle: "#718096", // gray.500
      secondary: "#ddd",
      brand: {
        100: "#fde9ea",
        200: "#fcd8db",
        300: "#fac6ca",
        400: "#f8b1b6",
        500: "#f699a0",
        600: "#f37b84",
        700: "#ef515c",
        800: "#c63640",
        900: "#762026",
      },
    },
    components: {
      Heading: {
        baseStyle: {
          fontWeight: "medium",
          // lineHeight: "54px",
          // letterSpacing: "1.5px",
          marginBottom: 3,
          color: "gray.800",
        },
      },
      Text: {
        baseStyle: {
          letterSpacing: "0.4px",
          color: "gray.700",
        },
        variants: {
          subtitle: {
            color: "subtitle",
          },
        },
      },
      Button: {
        variants: {
          ghost: {
            rounded: "none",
          },
        },
      },
      Link: {
        baseStyle: {
          color: "blue.600",
          textDecoration: "underline",
        },
        variants: {
          footer: {
            color: "white",
            textDecoration: "none",
            fontWeight: "bold",
            _hover: {
              color: "white",
              textDecoration: "underline",
            },
          },
          linkButton: {
            color: "gray.700",
            textDecoration: "none",
            _hover: {
              color: "blue.600",
              textDecoration: "underline",
            },
          },
          button: {
            color: "gray.700",
            textDecoration: "none",
            _hover: {
              textDecoration: "none",
            },
          },
        },
      },
    },
  },
);