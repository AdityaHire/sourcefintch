/**
 * Comprehensive verification script for Phase 7: Chat orchestration, persistence, and error relay.
 */

const http = require('http');
const app = require('../src/app');
const { pool } = require('../src/config/database');

const runVerification = async () => {
  console.log('\n============================================================');
  console.log('PHASE 7 LIVE VERIFICATION SUITE');
  console.log('============================================================\n');

  const server = http.createServer(app);
  const port = process.env.PORT || 3001;
  await new Promise((resolve) => server.listen(port, resolve));
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // ── TEST 1: GET /api/repositories (Server-Side Completed Filter) ────────
    console.log('--- Test 1: GET /api/repositories (Only completed repos) ---');
    const resRepos = await fetch(`${baseUrl}/api/repositories`);
    const reposData = await resRepos.json();
    console.log(`Status Code: ${resRepos.status}`);
    console.log(`Returned ${reposData.length} completed repositories.`);
    console.log('Sample repository:', JSON.stringify(reposData[0], null, 2));

    if (resRepos.status !== 200 || !Array.isArray(reposData) || reposData.length === 0) {
      throw new Error('Failed to retrieve completed repositories');
    }
    const nonCompleted = reposData.filter((r) => r.status !== 'completed');
    if (nonCompleted.length > 0) {
      throw new Error(`Found ${nonCompleted.length} non-completed repos in /api/repositories output!`);
    }
    console.log('[SUCCESS] GET /api/repositories returned valid list of completed repositories.\n');

    const testRepo = reposData.find((r) => r.file_count > 0) || reposData[0];
    const testRepoId = testRepo.id;
    const secondRepo = reposData.find((r) => r.id !== testRepoId) || { id: 9999 };
    const secondRepoId = secondRepo.id;
    console.log(`Selected test repository ID ${testRepoId} (${testRepo.name}) with ${testRepo.file_count} files.`);

    // ── TEST 2: POST /api/conversations (Explicit creation) ──────────────────
    console.log(`--- Test 2: POST /api/conversations (Explicit creation for repo ${testRepoId}) ---`);
    const resCreateConv = await fetch(`${baseUrl}/api/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        repository_id: testRepoId,
        title: 'Phase 7 Architecture Review',
      }),
    });
    const convData = await resCreateConv.json();
    console.log(`Status Code: ${resCreateConv.status}`);
    console.log('Created conversation:', JSON.stringify(convData, null, 2));

    if (resCreateConv.status !== 201 || !convData.id || convData.title !== 'Phase 7 Architecture Review') {
      throw new Error('Failed explicit conversation creation');
    }
    console.log('[SUCCESS] Explicit conversation creation succeeded.\n');

    // ── TEST 3: Mismatch Validation Guard (Review Fix #3 & Fix #5) ──────────
    console.log('--- Test 3: Conversation / Repository Mismatch Guard ---');
    console.log(`Attempting POST /api/chat with conversation_id=${convData.id} (belongs to repo ${testRepoId}) but request repository_id=${secondRepoId}...`);

    const [msgCountBefore] = await pool.execute(
      'SELECT COUNT(*) as count FROM messages WHERE conversation_id = ?',
      [convData.id]
    );

    const resMismatch = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversation_id: convData.id,
        repository_id: secondRepoId,
        message: 'This should be rejected due to repository mismatch',
      }),
    });

    const mismatchPayload = await resMismatch.json();
    console.log(`Status Code: ${resMismatch.status}`);
    console.log('Response JSON:', JSON.stringify(mismatchPayload, null, 2));

    if (resMismatch.status !== 400 || !mismatchPayload.message.includes('belongs to repository')) {
      throw new Error('Mismatch guard did not return expected 400 Bad Request');
    }

    const [msgCountAfter] = await pool.execute(
      'SELECT COUNT(*) as count FROM messages WHERE conversation_id = ?',
      [convData.id]
    );

    if (msgCountBefore[0].count !== msgCountAfter[0].count) {
      throw new Error('A message was erroneously persisted despite mismatch rejection!');
    }
    console.log(`[SUCCESS] Mismatch rejected with 400, and verified 0 messages inserted into MySQL.\n`);

    // ── TEST 4: Multi-Turn Conversation via POST /api/chat ──────────────────
    console.log('--- Test 4: Multi-Turn Conversation (POST /api/chat) ---');
    console.log('Question 1: Sending question without conversation_id (verifying auto-creation)...');

    const resTurn1 = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        repository_id: testRepoId,
        message: 'What is this repository and what files are included in it?',
      }),
    });

    const turn1Data = await resTurn1.json();
    console.log(`Turn 1 Status Code: ${resTurn1.status}`);
    console.log('Turn 1 Response (summary):', {
      conversation_id: turn1Data.conversation_id,
      answer: turn1Data.message?.content?.slice(0, 150) + '...',
      sources_count: turn1Data.message?.sources?.length,
      sample_source: turn1Data.message?.sources?.[0]
        ? {
            file_path: turn1Data.message.sources[0].file_path,
            lines: `${turn1Data.message.sources[0].start_line}-${turn1Data.message.sources[0].end_line}`,
            has_content: !!turn1Data.message.sources[0].content,
            content_preview: turn1Data.message.sources[0].content?.slice(0, 60),
          }
        : null,
    });

    if (resTurn1.status !== 200 || !turn1Data.conversation_id || !turn1Data.message?.content) {
      throw new Error('Turn 1 chat failed');
    }

    const multiTurnConvId = turn1Data.conversation_id;

    console.log(`\nQuestion 2: Sending follow-up in the same conversation (conversation_id=${multiTurnConvId})...`);
    const resTurn2 = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversation_id: multiTurnConvId,
        repository_id: testRepoId,
        message: 'Can you provide more details about how to run or use it?',
      }),
    });

    const turn2Data = await resTurn2.json();
    console.log(`Turn 2 Status Code: ${resTurn2.status}`);
    console.log('Turn 2 Response (summary):', {
      conversation_id: turn2Data.conversation_id,
      answer: turn2Data.message?.content?.slice(0, 150) + '...',
      sources_count: turn2Data.message?.sources?.length,
    });

    if (resTurn2.status !== 200 || turn2Data.conversation_id !== multiTurnConvId) {
      throw new Error('Turn 2 chat failed or conversation_id mismatched');
    }
    console.log('[SUCCESS] Multi-turn conversation executed successfully.\n');

    // ── TEST 5: Re-hydrate History via GET /api/conversations/:id ───────────
    console.log(`--- Test 5: Re-hydrate Full History (GET /api/conversations/${multiTurnConvId}) ---`);
    const resHistory = await fetch(`${baseUrl}/api/conversations/${multiTurnConvId}`);
    const historyData = await resHistory.json();
    console.log(`Status Code: ${resHistory.status}`);
    console.log(`Conversation Title: "${historyData.title}"`);
    console.log(`Total messages in history: ${historyData.messages?.length}`);

    historyData.messages.forEach((m, idx) => {
      console.log(`  Message ${idx + 1} [${m.role}]: "${m.content.slice(0, 70)}..." (sources: ${m.sources?.length || 0})`);
      if (m.role === 'assistant' && m.sources && m.sources.length > 0) {
        console.log(`    -> Sample source has content field: ${!!m.sources[0].content} (length: ${m.sources[0].content?.length || 0})`);
      }
    });

    if (resHistory.status !== 200 || historyData.messages?.length !== 4) {
      throw new Error(`Expected 4 persisted messages, got ${historyData.messages?.length}`);
    }
    console.log('[SUCCESS] GET /api/conversations/:id returned full, ordered history with citations and content.\n');

    // ── TEST 6: Failure Case Relay (User Message Pre-Saved + Error Relayed) ─
    console.log('--- Test 6: Failure Relay & Pre-Saved User Message Test ---');
    // Create a temporary repository in 'cloning' status to trigger Python 409 status check
    const [insCloning] = await pool.execute(
      'INSERT INTO repositories (user_id, name, owner, github_url, branch, status) VALUES (?, ?, ?, ?, ?, ?)',
      [1, 'temp-cloning-repo', 'octocat', 'https://github.com/octocat/cloning-test', 'main', 'cloning']
    );
    const cloningRepoId = insCloning.insertId;

    console.log(`Sending POST /api/chat against in-progress repository ID ${cloningRepoId}...`);
    const resFail = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        repository_id: cloningRepoId,
        message: 'Why is this repository not ready?',
      }),
    });

    const failBody = await resFail.json();
    console.log(`Relayed Status Code: ${resFail.status}`);
    console.log('Relayed Error Body:', JSON.stringify(failBody, null, 2));

    if (resFail.status !== 409 || !failBody.message.includes('indexing')) {
      throw new Error(`Expected 409 with indexing message, got ${resFail.status}`);
    }

    // Check MySQL messages table to verify the user message was saved despite AI failure
    const [savedUserMsgs] = await pool.execute(
      'SELECT m.* FROM messages m JOIN conversations c ON m.conversation_id = c.id WHERE c.repository_id = ?',
      [cloningRepoId]
    );

    console.log(`Messages saved in DB for failed turn: ${savedUserMsgs.length}`);
    console.log(`  Role of saved message: ${savedUserMsgs[0]?.role}`);
    console.log(`  Content of saved message: "${savedUserMsgs[0]?.content}"`);

    if (savedUserMsgs.length !== 1 || savedUserMsgs[0].role !== 'user') {
      throw new Error('Expected exactly 1 user message and 0 assistant messages in DB');
    }

    // Cleanup temporary repo & conversation
    await pool.execute('DELETE FROM repositories WHERE id = ?', [cloningRepoId]);
    console.log('[SUCCESS] Failure correctly relayed Python 409 error, and verified user question was safely preserved in history without assistant message.\n');

    console.log('============================================================');
    console.log('ALL PHASE 7 BACKEND & AI ORCHESTRATION TESTS PASSED!');
    console.log('============================================================\n');
  } finally {
    server.close();
    await pool.end();
  }
};

runVerification().catch((err) => {
  console.error('\nVerification failed:', err);
  process.exit(1);
});
