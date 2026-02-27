#!/usr/bin/env npx ts-node

/**
 * Mock Host Device Script
 *
 * Starts a mock host device for E2E testing.
 * Press Ctrl+C to stop.
 *
 * Usage: yarn e2e mock-host-device
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:5678";

async function serverCommand(command: string): Promise<void> {
  const url = new URL("/E2EServerCommand", BASE_URL);
  url.searchParams.set("command", command);

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`${command} failed: ${response.status}`);
  }
}

async function main(): Promise<void> {
  console.log("Starting mock host device...");

  await serverCommand("startMockHostDevice");

  console.log("Mock host device is running. Press Ctrl+C to stop.");

  // Cleanup on Ctrl+C
  process.on("SIGINT", async () => {
    console.log("\nStopping...");
    await serverCommand("stopMockHostDevice");
    process.exit(0);
  });

  // Keep process alive
  setInterval(() => {}, 60000);
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exit(1);
});
