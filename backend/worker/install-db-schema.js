const { runMigrations } = require("graphile-worker");

runMigrations({ connectionString: process.env.GM_DBURL });
