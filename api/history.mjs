const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const GITHUB_OWNER = process.env.GITHUB_OWNER || '';
const PLATFORM_REPO = process.env.PLATFORM_REPO || 'backoffice-platform-generator';

const jsonResponse = (res, statusCode, payload) => {
  const body = JSON.stringify(payload);
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Length', Buffer.byteLength(body));
  res.end(body);
};

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return jsonResponse(res, 405, { error: 'Method not allowed' });
  }

  if (!GITHUB_TOKEN || !GITHUB_OWNER || !PLATFORM_REPO) {
    return jsonResponse(res, 200, []);
  }

  try {
    const url = `https://api.github.com/repos/${GITHUB_OWNER}/${PLATFORM_REPO}/contents/history.json`;
    const ghRes = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (ghRes.status === 404) {
      return jsonResponse(res, 200, []);
    }

    if (!ghRes.ok) {
      const text = await ghRes.text();
      throw new Error(`GitHub API error (${ghRes.status}): ${text}`);
    }

    const data = await ghRes.json();
    const content = Buffer.from(data.content, 'base64').toString('utf-8');
    const entries = JSON.parse(content);

    return jsonResponse(res, 200, Array.isArray(entries) ? entries : []);
  } catch (err) {
    return jsonResponse(res, 500, { error: err instanceof Error ? err.message : 'Unknown error' });
  }
}
