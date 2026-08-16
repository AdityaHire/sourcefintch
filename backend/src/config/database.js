/**
 * MySQL connection pool — the single point of database access for the
 * entire backend.
 *
 * WHAT IS A CONNECTION POOL?
 * Opening a new MySQL connection for every query is slow (TCP handshake,
 * authentication, etc.) and wasteful.  A "pool" keeps a set of reusable
 * connections open.  When your code needs to query, it borrows a
 * connection, uses it, and returns it automatically.
 *
 * mysql2/promise gives us the Promise-based API so we can use
 * async/await instead of callbacks.
 *
 * USAGE ELSEWHERE:
 *   const { pool } = require('../config/database');
 *   const [rows] = await pool.execute('SELECT * FROM users WHERE id = ?', [id]);
 */

const mysql = require('mysql2/promise');
const config = require('./environment');

const pool = mysql.createPool({
  host: config.mysql.host,
  port: config.mysql.port,
  user: config.mysql.user,
  password: config.mysql.password,
  database: config.mysql.database,

  // SSL — required by cloud MySQL providers (Aiven, PlanetScale, etc.)
  // rejectUnauthorized: false still encrypts traffic, it just doesn't
  // verify the server's CA certificate (fine for development).
  ...(config.mysql.ssl && { ssl: { rejectUnauthorized: false } }),

  // Pool-specific settings:
  waitForConnections: true,   // Queue requests when all connections are busy
  connectionLimit: 10,        // Max simultaneous connections (fine for dev)
  queueLimit: 0,              // Unlimited queue (0 = no limit)
});

/**
 * Quick connectivity test — tries to ping the database.
 * Returns true if MySQL is reachable, false otherwise.
 * Used by the health-check endpoint.
 */
const testConnection = async () => {
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release(); // Always return the connection to the pool
    return true;
  } catch {
    return false;
  }
};

module.exports = { pool, testConnection };
