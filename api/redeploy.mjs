// v1
export const config = {
  api: { bodyParser: true },
};

// ── Env vars ──
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const GITHUB_TOKEN      = process.env.GITHUB_TOKEN      || '';
const VERCEL_TOKEN      = process.env.VERCEL_TOKEN      || '';
const VERCEL_TEAM_ID    = process.env.VERCEL_TEAM_ID    || '';

// ── Helpers ──
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const sendSSE = (res, data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

const githubHeaders = () => ({
  'Authorization': `Bearer ${GITHUB_TOKEN}`,
  'Content-Type': 'application/json',
  'Accept': 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
});

const vercelHeaders = () => ({
  'Authorization': `Bearer ${VERCEL_TOKEN}`,
  'Content-Type': 'application/json',
});

const vercelApiUrl = (path) => {
  const base = `https://api.vercel.com${path}`;
  return VERCEL_TEAM_ID ? `${base}?teamId=${VERCEL_TEAM_ID}` : base;
};

// ── Fetch a single file from a GitHub repo ──
const fetchRepoFile = async (repoFullName, path) => {
  const res = await fetch(`https://api.github.com/repos/${repoFullName}/contents/${path}`, {
    headers: githubHeaders(),
  });
  if (!res.ok) return null;
  const data = await res.json();
  // GitHub returns content with newlines for readability — strip them before decoding
  return Buffer.from(data.content.replace(/\n/g, ''), 'base64').toString('utf-8');
};

// ── Get default branch name ──
const getDefaultBranch = async (repoFullName) => {
  const res = await fetch(`https://api.github.com/repos/${repoFullName}`, {
    headers: githubHeaders(),
  });
  if (!res.ok) return 'main';
  const data = await res.json();
  return data.default_branch || 'main';
};

// ── Push modified files via tree API (single commit) ──
const pushFilesToGitHub = async (repoFullName, textFiles) => {
  const branch = await getDefaultBranch(repoFullName);

  const refRes = await fetch(`https://api.github.com/repos/${repoFullName}/git/ref/heads/${branch}`, {
    headers: githubHeaders(),
  });
  if (!refRes.ok) {
    const text = await refRes.text();
    throw new Error(`Failed to get branch ref (${refRes.status}): ${text}`);
  }
  const baseSha = (await refRes.json()).object.sha;

  // Build tree items
  const treeItems = Object.entries(textFiles).map(([path, content]) => ({
    path,
    mode: '100644',
    type: 'blob',
    content,
  }));

  const treeRes = await fetch(`https://api.github.com/repos/${repoFullName}/git/trees`, {
    method: 'POST',
    headers: githubHeaders(),
    body: JSON.stringify({ base_tree: baseSha, tree: treeItems }),
  });
  if (!treeRes.ok) {
    const text = await treeRes.text();
    throw new Error(`Failed to create GitHub tree (${treeRes.status}): ${text}`);
  }
  const treeSha = (await treeRes.json()).sha;

  const commitRes = await fetch(`https://api.github.com/repos/${repoFullName}/git/commits`, {
    method: 'POST',
    headers: githubHeaders(),
    body: JSON.stringify({
      message: 'Apply AI-assisted edits',
      tree: treeSha,
      parents: [baseSha],
    }),
  });
  if (!commitRes.ok) {
    const text = await commitRes.text();
    throw new Error(`Failed to create commit (${commitRes.status}): ${text}`);
  }
  const commitSha = (await commitRes.json()).sha;

  const updateRes = await fetch(`https://api.github.com/repos/${repoFullName}/git/refs/heads/${branch}`, {
    method: 'PATCH',
    headers: githubHeaders(),
    body: JSON.stringify({ sha: commitSha, force: false }),
  });
  if (!updateRes.ok) {
    const text = await updateRes.text();
    throw new Error(`Failed to update branch ref (${updateRes.status}): ${text}`);
  }

  return commitSha;
};

// ── Call Claude to edit files ──
const callClaudeEdit = async ({ indexHtml, stylesCss, appJs, editPrompt }) => {
  const prompt = `You are editing an existing website. Apply ONLY the changes described below to the provided files.

USER'S REQUESTED CHANGES:
${editPrompt}

RULES:
- Return ONLY valid JSON, no markdown, no code fences, no explanation
- Preserve ALL existing HTML structure, CSS class names, and JS logic
- Do not remove or add HTML elements unless explicitly requested
- Do not change any API endpoints, form field names, or data attributes
- Keep all agentId, webhook URL, and configuration values exactly as they are
- Apply ONLY the changes described above — leave everything else unchanged

Return this exact JSON structure:
{
  "index.html": "<complete modified file content>",
  "styles.css": "<complete modified file content>",
  "app.js": "<complete modified file content>"
}

CURRENT FILES:

=== FILE: index.html ===
${indexHtml}
=== END index.html ===

=== FILE: styles.css ===
${stylesCss}
=== END styles.css ===

=== FILE: app.js ===
${appJs}
=== END app.js ===`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 16000,
      system: 'You are a web developer assistant. You edit existing websites according to user instructions. You ALWAYS return valid JSON only — no markdown, no code blocks, no explanations.',
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Claude API error (${response.status}): ${text}`);
  }

  const result = await response.json();
  const rawText = result.content?.[0]?.text || '';
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Claude returned invalid response (no JSON found)');

  let parsed;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch (e) {
    throw new Error(`Failed to parse Claude response: ${e.message}`);
  }

  if (!parsed['index.html'] || !parsed['styles.css'] || !parsed['app.js']) {
    throw new Error('Claude response missing one or more expected files');
  }

  return parsed;
};

// ── Get Vercel project by name ──
const getVercelProject = async (projectName) => {
  const res = await fetch(vercelApiUrl(`/v9/projects/${projectName}`), { headers: vercelHeaders() });
  if (!res.ok) return null;
  return res.json();
};

// ── Trigger a Vercel deployment ──
const triggerVercelDeployment = async (projectName, repoFullName, branch) => {
  const [org, repo] = repoFullName.split('/');
  const res = await fetch(vercelApiUrl('/v13/deployments'), {
    method: 'POST',
    headers: vercelHeaders(),
    body: JSON.stringify({
      name: projectName,
      gitSource: { type: 'github', org, repo, ref: branch },
    }),
  });
  if (!res.ok) {
    console.warn(`Warning: could not trigger Vercel deployment (${res.status})`);
    return null;
  }
  const data = await res.json();
  return data.id || null;
};

// ── Poll for deployment completion ──
const waitForDeployment = async (projectId, projectName, sendLog, deploymentId) => {
  const maxAttempts = 60; // 60 × 3 s = 3 min
  let lastState = null;

  for (let i = 0; i < maxAttempts; i++) {
    await sleep(3000);

    const pollUrl = deploymentId
      ? vercelApiUrl(`/v13/deployments/${deploymentId}`)
      : vercelApiUrl(`/v6/deployments?projectId=${projectId}&limit=1`);

    const res = await fetch(pollUrl, { headers: vercelHeaders() });
    if (!res.ok) continue;

    const data = await res.json();
    const deployment = deploymentId ? data : data.deployments?.[0];
    if (!deployment) {
      if (i === 0) sendLog('Waiting for Vercel build to start...');
      continue;
    }

    const elapsed = `${((i + 1) * 3)}s`;
    const state = deployment.status || deployment.state;

    if (state !== lastState) {
      lastState = state;
      if (state === 'BUILDING') sendLog(`Building... (${elapsed})`);
      else if (state === 'QUEUED' || state === 'INITIALIZING') sendLog(`Build ${state.toLowerCase()}... (${elapsed})`);
    }

    if (state === 'READY') return `https://${projectName}.vercel.app`;
    if (state === 'ERROR' || state === 'CANCELED') throw new Error(`Vercel deployment failed with state: ${state}`);
  }

  // Timeout — return the production URL anyway
  return `https://${projectName}.vercel.app`;
};

