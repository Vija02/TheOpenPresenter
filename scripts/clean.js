#!/usr/bin/env node
(async () => {
  const { default: rimraf } = await import("rimraf");
  const { globSync } = await import("glob");
  try {
    await rimraf(globSync(`${__dirname}/../*/dist`));
    await rimraf(globSync(`${__dirname}/../*/tsconfig.tsbuildinfo`));
    console.log("Deleted");
  } catch (e) {
    console.error("Failed to clean up, perhaps rimraf isn't installed?");
    console.error(e);
  }
})();
