#!/usr/bin/env node

const { execSync } = require("child_process");

// For production, we'll run it separately during build time since we need the source code
if (process.env.NODE_ENV !== "production") {
  execSync("yarn homepage codegen", {
    stdio: "inherit",
    cwd: process.cwd(),
  });
}
