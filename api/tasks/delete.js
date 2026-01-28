import { connectMongo } from '../../server/db.js';
import User from '../../server/models/User.js';

const normalizeUserId = (userId) => (userId || '').trim().toLowerCase();

const sendJson = (res, status, payload) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
};

const readJsonBody = async (req) => {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch (error) {
      return {};
    }
  }

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf-8');
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch (error) {
    return {};
  }
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  try {
    await connectMongo(process.env.MONGODB_URI);
  } catch (error) {
    sendJson(res, 500, { error: error?.message || 'MongoDB not connected' });
    return;
  }

  const { userId, taskId } = await readJsonBody(req);
  const normalizedId = normalizeUserId(userId);
  if (!normalizedId || !taskId) {
    sendJson(res, 400, { error: 'userId and taskId required' });
    return;
  }

  // Use atomic $pull to avoid Mongoose VersionError when another request
  // (e.g. set-username, tasks/upsert) has already updated the same User.
  const user = await User.findOneAndUpdate(
    { userId: normalizedId },
    { $pull: { tasks: { id: taskId } } },
    { new: true }
  ).lean();
  sendJson(res, 200, { tasks: user?.tasks || [] });
}
