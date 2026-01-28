import { connectMongo } from '../../server/db.js';
import User from '../../server/models/User.js';
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

  const { userId, friendUsername } = await readJsonBody(req);
  const normalizedRequesterId = normalizeUserId(userId);

  if (!normalizedRequesterId || !friendUsername) {
    sendJson(res, 400, { error: 'userId and friendUsername are required' });
    return;
  }

  // Find receiver by username field
  const receiver = await User.findOne({ username: friendUsername.trim() });
  if (!receiver) {
    sendJson(res, 404, { error: 'User not found' });
    return;
  }

  // Check if sending to self
  if (normalizedRequesterId === receiver.userId) {
    sendJson(res, 400, { error: 'Cannot send friend request to yourself' });
    return;
  }

  // Check if request already exists (bidirectional)
  const existingRequest = await FriendRequest.findOne({
    $or: [
      { requesterId: normalizedRequesterId, receiverId: receiver.userId },
      { requesterId: receiver.userId, receiverId: normalizedRequesterId }
    ]
  });

  if (existingRequest) {
    if (existingRequest.status === 'pending') {
      sendJson(res, 400, { error: 'Friend request already pending' });
      return;
    } else if (existingRequest.status === 'accepted') {
      sendJson(res, 400, { error: 'Already friends' });
      return;
    }
  }

  // Create friend request
  const friendRequest = await FriendRequest.create({
    requesterId: normalizedRequesterId,
    receiverId: receiver.userId,
    status: 'pending',
    createdAt: new Date()
  });

  sendJson(res, 201, {
    success: true,
    requestId: friendRequest._id,
    message: 'Friend request sent'
  });
}
