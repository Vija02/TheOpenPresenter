import { media } from "@repo/backend-shared";
import { uuidFromMediaId } from "@repo/lib";
import { logger } from "@repo/observability";
import { gql, makeExtendSchemaPlugin } from "graphile-utils";
import { Readable } from "node:stream";

import { OurGraphQLContext } from "../../graphile.config";
import { withPgClientFromPool } from "../../utils/withPgClientFromPool";
import {
  downloadFontFile,
  extractFontFileUrls,
  fetchGoogleFontCss,
  fileExtensionOf,
  getGoogleFontCatalog,
  mapLimited,
  rewriteFontFileUrls,
} from "./googleFonts";

const DOWNLOAD_CONCURRENCY = 6;

const assertMember = async (
  context: OurGraphQLContext,
  organizationId: string,
): Promise<string | null> => {
  const {
    rows: [row],
  } = await context.pgClient.query(
    `select $1::uuid in (select app_public.current_user_member_organization_ids()) as is_member,
       app_public.current_user_id() as user_id`,
    [organizationId],
  );
  if (!row?.is_member) throw new Error("Organization not found");
  return row.user_id ?? null;
};

export const addGoogleFontToOrganization = async ({
  withPgClient,
  rootPgPool,
  organizationId,
  userId,
  family,
}: {
  withPgClient: ReturnType<typeof withPgClientFromPool>;
  rootPgPool: { query: OurGraphQLContext["rootPgPool"]["query"] };
  organizationId: string;
  userId: string | null;
  family: string;
}): Promise<{ fontMediaId: string; family: string }> => {
  const font = (await getGoogleFontCatalog()).find((f) => f.family === family);
  if (!font) throw new Error("Font not found on Google Fonts");

  const css = await fetchGoogleFontCss(font);
  const urls = extractFontFileUrls(css);
  if (urls.length === 0) {
    throw new Error("Google Fonts returned no font files");
  }

  const handler = new media[
    process.env.STORAGE_TYPE as "file" | "s3"
  ].mediaHandler(withPgClient);

  const upload = (
    body: Buffer,
    fileExtension: string,
    extra: { originalFileName?: string; isUserUploaded: boolean },
  ) =>
    handler.uploadMedia({
      file: () => Readable.from([body]),
      fileExtension,
      fileSize: body.byteLength,
      userId,
      organizationId,
      skipProcessing: true,
      ...extra,
    });

  // Files first, so a stylesheet that exists is complete. On failure remove
  // everything stored: nothing else would, and it'd be hidden everywhere.
  const stored: string[] = [];
  const removeStored = () =>
    Promise.allSettled(stored.map((name) => handler.deleteMedia(name)));

  let fontMediaId: string;
  try {
    const files = await mapLimited(urls, DOWNLOAD_CONCURRENCY, async (url) => {
      const body = await downloadFontFile(url);
      const uploaded = await upload(body, fileExtensionOf(url), {
        isUserUploaded: false,
      });
      stored.push(uploaded.fileName);
      return { url, ...uploaded };
    });

    const stylesheet = rewriteFontFileUrls(
      css,
      new Map(files.map((f) => [f.url, `/media/data/${f.fileName}`])),
    );
    const sheet = await upload(Buffer.from(stylesheet, "utf8"), "css", {
      originalFileName: `${family}.css`,
      isUserUploaded: true,
    });
    stored.push(sheet.fileName);

    for (const file of files) {
      await handler.createDependency(sheet.mediaId, file.mediaId);
    }

    fontMediaId = uuidFromMediaId(sheet.mediaId);
    await rootPgPool.query(
      `insert into app_public.media_font_metadata
           (font_media_id, family, category, source)
         values ($1, $2, $3, 'google')`,
      [fontMediaId, font.family, font.category],
    );
  } catch (err) {
    await removeStored();
    throw err;
  }

  logger.info(
    { organizationId, family, files: stored.length - 1 },
    "Added Google font",
  );

  return { fontMediaId, family: font.family };
};

/**
 * A family is a stylesheet in the organization's media, with its font files
 * as children so they sync and delete with it. That's what makes it offline.
 */
export const addGoogleFont = makeExtendSchemaPlugin(() => ({
  typeDefs: gql`
    type GoogleFontCatalogEntry {
      family: String!
      """
      sans, serif, display or mono.
      """
      category: String!
      """
      Google's own category, eg Handwriting.
      """
      googleCategory: String!
      styleCount: Int!
      """
      Number of variable axes, 0 for a static family.
      """
      axisCount: Int!
      designers: [String!]!
      """
      1 is the most used.
      """
      popularity: Int!
      """
      ISO 15924 code of the script it is made for, eg Thai. Empty for Latin.
      """
      primaryScript: String!
      hasLatin: Boolean!
    }

    extend type Query {
      """
      Every family Google Fonts offers. Needs internet.
      """
      googleFontCatalog: [GoogleFontCatalogEntry!]!
    }

    input AddGoogleFontInput {
      organizationId: UUID!
      family: String!
    }

    type AddGoogleFontPayload {
      fontMediaId: UUID!
      family: String!
      """
      True when the organization already had this family.
      """
      alreadyAdded: Boolean!
    }

    extend type Mutation {
      """
      Download every weight and style of a Google Fonts family into the
      organization.
      """
      addGoogleFont(input: AddGoogleFontInput!): AddGoogleFontPayload
    }
  `,
  resolvers: {
    Query: {
      async googleFontCatalog(_query, _args, context: OurGraphQLContext) {
        const {
          rows: [row],
        } = await context.pgClient.query(
          `select app_public.current_user_id() as user_id`,
        );
        if (!row?.user_id) throw new Error("Not logged in");
        const families = await getGoogleFontCatalog();
        return families.map((f) => ({
          family: f.family,
          category: f.category,
          googleCategory: f.googleCategory,
          styleCount: f.styles.length,
          axisCount: f.axisCount,
          designers: f.designers,
          popularity: f.popularity,
          primaryScript: f.primaryScript,
          hasLatin: f.hasLatin,
        }));
      },
    },
    Mutation: {
      async addGoogleFont(
        _mutation,
        args: { input: { organizationId: string; family: string } },
        context: OurGraphQLContext,
      ) {
        const { organizationId, family } = args.input;
        const userId = await assertMember(context, organizationId);
        const rootWithPgClient = withPgClientFromPool(context.rootPgPool);

        // So two people adding the same family get one copy. Own connection,
        // held for the whole download.
        const lockClient = await context.rootPgPool.connect();
        const lockKey = `google-font:${organizationId}:${family.toLowerCase()}`;
        try {
          await lockClient.query(`select pg_advisory_lock(hashtext($1))`, [
            lockKey,
          ]);

          const {
            rows: [existing],
          } = await context.rootPgPool.query(
            `select f.font_media_id, f.family
             from app_public.media_font_metadata f
             join app_public.medias m on m.id = f.font_media_id
             where m.organization_id = $1 and lower(f.family) = lower($2)
             order by f.created_at
             limit 1`,
            [organizationId, family],
          );
          if (existing) {
            return {
              fontMediaId: existing.font_media_id,
              family: existing.family,
              alreadyAdded: true,
            };
          }

          const added = await addGoogleFontToOrganization({
            withPgClient: rootWithPgClient,
            rootPgPool: context.rootPgPool,
            organizationId,
            userId,
            family,
          });
          return { ...added, alreadyAdded: false };
        } finally {
          await lockClient
            .query(`select pg_advisory_unlock(hashtext($1))`, [lockKey])
            .catch(() => undefined);
          lockClient.release();
        }
      },
    },
  },
}));
