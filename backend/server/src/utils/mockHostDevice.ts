import { logger } from "@repo/observability";
import axios from "axios";
import { ChildProcess, spawn } from "child_process";
import { Application, Express } from "express";

import { getRootPgPool } from "../middleware/installDatabasePools";

/**
 * Helper functions for E2E testing of host projects feature.
 *
 * The actual mock host device (dumbpipe) is managed by the functions in this file.
 * This includes starting/stopping dumbpipe and calling device host API endpoints.
 */

// Type for Express app that works with both Express and Application types
type ExpressApp = Express | Application;

// =============================================================================
// Mock Host Device Management
// =============================================================================

interface MockDeviceInfo {
  process: ChildProcess;
  irohEndpointId: string;
  irohTicket: string;
}

export interface MockHostConfig {
  serverHost: string;
  serverPort: number;
}

export const DEFAULT_MOCK_HOST_CONFIG: MockHostConfig = {
  serverHost: "127.0.0.1",
  serverPort: 5678,
};

// Store the active mock device for E2E tests
let activeMockDevice: MockDeviceInfo | null = null;

/**
 * Start the dumbpipe process and extract the ticket
 */
async function startDumbpipeProcess(
  config: MockHostConfig,
): Promise<MockDeviceInfo> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Timeout waiting for dumbpipe to start"));
    }, 30000);

    const dumbpipe = spawn("dumbpipe", [
      "listen-tcp",
      "--host",
      `${config.serverHost}:${config.serverPort}`,
    ]);

    let stderrBuffer = "";
    let resolved = false;

    const tryParseTicket = (buffer: string): string | null => {
      if (resolved) return null;

      const lines = buffer.split("\n");
      for (const line of lines) {
        const trimmedLine = line.trim();

        // Look for the "dumbpipe connect-tcp" line which contains the ticket
        if (trimmedLine.startsWith("dumbpipe connect-tcp ")) {
          const ticket = trimmedLine
            .replace("dumbpipe connect-tcp ", "")
            .trim();
          if (ticket.length > 50) {
            return ticket;
          }
        }

        // Also try matching standalone ticket lines
        if (
          trimmedLine.startsWith("endpoint") &&
          trimmedLine.length > 100 &&
          !trimmedLine.includes(" ")
        ) {
          return trimmedLine;
        }
      }
      return null;
    };

    const handleTicketFound = (ticket: string) => {
      const irohTicket = ticket;
      // Use first 52 chars as endpoint ID
      const irohEndpointId =
        ticket.length >= 52 ? ticket.substring(0, 52) : ticket;

      resolved = true;
      clearTimeout(timeout);
      resolve({ process: dumbpipe, irohEndpointId, irohTicket });
    };

    dumbpipe.stderr.on("data", (data) => {
      stderrBuffer += data.toString();
      const ticket = tryParseTicket(stderrBuffer);
      if (ticket) handleTicketFound(ticket);
    });

    dumbpipe.stdout.on("data", (data) => {
      const ticket = tryParseTicket(data.toString());
      if (ticket) handleTicketFound(ticket);
    });

    dumbpipe.on("error", (err) => {
      if (!resolved) {
        clearTimeout(timeout);
        reject(err);
      }
    });

    dumbpipe.on("exit", (code) => {
      if (!resolved) {
        clearTimeout(timeout);
        reject(
          new Error(
            `dumbpipe exited with code ${code} before providing ticket. stderr: ${stderrBuffer}`,
          ),
        );
      }
    });
  });
}

/**
 * Call the device host API endpoint
 */
async function callDeviceHostApi(
  config: MockHostConfig,
  endpoint: string,
  body: object = {},
): Promise<void> {
  await axios.post(
    `http://${config.serverHost}:${config.serverPort}${endpoint}`,
    body,
    {
      headers: {
        "Content-Type": "application/json",
        "x-top-csrf-protection": "1",
      },
    },
  );
}

/**
 * Start the mock host device
 */
export async function startMockHostDevice(
  config: MockHostConfig = DEFAULT_MOCK_HOST_CONFIG,
): Promise<{ irohEndpointId: string; irohTicket: string }> {
  // Return existing device if already running
  if (activeMockDevice) {
    return {
      irohEndpointId: activeMockDevice.irohEndpointId,
      irohTicket: activeMockDevice.irohTicket,
    };
  }

  // Start dumbpipe
  const deviceInfo = await startDumbpipeProcess(config);
  activeMockDevice = deviceInfo;

  // Handle process exit
  deviceInfo.process.on("exit", () => {
    activeMockDevice = null;
  });

  // Initialize device host handler
  await callDeviceHostApi(config, "/device/host/init", {
    irohEndpointId: deviceInfo.irohEndpointId,
    irohTicket: deviceInfo.irohTicket,
  });

  return {
    irohEndpointId: deviceInfo.irohEndpointId,
    irohTicket: deviceInfo.irohTicket,
  };
}

/**
 * Stop the mock host device
 */
export async function stopMockHostDevice(
  config: MockHostConfig = DEFAULT_MOCK_HOST_CONFIG,
): Promise<void> {
  if (!activeMockDevice) return;

  // Stop device host handler (ignore errors)
  try {
    await callDeviceHostApi(config, "/device/host/stop");
  } catch {
    // Ignore errors
  }

  // Kill dumbpipe
  activeMockDevice.process.kill();
  activeMockDevice = null;
}

/**
 * Sync the mock host device by re-initializing
 */
export async function syncMockHostDevice(
  config: MockHostConfig = DEFAULT_MOCK_HOST_CONFIG,
): Promise<void> {
  if (!activeMockDevice) {
    throw new Error("Mock host device not running");
  }

  await callDeviceHostApi(config, "/device/host/init", {
    irohEndpointId: activeMockDevice.irohEndpointId,
    irohTicket: activeMockDevice.irohTicket,
  });
}

/**
 * Get the status of the mock host device
 */
export function getMockHostDeviceStatus(): {
  running: boolean;
  irohEndpointId?: string;
} {
  if (!activeMockDevice) {
    return { running: false };
  }
  return {
    running: true,
    irohEndpointId: activeMockDevice.irohEndpointId,
  };
}

// =============================================================================
// Database Helper Functions
// =============================================================================

/**
 * Clear all organization_active_devices entries
 * Used for test cleanup
 */
export async function clearAllActiveDevices(app: ExpressApp): Promise<void> {
  const rootPgPool = getRootPgPool(app as Express);
  await rootPgPool.query(`DELETE FROM app_public.organization_active_devices`);
  logger.info("Cleared all organization_active_devices");
}
