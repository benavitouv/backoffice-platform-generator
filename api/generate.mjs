// v2
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const config = {
  api: { bodyParser: false },
};

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Env vars ──
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const GITHUB_OWNER = process.env.GITHUB_OWNER || '';
const VERCEL_TOKEN = process.env.VERCEL_TOKEN || '';
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID || '';

// Per-template env vars to inject into new Vercel projects
const TEMPLATE_VARS = {
  form17: {
    WEBHOOK_URL:     process.env.FORM17_WEBHOOK_URL     || '',
    WEBHOOK_SECRET:  process.env.FORM17_WEBHOOK_SECRET  || '',
    STORAGE_URL:     process.env.FORM17_STORAGE_URL     || '',
    STORAGE_API_KEY: process.env.FORM17_STORAGE_API_KEY || '',
    TASK_TYPE:       process.env.FORM17_TASK_TYPE       || 'process_application',
    TRIGGER_ID:      process.env.FORM17_TRIGGER_ID      || '',
  },
  insurance: {
    WEBHOOK_URL:     process.env.INSURANCE_WEBHOOK_URL     || '',
    WEBHOOK_SECRET:  process.env.INSURANCE_WEBHOOK_SECRET  || '',
    STORAGE_URL:     process.env.INSURANCE_STORAGE_URL     || '',
    STORAGE_API_KEY: process.env.INSURANCE_STORAGE_API_KEY || '',
    TASK_TYPE:       process.env.INSURANCE_TASK_TYPE       || 'process_application',
    TRIGGER_ID:      process.env.INSURANCE_TRIGGER_ID      || '',
  },
  loan: {
    WEBHOOK_URL:     process.env.LOAN_WEBHOOK_URL     || '',
    WEBHOOK_SECRET:  process.env.LOAN_WEBHOOK_SECRET  || '',
    STORAGE_URL:     process.env.LOAN_STORAGE_URL     || '',
    STORAGE_API_KEY: process.env.LOAN_STORAGE_API_KEY || '',
    TASK_TYPE:       process.env.LOAN_TASK_TYPE       || 'process_application',
    TRIGGER_ID:      process.env.LOAN_TRIGGER_ID      || '',
  },
};

// ── Helpers ──
const readFormData = async (req) => {
  const url = new URL(req.url || '/', 'http://localhost');
  const request = new Request(url, {
    method: req.method,
    headers: req.headers,
    body: req,
    duplex: 'half',
  });
  return request.formData();
};

const mimeToExt = (mime) => {
  const map = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/svg+xml': '.svg',
    'image/webp': '.webp',
    'image/gif': '.gif',
  };
  return map[mime] || '.png';
};

const slugifyRepoName = (customerName, templateId) => {
  const slug = customerName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 28);
  const suffix = templateId === 'form17' ? 'health'
    : templateId === 'insurance' ? 'insurance'
    : 'loan';
  return `${slug}-${suffix}-demo`.replace(/^-|-$/g, '');
};

