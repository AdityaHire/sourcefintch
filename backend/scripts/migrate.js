/**
 * Migration runner with tracking — reads .sql files from backend/migrations/
 * in alphabetical order and executes each one against the database, but only
 * if it hasn't been applied before.
 *
 * Usage:  npm run migrate   (from the backend/ directory)
 *
 * HOW IT WORKS:
 * 1. Creates a `schema_migrations` tracking table if it doesn't exist.
 *    This table records which .sql files have already been applied.
 * 2. Reads all *.sql files from migrations/, sorted alphabetically
 *    (that's why we prefix with 001_, 002_, etc.).
 * 3. For each file, checks if it's already in schema_migrations — skips
 *    it if so.
 * 4. If not yet applied, splits the file on semicolons and executes each
 *    SQL statement, then records the filename in schema_migrations.
 *
 * IDEMPOTENT: Running `npm run migrate` twice in a row is safe — the
 * second run skips everything that was already applied.
 */

const fs = require('fs');
const path = require('path');
const { pool } = require('../src/config/database');

const MIGRATIONS_DIR = path.resolve(__dirname, '../migrations');

/**
 * Ensure the schema_migrations tracking table exists.
 * This runs before any migration files, every time.
 */
const ensureTrackingTable = async () => {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id        INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      filename  VARCHAR(255) NOT NULL UNIQUE,
      run_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
};

/**
 * Check if a migration file has already been applied.
 */
const isAlreadyApplied = async (filename) => {
  const [rows] = await pool.execute(
    'SELECT id FROM schema_migrations WHERE filename = ?',
    [filename]
  );
  return rows.length > 0;
};

/**
 * Record a migration file as applied.
 */
const recordMigration = async (filename) => {
  await pool.execute(
    'INSERT INTO schema_migrations (filename) VALUES (?)',
    [filename]
  );
};

/**
 * Parse a .sql file into executable statements.
 * Splits on semicolons, trims whitespace, and filters out empty
 * strings and comment-only blocks.
 */
const parseStatements = (sql) => {
  return sql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .filter((s) => {
      // Skip blocks that are entirely comments or blank lines
      return !s.split('\n').every(
        (line) => line.trim().startsWith('--') || line.trim() === ''
      );
    });
};

const runMigrations = async () => {
  console.log('\n🔄 Running migrations...\n');

  try {
    // Step 1: Ensure tracking table exists
    await ensureTrackingTable();

    // Step 2: Read all .sql files, sorted alphabetically
    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    if (files.length === 0) {
      console.log('  No migration files found in migrations/');
      process.exit(0);
    }

    let applied = 0;
    let skipped = 0;

    for (const file of files) {
      // Step 3: Check if already applied
      if (await isAlreadyApplied(file)) {
        console.log(`  ⏭  ${file} — already applied, skipping`);
        skipped++;
        continue;
      }

      // Step 4: Execute the migration
      console.log(`  📄 ${file}`);
      const filePath = path.join(MIGRATIONS_DIR, file);
      const sql = fs.readFileSync(filePath, 'utf-8');
      const statements = parseStatements(sql);

      for (const statement of statements) {
        await pool.execute(statement);
      }

      // Step 5: Record it as applied
      await recordMigration(file);
      console.log(`     ✅ Done (${statements.length} statements)\n`);
      applied++;
    }

    console.log(
      `✅ Migrations complete! ` +
      `(${applied} applied, ${skipped} skipped)\n`
    );
  } catch (err) {
    console.error('\n❌ Migration failed:\n', err.message);
    console.error('\nFull error:', err);
    process.exit(1);
  } finally {
    await pool.end(); // Close all pool connections before exiting
  }
};

runMigrations();
