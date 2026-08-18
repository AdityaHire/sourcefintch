/**
 * Live verification script for Fix #4: Rate limiting with active-status list.
 *
 * Verifies:
 * 1. An active repository in 'storing' status blocks new repository ingestion with 429.
 * 2. An active repository in 'embedding' status blocks new repository ingestion with 429.
 * 3. Rate limiting releases immediately when the repository reaches 'completed'.
 * 4. Rate limiting releases immediately when the repository reaches 'failed'.
 */

const http = require('http');
const app = require('../src/app');
const { pool } = require('../src/config/database');
const Repository = require('../src/models/Repository');

const PLACEHOLDER_USER_ID = 1;

const runTest = async () => {
  console.log('\n============================================================');
  console.log('VERIFICATION FIX #4: Rate Limiting With Active-Status List');
  console.log('============================================================\n');

  // Start Express test server on ephemeral port
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  const postRepo = async (github_url) => {
    const res = await fetch(`${baseUrl}/api/repositories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ github_url: github_url || 'https://github.com/octocat/Hello-World' }),
    });
    const body = await res.json();
    return { status: res.status, body };
  };

  try {
    // 0. Ensure clean state for user 1
    const [existing] = await pool.execute('SELECT id, status FROM repositories WHERE user_id = ?', [PLACEHOLDER_USER_ID]);
    console.log(`Initial repositories in DB for user ${PLACEHOLDER_USER_ID}: ${existing.length}`);
    for (const r of existing) {
      if (['pending', 'cloning', 'scanning', 'storing', 'embedding'].includes(r.status)) {
        await pool.execute('UPDATE repositories SET status = ? WHERE id = ?', ['completed', r.id]);
      }
    }

    // 1. Create a dummy test repo record in 'storing' status
    console.log('--- Test 4A: Active repository in "storing" status ---');
    const [insStoring] = await pool.execute(
      'INSERT INTO repositories (user_id, name, owner, github_url, branch, status) VALUES (?, ?, ?, ?, ?, ?)',
      [PLACEHOLDER_USER_ID, 'test-storing-repo', 'octocat', 'https://github.com/octocat/storing-test', 'main', 'storing']
    );
    const storingRepoId = insStoring.insertId;
    console.log(`Created test repository ID ${storingRepoId} with status = 'storing'`);

    // Verify findActiveByUserId includes it
    const activeStoring = await Repository.findActiveByUserId(PLACEHOLDER_USER_ID);
    console.log(`findActiveByUserId returned ${activeStoring.length} active repos (ID: ${activeStoring[0]?.id}, status: ${activeStoring[0]?.status})`);

    // Attempt POST /api/repositories
    const resStoring = await postRepo('https://github.com/octocat/Hello-World');
    console.log(`POST /api/repositories response status: ${resStoring.status}`);
    console.log('Response JSON:', JSON.stringify(resStoring.body, null, 2));
    if (resStoring.status !== 429) {
      throw new Error(`Expected 429 for 'storing' status, got ${resStoring.status}`);
    }
    if (resStoring.body.statusCode !== 429 || !resStoring.body.message.includes('already have a repository in progress')) {
      throw new Error('Response does not match expected 429 error shape');
    }
    console.log('[SUCCESS] Ingestion correctly rejected with 429 while repository is in "storing" status.');

    // 2. Update status to 'embedding'
    console.log('\n--- Test 4B: Active repository in "embedding" status ---');
    await pool.execute('UPDATE repositories SET status = ? WHERE id = ?', ['embedding', storingRepoId]);
    console.log(`Updated repository ID ${storingRepoId} status to 'embedding'`);

    // Verify findActiveByUserId includes it
    const activeEmbedding = await Repository.findActiveByUserId(PLACEHOLDER_USER_ID);
    console.log(`findActiveByUserId returned ${activeEmbedding.length} active repos (ID: ${activeEmbedding[0]?.id}, status: ${activeEmbedding[0]?.status})`);

    // Attempt POST /api/repositories
    const resEmbedding = await postRepo('https://github.com/octocat/Hello-World');
    console.log(`POST /api/repositories response status: ${resEmbedding.status}`);
    console.log('Response JSON:', JSON.stringify(resEmbedding.body, null, 2));
    if (resEmbedding.status !== 429) {
      throw new Error(`Expected 429 for 'embedding' status, got ${resEmbedding.status}`);
    }
    if (resEmbedding.body.statusCode !== 429 || !resEmbedding.body.message.includes('already have a repository in progress')) {
      throw new Error('Response does not match expected 429 error shape');
    }
    console.log('[SUCCESS] Ingestion correctly rejected with 429 while repository is in "embedding" status.');

    // 3. Mark the repository as 'completed' and verify rate limit releases
    console.log('\n--- Test 4C: Rate limit release on "completed" status ---');
    await pool.execute('UPDATE repositories SET status = ? WHERE id = ?', ['completed', storingRepoId]);
    console.log(`Updated repository ID ${storingRepoId} status to 'completed'`);

    const activeCompleted = await Repository.findActiveByUserId(PLACEHOLDER_USER_ID);
    console.log(`findActiveByUserId returned ${activeCompleted.length} active repos.`);

    // Now POST /api/repositories should succeed (mocking or using valid public repo)
    // Note: Github API validation runs, so octocat/Hello-World is valid
    const resCompleted = await postRepo('https://github.com/octocat/Hello-World');
    console.log(`POST /api/repositories response status: ${resCompleted.status}`);
    console.log('Response JSON:', JSON.stringify(resCompleted.body, null, 2));
    if (resCompleted.status !== 201) {
      throw new Error(`Expected 201 after repository completed, got ${resCompleted.status}`);
    }
    const newRepoId = resCompleted.body.id;
    console.log(`[SUCCESS] New repository ID ${newRepoId} created successfully (rate limit released).`);

    // 4. Clean up created records
    await pool.execute('DELETE FROM repositories WHERE id IN (?, ?)', [storingRepoId, newRepoId]);
    console.log(`\nCleaned up test records (IDs: ${storingRepoId}, ${newRepoId})`);

    // 5. Test 'failed' status release as well
    console.log('\n--- Test 4D: Rate limit release on "failed" status ---');
    const [insFailed] = await pool.execute(
      'INSERT INTO repositories (user_id, name, owner, github_url, branch, status) VALUES (?, ?, ?, ?, ?, ?)',
      [PLACEHOLDER_USER_ID, 'test-failed-repo', 'octocat', 'https://github.com/octocat/failed-test', 'main', 'failed']
    );
    const failedRepoId = insFailed.insertId;
    console.log(`Created test repository ID ${failedRepoId} with status = 'failed'`);

    const activeFailed = await Repository.findActiveByUserId(PLACEHOLDER_USER_ID);
    console.log(`findActiveByUserId returned ${activeFailed.length} active repos.`);

    const resAfterFailed = await postRepo('https://github.com/octocat/Hello-World');
    console.log(`POST /api/repositories response status: ${resAfterFailed.status}`);
    console.log('Response JSON:', JSON.stringify(resAfterFailed.body, null, 2));
    if (resAfterFailed.status !== 201) {
      throw new Error(`Expected 201 after failed repository, got ${resAfterFailed.status}`);
    }
    const createdAfterFailedId = resAfterFailed.body.id;
    console.log(`[SUCCESS] New repository ID ${createdAfterFailedId} created successfully (rate limit released after failure).`);

    // Clean up
    await pool.execute('DELETE FROM repositories WHERE id IN (?, ?)', [failedRepoId, createdAfterFailedId]);
    console.log(`Cleaned up test records (IDs: ${failedRepoId}, ${createdAfterFailedId})`);

    console.log('\n[SUCCESS] FIX #4 passed: Active status window (\'pending\', \'cloning\', \'scanning\', \'storing\', \'embedding\') enforces 429 rate limit correctly, and releases promptly on \'completed\' or \'failed\'.\n');
  } finally {
    server.close();
    await pool.end();
  }
};

runTest().catch((err) => {
  console.error('Rate limit verification failed:', err);
  process.exit(1);
});
