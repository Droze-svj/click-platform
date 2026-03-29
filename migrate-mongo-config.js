// In this file you can configure migrate-mongo
require('dotenv').config({ path: './server/.env' });

const config = {
  mongodb: {
    // Dynamically pull URI and DB Name from environment variables
    url: process.env.MONGODB_URI || "mongodb://localhost:27017/click",

    // The database name is usually part of the URI, but migrate-mongo likes it separate sometimes.
    // If your URI has the DB name, leave this empty or match it.
    databaseName: process.env.DB_NAME || "click",

    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    }
  },

  migrationsDir: "server/migrations",
  changelogCollectionName: "changelog",
  lockCollectionName: "changelog_lock",
  lockTtl: 0,
  migrationFileExtension: ".js",
  useFileHash: false,
  moduleSystem: 'commonjs',
};

module.exports = config;