// ── Claude API call ──
const callClaude = async ({ customerName, language, templateId, logoBase64, logoMime, logoExt, indexHtml, stylesCss, appJs }) => {
  const isRTL = ['Hebrew', 'Arabic', 'Urdu', 'Persian', 'Farsi'].includes(language);

  const rtlChatBlock = `
/* Force RTL layout for the Wonderful chat widget */
.wonderful-chat-window,
.wonderful-chat-button {
  direction: rtl !important;
}
.wonderful-chat-button {
  flex-direction: row-reverse !important;
}
.wonderful-chat-header,
.wonderful-chat-agent-info,
.wonderful-chat-footer {
  flex-direction: row-reverse !important;
}
.wonderful-chat-title {
  align-items: flex-end !important;
  text-align: right !important;
}
.wonderful-chat-messages,
.wonderful-message,
.wonderful-chat-footer input {
  text-align: right !important;
  unicode-bidi: plaintext;
  direction: rtl !important;
}`;

  const templateTypeDesc = templateId === 'form17'
    ? 'Healthcare Form 17 (health fund referral with hospital selection)'
    : templateId === 'insurance'
    ? 'Insurance claim submission portal'
    : 'Bank loan application portal';

  const prompt = `You are customizing a web template for a customer. Analyze the logo image and customize the template files.

CUSTOMER DETAILS:
- Name: ${customerName}
- Language: ${language}
- Template type: ${templateTypeDesc}
- Logo filename will be: logo${logoExt}

INSTRUCTIONS:

1. BRAND COLOR EXTRACTION
   Analyze the logo image and identify the single most prominent, saturated brand color.
   Ignore pure white, pure black, and near-grays UNLESS the brand is clearly monochrome.
   If monochrome, use #2a2a2a.
   Extract:
   - accent: the primary hex color (e.g. "#1a56db")
   - accentDark: 20% darker variant
   - accentWarm: a lighter/muted variant for hover states
   - accentRgb: R G B components separated by spaces (e.g. "26 86 219")

2. TEMPLATE CUSTOMIZATION
   Modify all three files according to these rules:

   index.html:
   - Set <html lang="${isRTL ? (language === 'Arabic' ? 'ar' : language === 'Hebrew' ? 'he' : 'fa') : 'en'}" dir="${isRTL ? 'rtl' : 'ltr'}">
   - Set <title> to "${customerName} – [appropriate title for template type in ${language}]"
   - Translate ALL visible user-facing text to ${language}:
     * Page title, eyebrow text, h1, subhead/description
     * All form field labels and placeholder text
     * File drop zone text ("Drag file here", "or click to browse")
     * "No file selected" text
     * Submit button text
     * Hint text (allowed file types)
     * Success modal title and body text
     * Success close button text
     * Footer footnote text
     * Chat widget: agentName, buttonText, placeholderText
   - Replace the logo img src with "logo${logoExt}" and update alt text to "${customerName} Logo"
   - Set isRTL: ${isRTL} in the chat widget config
   - Update chat widget primaryColor, accentColor, headerBgColor, userBubbleColor, statusColor with the extracted brand colors
   - Update chat widget logoUrl to "logo${logoExt}"
   ${isRTL ? '- The text direction is RTL — ensure all content flows correctly' : ''}

   styles.css:
   - Replace --accent value with extracted brand color hex
   - Replace --accent-dark value with darkened variant hex
   - Replace --accent-warm value with warm/muted variant hex
   - Replace --accent-rgb value with RGB components (no commas, just spaces)
   - Update the submit button gradient: background: linear-gradient(120deg, {accent}, {accentDark})
   - Update --shadow to use the new accent-rgb value
   ${isRTL ? `- Add this RTL chat widget CSS block at the end of the file:\n${rtlChatBlock}` : '- Do NOT add any RTL chat widget CSS (LTR language)'}

   app.js:
   - Translate the error/status message strings to ${language}:
     * "No file selected" → translated version
     * "Please attach a [document type] before submitting." → translated
     * "Uploading [document] and submitting [request type]..." → translated
     * "An error occurred while submitting the request." → translated
     * Success status message → translated
     * "An unexpected error occurred." → translated
   - Keep all function names, variable names, DOM selectors, and logic UNCHANGED
   - Only change the string literals that are user-visible text

IMPORTANT RULES:
- Return ONLY valid JSON, no markdown, no code fences, no explanation
- Preserve ALL HTML structure, CSS class names, JS logic exactly as-is
- Do not remove or add HTML elements
- Do not change any API endpoints, form field names, or data attributes
- Keep all agentId values exactly as they are

Return this exact JSON structure:
{
  "brand": {
    "accent": "#hexcode",
    "accentDark": "#hexcode",
    "accentWarm": "#hexcode",
    "accentRgb": "R G B"
  },
  "files": {
    "index.html": "<complete modified file content>",
    "styles.css": "<complete modified file content>",
    "app.js": "<complete modified file content>"
  }
}

TEMPLATE FILES TO CUSTOMIZE:

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
      system: 'You are a brand design and localization assistant. You customize web templates for customers based on their logo and requirements. You ALWAYS return valid JSON only — no markdown, no code blocks, no explanations.',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: logoMime,
                data: logoBase64,
              },
            },
            {
              type: 'text',
              text: prompt,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Claude API error (${response.status}): ${text}`);
  }

  const result = await response.json();
  const rawText = result.content?.[0]?.text || '';

  // Extract JSON — Claude should return pure JSON but sometimes wraps in ```json
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Claude returned invalid response (no JSON found)');
  }

  let parsed;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch (e) {
    throw new Error(`Failed to parse Claude response as JSON: ${e.message}`);
  }

  if (!parsed.files || !parsed.brand) {
    throw new Error('Claude response missing expected fields (files or brand)');
  }

  return parsed;
};

