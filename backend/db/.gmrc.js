const path = require("path");
/*
 * Graphile Migrate configuration.
 *
 * This file is version tracked, do not add any secrets (passwords, etc) to it
 * - manage these with environmental variables instead.
 *
 * This file is in JSON5 format, in VSCode you can use "JSON with comments" as
 * the file format.
 */
module.exports = {
  /*
   * Database connections strings are sourced from the DATABASE_URL,
   * SHADOW_DATABASE_URL and ROOT_DATABASE_URL environmental variables.
   */

  /*
   * pgSettings: key-value settings to be automatically loaded into PostgreSQL
   * before running migrations, using an equivalent of `SET LOCAL <key> TO
   * <value>`
   */
  pgSettings: {
    search_path: "app_public,app_private,app_hidden,public",
  },

  /*
   * placeholders: substituted in SQL files when compiled/executed. Placeholder
   * keys should be prefixed with a colon and in all caps, like
   * `:COLON_PREFIXED_ALL_CAPS`. Placeholder values should be strings. They
   * will be replaced verbatim with NO ESCAPING AT ALL (this differs from how
   * psql handles placeholders) so should only be used with "safe" values. This
   * is useful for committing migrations where certain parameters can change
   * between environments (development, staging, production) but you wish to
   * use the same signed migration files for all.
   *
   * The special value "!ENV" can be used to indicate an environmental variable
   * of the same name should be used.
   *
   * Graphile Migrate automatically sets the `:DATABASE_NAME` and
   * `:DATABASE_OWNER` placeholders, and you should not attempt to override
   * these.
   */
  placeholders: {
    ":DATABASE_AUTHENTICATOR": "!ENV",
    ":DATABASE_VISITOR": "!ENV",
  },

  /*
   * Actions allow you to run scripts or commands at certain points in the
   * migration lifecycle. SQL files are ran against the database directly.
   * "command" actions are ran with the following environmental variables set:
   *
   * - GM_DBURL: the PostgreSQL URL of the database being migrated
   * - GM_DBNAME: the name of the database from GM_DBURL
   * - GM_DBUSER: the user from GM_DBURL
   * - GM_SHADOW: set to 1 if the shadow database is being migrated, left unset
   *   otherwise
   *
   * If "shadow" is unspecified, the actions will run on events to both shadow
   * and normal databases. If "shadow" is true the action will only run on
   * actions to the shadow DB, and if false only on actions to the main DB.
   */

  /*
   * afterReset: actions executed after a `graphile-migrate reset` command.
   */
  afterReset: [
    "!afterReset.sql",
    {
      _: "command",
      command: `node ${path.resolve(__dirname, "../worker/install-db-schema.js")}`,
    },
  ],

  /*
   * afterAllMigrations: actions executed once all migrations are complete.
   */
  afterAllMigrations: [
    {
      _: "command",
      shadow: true,
      // NOTE: this script does nothing when envvar `IN_TESTS` is `1`
      command: "node scripts/dump-db.js",
    },
  ],

  /*
   * afterCurrent: actions executed once the current migration has been
   * evaluated (i.e. in watch mode).
   */
  afterCurrent: [
    {
      _: "command",
      shadow: true,
      // NOTE: this script does nothing unless envvar `IN_TESTS` is `1`
      command: "node scripts/test-seed.js",
    },
  ],

  /*
   * blankMigrationContent: content to be written to the current migration
   * after commit. NOTE: this should only contain comments.
   */
  // "blankMigrationContent": "",

  /****************************************************************************\
  ***                                                                        ***
  ***         You probably don't want to edit anything below here.           ***
  ***                                                                        ***
  \****************************************************************************/

  /*
   * manageGraphileMigrateSchema: if you set this false, you must be sure to
   * keep the graphile_migrate schema up to date yourself. We recommend you
   * leave it at its default.
   */
  // "manageGraphileMigrateSchema": true,

  /*
   * migrationsFolder: path to the folder in which to store your migrations.
   */
  migrationsFolder: __dirname + "/migrations",

  "//generatedWith": "0.1.0",
};
