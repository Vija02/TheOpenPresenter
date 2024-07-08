/* Use via `node -r @repo/config/env path/to/file.js` */
require("dotenv").config({ path: `${__dirname}/../../.env` });
require("./extra");
