export const config = {
  api: { bodyParser: false },
};

const getEnv = (name, fallback) => {
  const value = process.env[name] ?? fallback;
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};

const STORAGE_URL = getEnv('STORAGE_URL', 'https://api.demo.wonderful.ai/api/v1/storage');
const STORAGE_API_KEY = getEnv('STORAGE_API_KEY', 'f2440f35-f26d-4145-8c15-295b40987ed6');

const jsonResponse = (res, statusCode, payload) => {
  const body = JSON.stringify(payload);
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Length', Buffer.byteLength(body));
  res.end(body);
};

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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return jsonResponse(res, 405, { ok: false, error: 'method_not_allowed', message: 'Only POST is allowed.' });
  }

  try {
    const formData = await readFormData(req);
    const file = formData.get('file');

    if (!file || typeof file === 'string') {
      return jsonResponse(res, 400, { ok: false, error: 'missing_file', message: 'No file provided.' });
    }

    const contentType = file.type || 'application/octet-stream';
    const filename = file.name || 'provident-fund-enrollment-upload';

    // Step 1: Get presigned upload URL from storage API
    const storageResponse = await fetch(STORAGE_URL, {
      method: 'POST',
      headers: {
        'X-API-Key': STORAGE_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ filename, contentType }),
    });

    if (!storageResponse.ok) {
      const text = await storageResponse.text();
      throw new Error(`Storage init failed (${storageResponse.status}): ${text}`);
    }

    const storageJson = await storageResponse.json();
    const attachmentId = storageJson?.data?.id;
    const uploadUrl = storageJson?.data?.url;

    if (!attachmentId || !uploadUrl) {
      throw new Error('Storage response missing attachment id or upload url');
    }

    // Step 2: Upload file to storage from server (avoids browser CORS issues)
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body: fileBuffer,
    });

    if (!uploadResponse.ok) {
      const text = await uploadResponse.text();
      throw new Error(`Upload failed (${uploadResponse.status}): ${text}`);
    }

    return jsonResponse(res, 200, { ok: true, attachmentId });
  } catch (error) {
    return jsonResponse(res, 500, {
      ok: false,
      error: 'server_error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
