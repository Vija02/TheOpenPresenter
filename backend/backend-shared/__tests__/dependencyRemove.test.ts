import express from "express";
import fs from "fs";
import { Pool } from "pg";
import { describe, expect, it, vi } from "vitest";

import {
  becomeRoot,
  becomeUser,
  createOrganizations,
  createUsers,
  withRootDb,
} from "../../db/__tests__/helpers";
import * as media from "../src/media";
import {
  createMedia,
  createMediaDependency,
} from "./../../../packages/test/src/mediaHelper";

describe("Media Dependency Remove", () => {
  it("should remove child media when the parent is removed in s3 storage", async () => {
    vi.stubEnv("STORAGE_S3_BUCKET", "test");
    vi.stubEnv("STORAGE_S3_REGION", "test");
    vi.stubEnv("STORAGE_S3_ENDPOINT", "https://s3.example.com");
    vi.stubEnv("STORAGE_S3_ACCESS_KEY_ID", "test");
    vi.stubEnv("STORAGE_S3_SECRET_ACCESS_KEY", "test");
    vi.stubEnv("STORAGE_TYPE", "s3");

    await withRootDb(async (client) => {
      // Insert data
      const [user] = await createUsers(client);
      await becomeUser(client, user);
      const [org] = await createOrganizations(client);
      await becomeRoot(client);

      const m1 = await createMedia(client, org.id);
      const m2 = await createMedia(client, org.id);
      const m3 = await createMedia(client, org.id);

      await createMediaDependency(client, m1.uuid, m2.uuid);
      await createMediaDependency(client, m2.uuid, m3.uuid);

      const { rows: initialMedias } = await client.query(
        `SELECT * FROM app_public.medias`,
      );

      expect(initialMedias).toHaveLength(3);

      // Then let's trigger delete
      await new media[process.env.STORAGE_TYPE!].mediaHandler(
        client,
      ).deleteMedia(m1.mediaName);

      // Let's check
      const { rows: newMedias } = await client.query(
        `SELECT * FROM app_public.medias`,
      );

      expect(newMedias).toHaveLength(0);
    });
  });
  it("should remove child media when the parent is removed in file storage", async () => {
    // No need to check if it's deleted here
    vi.spyOn(fs, "unlink").mockImplementation((path, callback) =>
      callback(null),
    );
    vi.stubEnv("STORAGE_TYPE", "file");

    await withRootDb(async (client) => {
      // Setup
      const app = express();
      app.set("rootPgPool", client);

      // Insert data
      const [user] = await createUsers(client);
      await becomeUser(client, user);
      const [org] = await createOrganizations(client);
      await becomeRoot(client);

      const m1 = await createMedia(client, org.id);
      const m2 = await createMedia(client, org.id);
      const m3 = await createMedia(client, org.id);

      await createMediaDependency(client, m1.uuid, m2.uuid);
      await createMediaDependency(client, m2.uuid, m3.uuid);

      const { rows: initialMedias } = await client.query(
        `SELECT * FROM app_public.medias`,
      );

      expect(initialMedias).toHaveLength(3);

      // Then let's trigger delete
      await new media[process.env.STORAGE_TYPE!].mediaHandler(
        client,
      ).deleteMedia(m1.mediaName);

      // Let's check
      const { rows: newMedias } = await client.query(
        `SELECT * FROM app_public.medias`,
      );

      expect(newMedias).toHaveLength(0);
    });
  });
});
