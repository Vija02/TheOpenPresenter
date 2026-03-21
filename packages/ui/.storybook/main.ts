import type { StorybookConfig } from "@storybook/react-vite";
import { dirname, join } from "path";

/**
 * This function is used to resolve the absolute path of a package.
 * It is needed in projects that use Yarn PnP or are set up within a monorepo.
 */
function getAbsolutePath(value: string): any {
  return dirname(require.resolve(join(value, "package.json")));
}
const config: StorybookConfig = {
  stories: ["../src/**/*.mdx", "../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
  addons: [
    {
      name: getAbsolutePath("@storybook/addon-essentials"),
      options: {
        docs: false,
      },
    },
    getAbsolutePath("@storybook/addon-onboarding"),
    getAbsolutePath("@storybook/addon-interactions"),
  ],
  framework: {
    name: getAbsolutePath("@storybook/react-vite"),
    options: {},
  },
  viteFinal: async (config) => {
    config.server = config.server || {};
    config.server.proxy = {
      // Proxy /media/data/ requests to picsum for storybook demos
      // The media ID is used as the seed for consistent images
      "/media/data": {
        target: "https://picsum.photos",
        changeOrigin: true,
        rewrite: (path) => {
          const match = path.match(/media_([a-z0-9]+)\./);
          const seed = match ? match[1] : "default";
          return `/seed/${seed}/400/300`;
        },
      },
      "/media/processed": {
        target: "https://picsum.photos",
        changeOrigin: true,
        rewrite: (path) => {
          const sizeMatch = path.match(/\/media\/processed\/(\d+)\//);
          const size = sizeMatch ? sizeMatch[1] : "300";
          const match = path.match(/media_([a-z0-9]+)\./);
          const seed = match ? match[1] : "default";
          return `/seed/${seed}/${size}/${size}`;
        },
      },
    };
    return config;
  },
};
export default config;
