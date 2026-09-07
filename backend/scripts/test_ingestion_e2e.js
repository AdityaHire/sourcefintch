/**
 * Direct end-to-end test of the ingestion pipeline.
 * Bypasses Clerk auth by calling the service functions directly.
 */

const { ingestRepository } = require('../src/services/ingestionService');
const Repository = require('../src/models/Repository');
const User = require('../src/models/User');
const { pool } = require('../src/config/database');

async function runTest() {
  console.log('\n=== Ingestion Pipeline E2E Test ===\n');

  // Use a tiny public repo to keep the test fast.
  const targetUrl = 'https://github.com/octocat/boysenberry-repo-1';
  const branch = 'master';

  // 1. Ensure a test user exists (Clerk-style id).
  const testUserId = 'user_test_e2e';
  let user = await User.findById(testUserId);
  if (!user) {
    user = await User.create({ id: testUserId, email: 'e2e@test.com', name: 'E2E Test' });
    console.log(`Created test user ${testUserId}`);
  } else {
    console.log(`Using existing test user ${testUserId}`);
  }

  // 2. Create a repository row directly (bypassing Clerk auth).
  // Use a random suffix so re-runs don't collide with the previous test row.
  const repoSuffix = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const [result] = await pool.execute(
    `INSERT INTO repositories (user_id, name, owner, github_url, branch, status)
     VALUES (?, ?, ?, ?, ?, 'pending')`,
    [testUserId, `boysenberry-repo-1-${repoSuffix}`, 'octocat', targetUrl, branch]
  );
  const repoId = result.insertId;
  console.log(`Created repository row id=${repoId} (${targetUrl})`);

  // 3. Run the full ingestion pipeline and poll for completion.
  const startTime = Date.now();

  ingestRepository(repoId, targetUrl, branch).catch((err) => {
    console.error(`[ingestion] Background task error:`, err);
  });

  // Poll the DB until we reach a terminal state.
  let status = 'pending';
  let fileCount = 0;
  let pollCount = 0;
  while (status !== 'completed' && status !== 'failed' && pollCount < 60) {
    await new Promise((r) => setTimeout(r, 1000));
    pollCount++;
    const repo = await Repository.findById(repoId);
    status = repo ? repo.status : 'missing';
    fileCount = repo ? repo.file_count : 0;
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[Poll #${pollCount} @ +${elapsed}s] status='${status}' files=${fileCount}`);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n=== Final: status='${status}', files=${fileCount}, elapsed=${elapsed}s ===`);

  if (status !== 'completed') {
    console.error('FAIL: repository did not reach completed status');
    process.exitCode = 1;
  } else {
    console.log('PASS: ingestion completed successfully');
  }

  await pool.end();
}

runTest().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});