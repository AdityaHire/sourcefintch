/**
 * Health controller — handles the logic for the health-check endpoint.
 *
 * Controllers contain the "what to do" for a route.  They receive
 * (req, res, next) from the router and return a response.  Keeping them
 * in their own files means the router stays a thin list of HTTP verb →
 * handler mappings.
 *
 * Phase 2 update: now also pings MySQL and reports connectivity.
 * The endpoint always returns 200 — even if the database is down — so you
 * can always reach the health check to see what's going on.  The `database`
 * field tells you whether MySQL is reachable or not.
 */

const { testConnection } = require('../config/database');

const getHealth = async (_req, res) => {
  const dbConnected = await testConnection();

  res.json({
    status: 'ok',
    service: 'sourcefinch-backend',
    timestamp: new Date().toISOString(),
    database: dbConnected ? 'connected' : 'disconnected',
  });
};

module.exports = { getHealth };
