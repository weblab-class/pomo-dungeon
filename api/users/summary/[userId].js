import { connectMongo } from '../../../server/db.js';
import User from '../../../server/models/User.js';

const normalizeUserId = (userId) => (userId || '').trim().toLowerCase();

const sendJson = (res, status, payload) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
};

const getRouteUserId = (req) => {
  if (req.query?.userId) return req.query.userId;
  try {
    const requestUrl = new URL(req.url, `http://${req.headers.host}`);
    const parts = requestUrl.pathname.split('/').filter(Boolean);
    // Find the param after 'summary'
    const summaryIndex = parts.indexOf('summary');
    if (summaryIndex >= 0 && parts[summaryIndex + 1]) {
      return parts[summaryIndex + 1];
    }
    return parts[parts.length - 1] || null;
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

  const userId = getRouteUserId(req);
  const normalizedId = normalizeUserId(decodeURIComponent(userId || ''));
  if (!normalizedId) {
    sendJson(res, 400, { error: 'userId required' });
    return;
  }

  const user = await User.findOne({ userId: normalizedId }).lean();
  if (!user) {
    sendJson(res, 404, { error: 'User not found' });
    return;
  }

  // Calculate total time worked in hours
  const totalHours = Math.floor((user.totalTimeWorkedMs || 0) / (1000 * 60 * 60));
  const totalMinutes = Math.floor(((user.totalTimeWorkedMs || 0) % (1000 * 60 * 60)) / (1000 * 60));

  sendJson(res, 200, {
    userId: user.userId,
    username: user.username,
    name: user.name,
    picture: user.picture,
    totalQuestsCompleted: user.totalQuestsCompleted || 0,
    totalTimeWorkedMs: user.totalTimeWorkedMs || 0,
    totalTimeWorkedFormatted: `${totalHours}h ${totalMinutes}m`,
    isOnline: user.isOnline || false,
    lastSeen: user.lastSeen
  });
}
