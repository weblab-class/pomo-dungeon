import { connectMongo } from '../../server/db.js';
import User from '../../server/models/User.js';

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

  let user = await User.findOne({ userId: normalizedId }).lean();
  if (!user) {
    const created = await User.create({
      userId: normalizedId,
      email: normalizedId,
      createdAt: new Date(),
    });
    user = created.toObject();
  }

  sendJson(res, 200, {
    userId: user.userId,
    totalSecondsOnSite: user.totalSecondsOnSite,
    totalHoursOnSite: user.totalSecondsOnSite / 3600,
    totalQuestsCompleted: user.totalQuestsCompleted,
    totalTimeWorkedMs: user.totalTimeWorkedMs,
    quests: user.quests || [],
    sessions: user.sessions || [],
  });
}
