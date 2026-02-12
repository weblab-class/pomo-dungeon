import { connectMongo } from '../../server/db.js';
import FriendRequest from '../../server/models/FriendRequest.js';

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
  if (req.method !== 'DELETE') {
    res.setHeader('Allow', 'DELETE');
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  try {
    await connectMongo(process.env.MONGODB_URI);
  } catch (error) {
    sendJson(res, 500, { error: error?.message || 'MongoDB not connected' });
    return;
  }

  const { userId, friendId } = await readJsonBody(req);
  const normalizedUserId = normalizeUserId(userId);
  const normalizedFriendId = normalizeUserId(friendId);

  if (!normalizedUserId || !normalizedFriendId) {
    sendJson(res, 400, { error: 'userId and friendId are required' });
    return;
  }

  const result = await FriendRequest.deleteOne({
    $or: [
      { requesterId: normalizedUserId, receiverId: normalizedFriendId, status: 'accepted' },
      { requesterId: normalizedFriendId, receiverId: normalizedUserId, status: 'accepted' }
    ]
  });

  if (result.deletedCount === 0) {
    sendJson(res, 404, { error: 'Friendship not found' });
    return;
  }

  sendJson(res, 200, {
    success: true,
    message: 'Friend removed successfully'
  });
}