// ── GitHub API ──
const githubHeaders = () => ({
  'Authorization': `Bearer ${GITHUB_TOKEN}`,
  'Content-Type': 'application/json',
  'Accept': 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
});

const createGitHubRepo = async (repoName, customerName, attempt = 0) => {
  const name = attempt === 0 ? repoName : `${repoName}-${attempt + 1}`;
  const res = await fetch('https://api.github.com/user/repos', {
    method: 'POST',
    headers: githubHeaders(),
    body: JSON.stringify({
      name,
      description: `Demo site for ${customerName}`,
      private: false,
      auto_init: true,
    }),
  });

  if (res.status === 422 && attempt < 5) {
    // Name already taken, try with suffix
    return createGitHubRepo(repoName, customerName, attempt + 1);
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub repo creation failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return { repoFullName: data.full_name, repoName: data.name };
};

const pushFilesToGitHub = async ({ repoFullName, textFiles, binaryFiles }) => {
  // Step 1: Get default branch SHA
  const refRes = await fetch(`https://api.github.com/repos/${repoFullName}/git/ref/heads/main`, {
    headers: githubHeaders(),
  });

  if (!refRes.ok) {
    // Try 'master' branch
    const masterRefRes = await fetch(`https://api.github.com/repos/${repoFullName}/git/ref/heads/master`, {
      headers: githubHeaders(),
    });
    if (!masterRefRes.ok) {
      const text = await masterRefRes.text();
      throw new Error(`Failed to get branch ref (${masterRefRes.status}): ${text}`);
    }
    const masterData = await masterRefRes.json();
    return pushFilesToGitHubOnBranch({ repoFullName, textFiles, binaryFiles, baseSha: masterData.object.sha, branch: 'master' });
  }

  const refData = await refRes.json();
  return pushFilesToGitHubOnBranch({ repoFullName, textFiles, binaryFiles, baseSha: refData.object.sha, branch: 'main' });
};

const pushFilesToGitHubOnBranch = async ({ repoFullName, textFiles, binaryFiles, baseSha, branch }) => {
  // Build tree blobs
  const treeItems = [];

  for (const [path, content] of Object.entries(textFiles)) {
    treeItems.push({
      path,
      mode: '100644',
      type: 'blob',
      content,
    });
  }

  for (const [path, base64Content] of Object.entries(binaryFiles)) {
    // Create blob for binary file
    const blobRes = await fetch(`https://api.github.com/repos/${repoFullName}/git/blobs`, {
      method: 'POST',
      headers: githubHeaders(),
      body: JSON.stringify({
        content: base64Content,
        encoding: 'base64',
      }),
    });

    if (!blobRes.ok) {
      const text = await blobRes.text();
      throw new Error(`Failed to create GitHub blob for ${path} (${blobRes.status}): ${text}`);
    }

    const blobData = await blobRes.json();
    treeItems.push({
      path,
      mode: '100644',
      type: 'blob',
      sha: blobData.sha,
    });
  }

  // Step 2: Create tree
  const treeRes = await fetch(`https://api.github.com/repos/${repoFullName}/git/trees`, {
    method: 'POST',
    headers: githubHeaders(),
    body: JSON.stringify({
      base_tree: baseSha,
      tree: treeItems,
    }),
  });

  if (!treeRes.ok) {
    const text = await treeRes.text();
    throw new Error(`Failed to create GitHub tree (${treeRes.status}): ${text}`);
  }

  const treeData = await treeRes.json();

  // Step 3: Create commit
  const commitRes = await fetch(`https://api.github.com/repos/${repoFullName}/git/commits`, {
    method: 'POST',
    headers: githubHeaders(),
    body: JSON.stringify({
      message: `Initial customized demo site`,
      tree: treeData.sha,
      parents: [baseSha],
    }),
  });

  if (!commitRes.ok) {
    const text = await commitRes.text();
    throw new Error(`Failed to create GitHub commit (${commitRes.status}): ${text}`);
  }

  const commitData = await commitRes.json();

  // Step 4: Update branch ref
  const updateRefRes = await fetch(`https://api.github.com/repos/${repoFullName}/git/refs/heads/${branch}`, {
    method: 'PATCH',
    headers: githubHeaders(),
    body: JSON.stringify({
      sha: commitData.sha,
      force: false,
    }),
  });

  if (!updateRefRes.ok) {
    const text = await updateRefRes.text();
    throw new Error(`Failed to update GitHub branch ref (${updateRefRes.status}): ${text}`);
  }

  return { commitSha: commitData.sha };
};

// ── Vercel API ──
const vercelApiUrl = (path) => {
  const base = `https://api.vercel.com${path}`;
  return VERCEL_TEAM_ID ? `${base}?teamId=${VERCEL_TEAM_ID}` : base;
};

const vercelHeaders = () => ({
  'Authorization': `Bearer ${VERCEL_TOKEN}`,
  'Content-Type': 'application/json',
});

const createVercelProject = async (projectName, repoFullName) => {
  const res = await fetch(vercelApiUrl('/v10/projects'), {
    method: 'POST',
    headers: vercelHeaders(),
    body: JSON.stringify({
      name: projectName,
      gitRepository: {
        type: 'github',
        repo: repoFullName,
      },
      framework: null,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    // If name taken, append timestamp
    if (res.status === 409) {
      const timestampName = `${projectName}-${Date.now().toString(36)}`;
      return createVercelProjectWithName(timestampName, repoFullName);
    }
    throw new Error(`Failed to create Vercel project (${res.status}): ${text}`);
  }

  const data = await res.json();
  return { projectId: data.id, projectName: data.name };
};

const createVercelProjectWithName = async (projectName, repoFullName) => {
  const res = await fetch(vercelApiUrl('/v10/projects'), {
    method: 'POST',
    headers: vercelHeaders(),
    body: JSON.stringify({
      name: projectName,
      gitRepository: {
        type: 'github',
        repo: repoFullName,
      },
      framework: null,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to create Vercel project (${res.status}): ${text}`);
  }

  const data = await res.json();
  return { projectId: data.id, projectName: data.name };
};

const addVercelEnvVars = async (projectId, templateVars) => {
  const envVars = [
    { key: 'WEBHOOK_URL',     value: templateVars.WEBHOOK_URL },
    { key: 'WEBHOOK_SECRET',  value: templateVars.WEBHOOK_SECRET },
    { key: 'STORAGE_URL',     value: templateVars.STORAGE_URL },
    { key: 'STORAGE_API_KEY', value: templateVars.STORAGE_API_KEY },
    { key: 'TASK_TYPE',       value: templateVars.TASK_TYPE },
    { key: 'TRIGGER_ID',      value: templateVars.TRIGGER_ID },
  ].filter(({ value }) => value); // only add if value is set

  for (const { key, value } of envVars) {
    const res = await fetch(vercelApiUrl(`/v10/projects/${projectId}/env`), {
      method: 'POST',
      headers: vercelHeaders(),
      body: JSON.stringify({
        key,
        value,
        type: 'encrypted',
        target: ['production', 'preview', 'development'],
      }),
    });
    // Non-fatal if env var push fails
    if (!res.ok) {
      console.warn(`Warning: failed to add env var ${key} to Vercel project`);
    }
  }
};

const triggerVercelDeployment = async (projectName, repoFullName) => {
  const [org, repo] = repoFullName.split('/');
  const res = await fetch(vercelApiUrl('/v13/deployments'), {
    method: 'POST',
    headers: vercelHeaders(),
    body: JSON.stringify({
      name: projectName,
      gitSource: {
        type: 'github',
        org,
        repo,
        ref: 'main',
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.warn(`Warning: failed to trigger deployment (${res.status}): ${text}`);
    return null;
  }

  const data = await res.json();
  return data.id || null;
};

const waitForDeployment = async (projectId, projectName, sendLog, deploymentId = null) => {
  const maxAttempts = 40; // 40 × 3s = 120s
  const delay = 3000;
  let lastState = null;

  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, delay));

    // Poll specific deployment if we triggered one, otherwise poll by project
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
      if (state === 'BUILDING') {
        sendLog(`Building... (${elapsed})`);
      } else if (state === 'QUEUED' || state === 'INITIALIZING') {
        sendLog(`Build ${state.toLowerCase()}... (${elapsed})`);
      }
    }

    if (state === 'READY') {
      return `https://${projectName}.vercel.app`;
    }

    if (state === 'ERROR' || state === 'CANCELED') {
      throw new Error(`Vercel deployment failed with state: ${state}`);
    }
  }

  // Timeout — return production URL
  return `https://${projectName}.vercel.app`;
};

// ── SSE helpers ──
const sendSSE = (res, data) => {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
};

// ── Main handler ──
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Allow', 'POST');
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.statusCode = 200;

  const startedAt = Date.now();
  const sendLog = (message, type = 'info') => {
    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
    sendSSE(res, { log: true, message, elapsed, type });
  };

  try {
    // ── Parse form data ──
    const formData = await readFormData(req);
    const customerName = String(formData.get('customerName') || '').trim();
    const templateId = String(formData.get('templateId') || '').trim();
    const language = String(formData.get('language') || 'English').trim();
    const logoFileEntry = formData.get('logo');

    if (!customerName || !templateId || !logoFileEntry || typeof logoFileEntry === 'string') {
      sendSSE(res, { error: true, message: 'Missing required fields: customerName, templateId, logo' });
      res.end();
      return;
    }

    const validTemplates = ['form17', 'insurance', 'loan'];
    if (!validTemplates.includes(templateId)) {
      sendSSE(res, { error: true, message: `Invalid templateId. Must be one of: ${validTemplates.join(', ')}` });
      res.end();
      return;
    }

    // ── Read logo ──
    const logoBuffer = Buffer.from(await logoFileEntry.arrayBuffer());
    const logoBase64 = logoBuffer.toString('base64');
    const logoMime = logoFileEntry.type || 'image/png';
    const logoExt = mimeToExt(logoMime);

    sendLog(`Starting generation for "${customerName}" — ${templateId} template, ${language}`);

    // ── Read English base template files ──
    const templateDir = join(__dirname, '..', 'templates', templateId);
    const [indexHtml, stylesCss, appJs, serverMjs, submitMjs, healthMjs, pkgJson, vercelJson] = await Promise.all([
      readFile(join(templateDir, 'index.html'), 'utf-8'),
      readFile(join(templateDir, 'styles.css'), 'utf-8'),
      readFile(join(templateDir, 'app.js'), 'utf-8'),
      readFile(join(templateDir, 'server.mjs'), 'utf-8'),
      readFile(join(templateDir, 'api', 'submit.mjs'), 'utf-8'),
      readFile(join(templateDir, 'api', 'health.mjs'), 'utf-8'),
      readFile(join(templateDir, 'package.json'), 'utf-8'),
      readFile(join(templateDir, 'vercel.json'), 'utf-8'),
    ]);

    // Optional: upload.mjs (present in templates with file upload)
    let uploadMjs = null;
    try {
      uploadMjs = await readFile(join(templateDir, 'api', 'upload.mjs'), 'utf-8');
    } catch { /* template doesn't have a direct-upload endpoint */ }

    // ── Step 1: Claude customization ──
    sendSSE(res, { step: 1, status: 'loading' });
    sendLog(`Sending logo (${(logoBuffer.length / 1024).toFixed(0)} KB) + 3 template files to Claude...`);

    // Send heartbeat messages every 12s while Claude is working
    const heartbeatMsgs = [
      'Analyzing logo image and brand colors...',
      'Extracting dominant color palette...',
      'Generating translated interface text...',
      'Customizing CSS variables and theme...',
      'Almost ready...',
    ];
    let heartbeatIdx = 0;
    const heartbeat = setInterval(() => {
      if (heartbeatIdx < heartbeatMsgs.length) sendLog(heartbeatMsgs[heartbeatIdx++]);
    }, 12000);

    const claudeStart = Date.now();
    let claudeResult;
    try {
      claudeResult = await callClaude({
        customerName,
        language,
        templateId,
        logoBase64,
        logoMime,
        logoExt,
        indexHtml,
        stylesCss,
        appJs,
      });
    } finally {
      clearInterval(heartbeat);
    }

    const claudeSec = ((Date.now() - claudeStart) / 1000).toFixed(1);
    sendLog(`Claude responded in ${claudeSec}s — brand color: ${claudeResult.brand.accent}`, 'done');
    sendSSE(res, { step: 1, status: 'done' });

    // ── Assemble all files ──
    const logoFilename = `public/logo${logoExt}`;
    const textFiles = {
      'public/index.html': claudeResult.files['index.html'],
      'public/styles.css': claudeResult.files['styles.css'],
      'public/app.js': claudeResult.files['app.js'],
      'server.mjs': serverMjs,
      'package.json': pkgJson,
      'vercel.json': vercelJson,
      'api/submit.mjs': submitMjs,
      'api/health.mjs': healthMjs,
      ...(uploadMjs ? { 'api/upload.mjs': uploadMjs } : {}),
    };

    const binaryFiles = {
      [logoFilename]: logoBase64,
    };

    // ── Step 2: Create GitHub repo ──
    sendSSE(res, { step: 2, status: 'loading' });

    const repoName = slugifyRepoName(customerName, templateId);
    sendLog(`Creating GitHub repo "${repoName}"...`);
    const { repoFullName } = await createGitHubRepo(repoName, customerName);
    sendLog(`Repo created: github.com/${repoFullName}`, 'done');

    sendSSE(res, { step: 2, status: 'done' });

    // ── Step 3: Push files to GitHub ──
    sendSSE(res, { step: 3, status: 'loading' });

    const fileCount = Object.keys(textFiles).length + Object.keys(binaryFiles).length;
    sendLog(`Pushing ${fileCount} files to GitHub...`);
    const { commitSha } = await pushFilesToGitHub({ repoFullName, textFiles, binaryFiles });
    sendLog(`Committed ${fileCount} files (${commitSha.slice(0, 7)})`, 'done');

    sendSSE(res, { step: 3, status: 'done' });

    // ── Step 4: Create Vercel project ──
    sendSSE(res, { step: 4, status: 'loading' });

    sendLog(`Creating Vercel project "${repoName}"...`);
    const { projectId, projectName } = await createVercelProject(repoName, repoFullName);
    sendLog(`Vercel project created (${projectName})`, 'done');

    // Add env vars (non-blocking for the stream)
    const templateVarCount = Object.values(TEMPLATE_VARS[templateId]).filter(Boolean).length;
    sendLog(`Injecting ${templateVarCount} environment variables...`);
    addVercelEnvVars(projectId, TEMPLATE_VARS[templateId]).catch(err => {
      console.warn('Non-fatal: env vars push failed:', err.message);
    });

    // Trigger deployment explicitly — the GitHub push happened before the project
    // existed, so Vercel never received the webhook for it
    sendLog('Triggering Vercel deployment...');
    const deploymentId = await triggerVercelDeployment(projectName, repoFullName);
    if (deploymentId) {
      sendLog(`Deployment queued (${deploymentId.slice(0, 12)})`, 'done');
    }

    sendSSE(res, { step: 4, status: 'done' });

    // ── Step 5: Wait for deployment ──
    sendSSE(res, { step: 5, status: 'loading' });
    sendLog('Waiting for Vercel to start build...');

    const liveUrl = await waitForDeployment(projectId, projectName, sendLog, deploymentId);
    sendLog(`Deployment ready: ${liveUrl}`, 'done');

    sendSSE(res, { step: 5, status: 'done' });

    // ── Done ──
    sendSSE(res, { done: true, url: liveUrl });
    res.end();

  } catch (err) {
    console.error('Generation error:', err);
    sendSSE(res, { error: true, message: err instanceof Error ? err.message : 'An unexpected error occurred' });
    res.end();
  }
}