// ── Handler ──
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).end('Method Not Allowed');
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.statusCode = 200;

  const sendLog = (msg) => sendSSE(res, { log: true, message: msg, elapsed: '…' });

  try {
    const { repoFullName, editPrompt } = req.body || {};

    if (!repoFullName || !editPrompt) {
      sendSSE(res, { error: true, message: 'Missing repoFullName or editPrompt' });
      res.end();
      return;
    }

    const repoName = repoFullName.split('/')[1];

    // ── Step 1: Fetch files from GitHub ──
    sendSSE(res, { step: 1, status: 'loading' });
    sendLog(`Fetching files from github.com/${repoFullName}...`);

    // Generated repos always place frontend files under public/
    let [indexHtml, stylesCss, appJs] = await Promise.all([
      fetchRepoFile(repoFullName, 'public/index.html'),
      fetchRepoFile(repoFullName, 'public/styles.css'),
      fetchRepoFile(repoFullName, 'public/app.js'),
    ]);
    let filePrefix = 'public/';

    // Fallback: some older or custom repos might have files at root
    if (!indexHtml) {
      [indexHtml, stylesCss, appJs] = await Promise.all([
        fetchRepoFile(repoFullName, 'index.html'),
        fetchRepoFile(repoFullName, 'styles.css'),
        fetchRepoFile(repoFullName, 'app.js'),
      ]);
      filePrefix = '';
    }

    if (!indexHtml || !stylesCss || !appJs) {
      throw new Error('Could not fetch website files from the repository. Make sure the repo is accessible.');
    }

    sendLog('Files fetched successfully');
    sendSSE(res, { step: 1, status: 'done' });

    // ── Step 2: Apply edits with Claude ──
    sendSSE(res, { step: 2, status: 'loading' });
    sendLog('Sending files to Claude for editing...');

    const heartbeat = setInterval(() => sendLog('Claude is applying changes...'), 12000);
    let modifiedFiles;
    try {
      modifiedFiles = await callClaudeEdit({ indexHtml, stylesCss, appJs, editPrompt });
    } finally {
      clearInterval(heartbeat);
    }

    sendLog('Changes applied successfully');
    sendSSE(res, { step: 2, status: 'done' });

    // ── Step 3: Push updated files to GitHub ──
    sendSSE(res, { step: 3, status: 'loading' });
    sendLog('Pushing updated files to GitHub...');

    const commitSha = await pushFilesToGitHub(repoFullName, {
      [`${filePrefix}index.html`]: modifiedFiles['index.html'],
      [`${filePrefix}styles.css`]: modifiedFiles['styles.css'],
      [`${filePrefix}app.js`]:     modifiedFiles['app.js'],
    });
    sendLog(`Committed changes (${commitSha.slice(0, 7)})`);
    sendSSE(res, { step: 3, status: 'done' });

    // ── Step 4: Deploy to Vercel ──
    sendSSE(res, { step: 4, status: 'loading' });
    sendLog('Triggering Vercel deployment...');

    const branch = await getDefaultBranch(repoFullName);
    const project = await getVercelProject(repoName);

    let liveUrl;
    if (project) {
      const deploymentId = await triggerVercelDeployment(repoName, repoFullName, branch);
      if (deploymentId) sendLog(`Deployment queued (${deploymentId.slice(0, 12)})`);
      liveUrl = await waitForDeployment(project.id, repoName, sendLog, deploymentId);
    } else {
      sendLog('Vercel project not found — changes are live on next auto-deploy');
      liveUrl = `https://${repoName}.vercel.app`;
    }

    sendLog(`Deployed: ${liveUrl}`);
    sendSSE(res, { step: 4, status: 'done' });

    sendSSE(res, { done: true, url: liveUrl });

  } catch (err) {
    console.error('Redeploy error:', err);
    sendSSE(res, { error: true, message: err instanceof Error ? err.message : 'An unexpected error occurred' });
  }

  res.end();
}
