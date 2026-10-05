import { describe, expect, it } from "vitest";

import {
  RawCloudSyncTable,
  resolveCloudSyncTable,
} from "../src/cloud/sync/pluginTables/introspection";

const orgFk = {
  columns: ["organization_id"],
  references: "app_public.organizations",
  referenced_columns: ["id"],
};

const raw = (overrides: Partial<RawCloudSyncTable>): RawCloudSyncTable => ({
  schema_name: "plugin_test",
  table_name: "thing",
  comment: "@cloudSync",
  columns: ["id", "organization_id", "updated_at"],
  defaulted_columns: ["id"],
  unique_keys: [{ primary: true, columns: ["id"] }],
  foreign_keys: [orgFk],
  ...overrides,
});

describe("resolveCloudSyncTable", () => {
  it("keys an ordinary table by its primary key and clears user references", () => {
    expect(
      resolveCloudSyncTable(
        raw({
          columns: [
            "id",
            "organization_id",
            "created_by_user_id",
            "updated_at",
          ],
          foreign_keys: [
            orgFk,
            {
              columns: ["created_by_user_id"],
              references: "app_public.users",
              referenced_columns: ["id"],
            },
          ],
        }),
      ),
    ).toMatchObject({
      organizationColumn: "organization_id",
      keyColumns: ["id"],
      localIdentityColumns: [],
      userColumns: ["created_by_user_id"],
    });
  });

  it("prefers an organization-scoped key, since ids differ for per-org rows", () => {
    expect(
      resolveCloudSyncTable(
        raw({
          unique_keys: [
            { primary: true, columns: ["id"] },
            { primary: false, columns: ["organization_id"] },
          ],
        }),
      ),
    ).toMatchObject({
      keyColumns: ["organization_id"],
      // Matched by org, so each side keeps its own id.
      localIdentityColumns: ["id"],
    });
  });

  it("uses a composite primary key that includes the organization", () => {
    expect(
      resolveCloudSyncTable(
        raw({
          columns: ["organization_id", "source", "updated_at"],
          unique_keys: [
            { primary: true, columns: ["organization_id", "source"] },
          ],
        }),
      ),
    ).toMatchObject({ keyColumns: ["organization_id", "source"] });
  });

  it("refuses a table referencing rows whose ids differ between instances", () => {
    expect(
      resolveCloudSyncTable(
        raw({
          foreign_keys: [
            orgFk,
            {
              columns: ["project_id"],
              references: "app_public.projects",
              referenced_columns: ["id"],
            },
          ],
        }),
      ),
    ).toEqual({
      error: "references app_public.projects, which cannot be synced by id",
    });
  });

  it("refuses a table that is not scoped to an organization", () => {
    expect(resolveCloudSyncTable(raw({ foreign_keys: [] }))).toHaveProperty(
      "error",
    );
  });

  it("refuses a table without updated_at", () => {
    expect(
      resolveCloudSyncTable(raw({ columns: ["id", "organization_id"] })),
    ).toHaveProperty("error");
  });

  it("defaults to conflict copies when the key is a generated primary key", () => {
    expect(resolveCloudSyncTable(raw({}))).toMatchObject({
      conflict: "copy",
      rowKeyColumns: ["id"],
    });
  });

  it("defaults to cloud wins for one-row-per-org tables", () => {
    expect(
      resolveCloudSyncTable(
        raw({
          unique_keys: [
            { primary: true, columns: ["id"] },
            { primary: false, columns: ["organization_id"] },
          ],
        }),
      ),
    ).toMatchObject({ conflict: "cloudWins", rowKeyColumns: [] });
  });

  it("honours an explicit strategy and copy label", () => {
    expect(
      resolveCloudSyncTable(
        raw({
          comment: "@cloudSync\n@cloudSyncConflict cloudWins",
        }),
      ),
    ).toMatchObject({ conflict: "cloudWins" });
    expect(
      resolveCloudSyncTable(
        raw({
          columns: ["id", "organization_id", "title", "updated_at"],
          comment: "@cloudSync\n@cloudSyncCopyLabel title",
        }),
      ),
    ).toMatchObject({ conflict: "copy", copyLabelColumn: "title" });
  });

  it("refuses copies when a copy could not get its own key", () => {
    expect(
      resolveCloudSyncTable(
        raw({
          comment: "@cloudSync\n@cloudSyncConflict copy",
          defaulted_columns: [],
        }),
      ),
    ).toHaveProperty("error");
  });

  it("refuses a copy label naming a missing column", () => {
    expect(
      resolveCloudSyncTable(
        raw({ comment: "@cloudSync\n@cloudSyncCopyLabel nope" }),
      ),
    ).toHaveProperty("error");
  });

  describe("references to another plugin table", () => {
    const song = raw({ table_name: "song" });
    const usage = (overrides: Partial<RawCloudSyncTable> = {}) =>
      raw({
        table_name: "usage",
        columns: ["id", "organization_id", "song_id", "updated_at"],
        foreign_keys: [
          orgFk,
          {
            columns: ["song_id"],
            references: "plugin_test.song",
            referenced_columns: ["id"],
          },
        ],
        ...overrides,
      });

    it("allows one keyed by its primary key, which both sides share", () => {
      expect(resolveCloudSyncTable(usage(), [song, usage()])).toMatchObject({
        pluginReferences: [
          {
            column: "song_id",
            table: "song",
            keyColumn: "id",
            organizationColumn: "organization_id",
          },
        ],
      });
    });

    it("refuses one to a table that is not marked", () => {
      expect(resolveCloudSyncTable(usage(), [usage()])).toEqual({
        error: "references plugin_test.song, which cannot be synced by id",
      });
    });

    it("refuses one to a table keyed by organization, whose ids differ", () => {
      const perOrg = raw({
        table_name: "song",
        unique_keys: [
          { primary: true, columns: ["id"] },
          { primary: false, columns: ["organization_id"] },
        ],
      });
      expect(resolveCloudSyncTable(usage(), [perOrg, usage()])).toHaveProperty(
        "error",
      );
    });

    it("refuses a cycle", () => {
      const a = usage({
        table_name: "a",
        foreign_keys: [
          orgFk,
          {
            columns: ["song_id"],
            references: "plugin_test.b",
            referenced_columns: ["id"],
          },
        ],
      });
      const b = usage({
        table_name: "b",
        foreign_keys: [
          orgFk,
          {
            columns: ["song_id"],
            references: "plugin_test.a",
            referenced_columns: ["id"],
          },
        ],
      });
      expect(resolveCloudSyncTable(a, [a, b])).toHaveProperty("error");
    });
  });
});
