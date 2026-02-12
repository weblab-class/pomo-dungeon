import { connectMongo } from '../../server/db.js';
import User from '../../server/models/User.js';
import FriendRequest from '../../server/models/FriendRequest.js';
import mongoose from 'mongoose';

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

const getRouteParam = (req) => {
  if (req.query?.param) return req.query.param;
  try {
    const requestUrl = new URL(req.url, `http://${req.headers.host}`);
    const parts = requestUrl.pathname.split('/').filter(Boolean);
    // Find the param after 'friend-requests'
    const friendRequestsIndex = parts.indexOf('friend-requests');
    if (friendRequestsIndex >= 0 && parts[friendRequestsIndex + 1]) {
      return parts[friendRequestsIndex + 1];
    }
    return parts[parts.length - 1] || null;
  } catch (error) {
    return null;
  }
};

const isValidObjectId = (str) => {
  return mongoose.Types.ObjectId.isValid(str) && str.length === 24;
};

export default async function handler(req, res) {
  try {
    await connectMongo(process.env.MONGODB_URI);
  } catch (error) {
    sendJson(res, 500, { error: error?.message || 'MongoDB not connected' });
    return;
  }

  const param = getRouteParam(req);
  if (!param) {
    sendJson(res, 400, { error: 'Parameter required' });
    return;
  }

  const decodedParam = decodeURIComponent(param);

  // GET /api/friend-requests/:userId - Get received friend requests
  if (req.method === 'GET') {
    const normalizedId = normalizeUserId(decodedParam);
    if (!normalizedId) {
      sendJson(res, 400, { error: 'userId required' });
      return;
    }

    const requests = await FriendRequest.find({
      receiverId: normalizedId,
      status: 'pending'
    }).sort({ createdAt: -1 });

    // Get requester usernames
    const requestsWithUsernames = await Promise.all(
      requests.map(async (req) => {
        const requester = await User.findOne({ userId: req.requesterId }).lean();
        return {
          id: req._id,
          requesterId: req.requesterId,
          requesterUsername: requester?.username || requester?.name || requester?.userId || req.requesterId,
          receiverId: req.receiverId,
          status: req.status,
          createdAt: req.createdAt.toISOString()
        };
      })
    );

    sendJson(res, 200, { requests: requestsWithUsernames });
    return;
  }

  // PATCH /api/friend-requests/:requestId - Accept/reject friend request
  if (req.method === 'PATCH') {
    if (!isValidObjectId(decodedParam)) {
      sendJson(res, 400, { error: 'Invalid requestId format' });
      return;
    }

    const requestId = decodedParam;
    const { userId, action } = await readJsonBody(req);
    const normalizedId = normalizeUserId(userId);

    if (!normalizedId || !action) {
      sendJson(res, 400, { error: 'userId and action are required' });
      return;
    }

    if (action !== 'accept' && action !== 'reject') {
      sendJson(res, 400, { error: 'Invalid action. Use "accept" or "reject"' });
      return;
    }

    if (action === 'accept') {
      const request = await FriendRequest.findOneAndUpdate(
        {
          _id: requestId,
          receiverId: normalizedId,
          status: 'pending'
        },
        { status: 'accepted' },
        { new: true }
      );

      if (!request) {
        sendJson(res, 404, { error: 'Friend request not found or already processed' });
        return;
      }

      sendJson(res, 200, {
        success: true,
        message: 'Friend request accepted'
      });
    } else {
      // Reject - delete the request
      const result = await FriendRequest.deleteOne({
        _id: requestId,
        receiverId: normalizedId,
        status: 'pending'
      });

      if (result.deletedCount === 0) {
        sendJson(res, 404, { error: 'Friend request not found or already processed' });
        return;
      }

      sendJson(res, 200, {
        success: true,
        message: 'Friend request rejected'
      });
    }
    return;
  }

  res.setHeader('Allow', 'GET, PATCH');
  sendJson(res, 405, { error: 'Method not allowed' });
}
