import * as net from "net";

// Track used ports to avoid conflicts
const usedPorts = new Set<number>();
const BASE_PORT = 30000;
const MAX_PORT = 50000;

/**
 * Find an available port in the configured range.
 * Verifies the port is actually available on the system before returning.
 */
export const findAvailablePort = (): Promise<number> => {
  return new Promise((resolve, reject) => {
    // Find a port that isn't already used by our connections
    let port = BASE_PORT;
    while (usedPorts.has(port) && port <= MAX_PORT) {
      port++;
    }

    if (port > MAX_PORT) {
      reject(new Error("No available ports in range"));
      return;
    }

    // Verify the port is actually available on the system
    const server = net.createServer();
    server.listen(port, "0.0.0.0", () => {
      server.close(() => {
        usedPorts.add(port);
        resolve(port);
      });
    });
    server.on("error", () => {
      // Port is in use, try next one
      usedPorts.add(port);
      findAvailablePort().then(resolve).catch(reject);
    });
  });
};

/**
 * Release a port back to the available pool.
 */
export const releasePort = (port: number): void => {
  usedPorts.delete(port);
};

/**
 * Wait for a TCP port to become available (accepting connections).
 * Returns true if port is available within timeout, false otherwise.
 */
export const waitForPort = async (
  port: number,
  maxWaitMs: number = 5000,
): Promise<boolean> => {
  const startTime = Date.now();
  while (Date.now() - startTime < maxWaitMs) {
    const isAvailable = await new Promise<boolean>((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(500);
      socket.on("connect", () => {
        socket.destroy();
        resolve(true);
      });
      socket.on("error", () => {
        socket.destroy();
        resolve(false);
      });
      socket.on("timeout", () => {
        socket.destroy();
        resolve(false);
      });
      socket.connect(port, "127.0.0.1");
    });
    if (isAvailable) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return false;
};
