/**
 * Repository layer — the single data-access surface used by controllers.
 *
 * Dispatches to MySQL (via dbClient) in normal operation, or to the in-memory
 * fileStore when USE_FILE_DATA=true (CI / no-DB testing). Controllers call these
 * named methods instead of writing SQL inline, so the same logic runs in both
 * modes. (Mirrors Mutual's controller responsibilities through one seam.)
 */
const config = require("./config");

if (config.useFileData) {
  module.exports = require("./repo.file");
} else {
  module.exports = require("./repo.mysql");
}
