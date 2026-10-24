/**
 * Names for the data a Playwright worker creates, so workers running at the
 * same time never share an org or user.
 *
 * Orgs end in `-<tag>` and users in `_<tag>`; `clearWorkerTestData` deletes
 * exactly that set, leaving other workers' data alone.
 */
// The parallel index stays within 0..workers-1 and a replacement worker (after
// a failure) inherits its predecessor's, so it also clears what that one left.
export const WORKER_TAG = `w${process.env.TEST_PARALLEL_INDEX ?? "0"}`;

/** An org (or other) slug owned by this worker. Must start with "test". */
export const tagged = (slug: string) => `${slug}-${WORKER_TAG}`;

/** A username owned by this worker. Must start with "testuser". */
export const taggedUser = (username: string = "testuser") =>
  `${username}_${WORKER_TAG}`;

export const ORG_SLUG = tagged("testorg");
export const ORG_NAME = "TestOrg";
export const PROJECT_SLUG = "testproject";
export const USERNAME = taggedUser();

export const orgUrl = (slug: string = ORG_SLUG) => `/o/${slug}`;
export const projectUrl = (
  orgSlug: string = ORG_SLUG,
  projectSlug: string = PROJECT_SLUG,
) => `/app/${orgSlug}/${projectSlug}`;
