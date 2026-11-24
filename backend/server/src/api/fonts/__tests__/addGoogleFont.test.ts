// @vitest-environment node
import fs from "node:fs";
import { Pool } from "pg";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

// The file store reads these when its module loads.
const { uploads, previous } = vi.hoisted(() => {
  const dir = require("fs").mkdtempSync(
    require("path").join(require("os").tmpdir(), "google-fonts-"),
  );
  const previous = {
    UPLOADS_PATH: process.env.UPLOADS_PATH,
    STORAGE_TYPE: process.env.STORAGE_TYPE,
  };
  process.env.UPLOADS_PATH = dir;
  process.env.STORAGE_TYPE = "file";
  return { uploads: dir, previous };
});

// Too long for the font row, so the last step fails
const TOO_LONG = "L".repeat(201);

const CATALOG =
  ")]}'\n" +
  JSON.stringify({
    familyMetadataList: [
      {
        family: "Lora",
        category: "Serif",
        fonts: { "400": {}, "400i": {} },
        axes: [{ tag: "wght", min: 400, max: 700 }],
      },
      { family: TOO_LONG, category: "Serif", fonts: { "400": {} } },
    ],
  });

const FILE_A = "https://fonts.gstatic.com/s/lora/v35/a.woff2";
const FILE_B = "https://fonts.gstatic.com/s/lora/v35/b.woff2";
const CSS = `@font-face {
  font-family: 'Lora';
  font-style: normal;
  font-weight: 400 700;
  src: url(${FILE_A}) format('woff2');
  unicode-range: U+0000-00FF;
}
@font-face {
  font-family: 'Lora';
  font-style: italic;
  font-weight: 400 700;
  src: url(${FILE_B}) format('woff2');
}`;

let failFile: string | null = null;
let slowFile: string | null = null;
const requested: string[] = [];

const fakeFetch = async (input: string | URL | Request) => {
  const url = String(input);
  requested.push(url);
  if (url.startsWith("https://fonts.google.com/metadata/fonts")) {
    return new Response(CATALOG);
  }
  if (url.startsWith("https://fonts.googleapis.com/css2")) {
    return new Response(CSS, { headers: { "content-type": "text/css" } });
  }
  if (url === failFile) return new Response("nope", { status: 500 });
  if (url === slowFile) await new Promise((r) => setTimeout(r, 200));
  if (url === FILE_A || url === FILE_B) {
    return new Response(Buffer.from(`font:${url}`));
  }
  return new Response("not found", { status: 404 });
};

let pool: Pool;
let orgId: string;
let addGoogleFontToOrganization: typeof import("../addGoogleFont").addGoogleFontToOrganization;
let withPgClientFromPool: typeof import("../../../utils/withPgClientFromPool").withPgClientFromPool;

const query = async (text: string, params: unknown[] = []) =>
  (await pool.query(text, params)).rows;

const add = (family = "Lora") =>
  addGoogleFontToOrganization({
    withPgClient: withPgClientFromPool(pool),
    rootPgPool: pool,
    organizationId: orgId,
    userId: null,
    family,
  });

beforeAll(async () => {
  if (!process.env.TEST_DATABASE_URL) {
    throw new Error("Cannot run tests without a TEST_DATABASE_URL");
  }
  pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
  vi.stubGlobal("fetch", vi.fn(fakeFetch));
  const file = await import("@repo/backend-shared");
  expect(file.media.UPLOADS_PATH).toBe(uploads);
  ({ addGoogleFontToOrganization } = await import("../addGoogleFont"));
  ({ withPgClientFromPool } = await import(
    "../../../utils/withPgClientFromPool"
  ));
});

afterAll(async () => {
  await pool.end();
  vi.unstubAllGlobals();
  fs.rmSync(uploads, { recursive: true, force: true });
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

beforeEach(async () => {
  failFile = null;
  slowFile = null;
  requested.length = 0;
  [{ id: orgId }] = await query(
    `insert into app_public.organizations (slug, name)
     values ($1, 'Fonts') returning id`,
    [`testgooglefonts-${Date.now()}`],
  );
});

afterEach(async () => {
  await query(`delete from app_public.organizations where id = $1`, [orgId]);
});

describe("addGoogleFontToOrganization", () => {
  it("stores the family as one upload whose files are its children", async () => {
    const { fontMediaId, family } = await add();
    expect(family).toBe("Lora");

    const media = await query(
      `select id, media_name, file_extension, is_user_uploaded, is_complete
       from app_public.medias where organization_id = $1 order by file_extension`,
      [orgId],
    );
    expect(media.map((m) => [m.file_extension, m.is_user_uploaded])).toEqual([
      ["css", true],
      ["woff2", false],
      ["woff2", false],
    ]);
    expect(media.every((m) => m.is_complete)).toBe(true);

    const sheet = media.find((m) => m.file_extension === "css")!;
    expect(sheet.id).toBe(fontMediaId);
    const children = await query(
      `select child_media_id from app_public.media_dependencies
       where parent_media_id = $1`,
      [fontMediaId],
    );
    expect(children.map((c) => c.child_media_id).sort()).toEqual(
      media
        .filter((m) => m.file_extension === "woff2")
        .map((m) => m.id)
        .sort(),
    );

    const css = fs.readFileSync(`${uploads}/${sheet.media_name}`, "utf8");
    expect(css).not.toContain("gstatic");
    for (const m of media.filter((m) => m.file_extension === "woff2")) {
      expect(css).toContain(`url(/media/data/${m.media_name})`);
    }
    expect(css).toContain("unicode-range: U+0000-00FF;");

    expect(requested.find((u) => u.includes("css2"))).toContain(
      "family=Lora:ital,wght@0,400..700;1,400..700",
    );

    expect(
      await query(
        `select family, category, source,
           app_public.media_font_metadata_css_url(f) as css_url
         from app_public.organization_fonts($1) f`,
        [orgId],
      ),
    ).toEqual([
      {
        family: "Lora",
        category: "serif",
        source: "google",
        css_url: `/media/data/${sheet.media_name}`,
      },
    ]);
  });

  it("leaves nothing behind when a file fails to download", async () => {
    // A finishes after B fails, and must be removed too
    slowFile = FILE_A;
    failFile = FILE_B;
    await expect(add()).rejects.toThrow("Font file responded 500");
    expect(
      await query(
        `select id from app_public.medias where organization_id = $1`,
        [orgId],
      ),
    ).toEqual([]);
  });

  it("leaves nothing behind when the last step fails", async () => {
    const before = fs.readdirSync(uploads).sort();
    await expect(add(TOO_LONG)).rejects.toThrow();
    expect(
      await query(
        `select id from app_public.medias where organization_id = $1`,
        [orgId],
      ),
    ).toEqual([]);
    expect(fs.readdirSync(uploads).sort()).toEqual(before);
  });

  it("refuses a family Google does not have", async () => {
    await expect(add("Not A Font")).rejects.toThrow(
      "Font not found on Google Fonts",
    );
  });
});
