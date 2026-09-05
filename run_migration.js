const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const sqlPath = path.join(__dirname, 'backend', 'src', 'migrations', '001_create_repository_reports.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  const connection = await mysql.createConnection({
    host: 'mysql-609d784-adityahire08-ab89.j.aivencloud.com',
    port: 24225,
    user: 'avnadmin',
    password: process.env.MYSQL_PASSWORD,
    database: 'sourcefinch',
    ssl: { rejectUnauthorized: false }
  });

  try {
    await connection.query(sql);
    console.log('Migration executed successfully');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

runMigration();
