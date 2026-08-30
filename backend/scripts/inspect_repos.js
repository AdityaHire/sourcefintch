const { pool } = require('../src/config/database');

async function listRepos() {
  const [rows] = await pool.query(`
    SELECT r.id, r.name, r.owner, r.status, r.file_count, r.created_at,
           (SELECT COUNT(*) FROM files f WHERE f.repository_id = r.id) as files_in_db,
           (SELECT COUNT(*) FROM code_chunks c JOIN files f ON c.file_id = f.id WHERE f.repository_id = r.id) as chunks_in_db
    FROM repositories r
    ORDER BY r.id DESC
  `);
  console.log('Repositories summary in DB:');
  console.table(rows);
  await pool.end();
}

listRepos().catch(console.error);
