import { request } from "@playwright/test";

/**
 * Clears every test user and org once, before any worker starts. Workers only
 * clean up their own tagged data, so this is what removes leftovers from
 * crashed runs and from data that is not tagged (e.g. random client-plugin
 * orgs).
 */
export default async function globalSetup() {
  const api = await request.newContext({
    baseURL: process.env.E2E_BASE_URL || "http://localhost:5678",
  });
  for (const command of ["clearTestUsers", "clearTestOrganizations"]) {
    const res = await api.get(`/E2EServerCommand?command=${command}`);
    if (!res.ok()) {
      throw new Error(
        `${command} failed (${res.status()}): ${await res.text()}`,
      );
    }
  }
  await api.dispose();
}
