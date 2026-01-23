import { connectMongo } from '../../server/db.js';
import User from '../../server/models/User.js';

const normalizeUsername = (username) => (username || '').trim().toLowerCase();
const validateUsername = (username) => {
  if (!username) return 'Username required';
  if (username.length < 3) return 'Username must be at least 3 characters';
  if (username.length > 20) return 'Username must be 20 characters or less';
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return 'Username can only contain letters, numbers, and underscores';
  }
  return null;
};

const sendJson = (res, status, payload) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
};

const getQueryUsername = (req) => {
  if (req.query?.username) return req.query.username;
  try {
    const requestUrl = new URL(req.url, `http://${req.headers.host}`);
    return requestUrl.searchParams.get('username');
  } catch (error) {
    return null;
  }
};

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  try {
    await connectMongo(process.env.MONGODB_URI);
  } catch (error) {
    sendJson(res, 500, { error: error?.message || 'MongoDB not connected' });
    return;
  }

  const rawUsername = getQueryUsername(req);
  const normalizedUsername = normalizeUsername(rawUsername);
  const validationError = validateUsername(normalizedUsername);
  if (validationError) {
    sendJson(res, 400, { available: false, error: validationError });
    return;
  }

  const existing = await User.findOne({ username: normalizedUsername }).lean();
  sendJson(res, 200, { available: !existing });
}
