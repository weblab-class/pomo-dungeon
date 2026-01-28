import crypto from 'node:crypto';
import { connectMongo } from './db.js';
import User from './models/User.js';
import FriendRequest from './models/FriendRequest.js';

const normalizeUserId = (userId) => (userId || '').trim().toLowerCase();
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

const readJsonBody = async (req) => {
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

const sendJson = (res, status, payload) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
};

const notFound = (res) => sendJson(res, 404, { error: 'Not found' });

export const registerApiMiddleware = (server, { mongoUri }) => {
  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/13d600c1-3f34-4e60-b1d2-361a4f00b402',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api.js:registerApiMiddleware',message:'API middleware registered',data:{mongoUriProvided:!!mongoUri,mongoUriPrefix:mongoUri?.substring(0,15)},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'MONGO'})}).catch(()=>{});
  // #endregion
  server.middlewares.use(async (req, res, next) => {
    if (!req.url?.startsWith('/api/')) {
      next();
      return;
    }

    try {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/13d600c1-3f34-4e60-b1d2-361a4f00b402',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api.js:before-connectMongo',message:'About to connect to MongoDB',data:{url:req.url,method:req.method,mongoUriAvailable:!!mongoUri},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'MONGO'})}).catch(()=>{});
      // #endregion
      await connectMongo(mongoUri);
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/13d600c1-3f34-4e60-b1d2-361a4f00b402',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api.js:after-connectMongo',message:'MongoDB connect returned',data:{url:req.url},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'MONGO'})}).catch(()=>{});
      // #endregion
    } catch (error) {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/13d600c1-3f34-4e60-b1d2-361a4f00b402',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api.js:connectMongo-catch',message:'MongoDB connect error caught',data:{errorMessage:error?.message,errorStack:error?.stack?.substring(0,200)},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'MONGO'})}).catch(()=>{});
      // #endregion
      sendJson(res, 500, { error: error?.message || 'MongoDB not connected' });
      return;
    }

    const { url, method } = req;

    if (url === '/api/health' && method === 'GET') {
      sendJson(res, 200, { ok: true });
      return;
    }

    if (url === '/api/users/upsert' && method === 'POST') {
      const { userId, email, name, picture } = await readJsonBody(req);
      const normalizedId = normalizeUserId(userId || email);
      if (!normalizedId) {
        sendJson(res, 400, { error: 'userId required' });
        return;
      }

      const update = {
        userId: normalizedId,
        email: email || normalizedId,
        name: name || '',
        picture: picture || '',
      };

      const user = await User.findOneAndUpdate(
        { userId: normalizedId },
        { $set: update, $setOnInsert: { createdAt: new Date() } },
        { new: true, upsert: true }
      );
      sendJson(res, 200, { user });
      return;
    }

    if (url?.startsWith('/api/users/check-username') && method === 'GET') {
      const requestUrl = new URL(url, 'http://localhost');
      const rawUsername = requestUrl.searchParams.get('username');
      const normalizedUsername = normalizeUsername(rawUsername);
      const validationError = validateUsername(normalizedUsername);
      if (validationError) {
        sendJson(res, 400, { available: false, error: validationError });
        return;
      }

      const existing = await User.findOne({ username: normalizedUsername }).lean();
      sendJson(res, 200, { available: !existing });
      return;
    }

    if (url === '/api/users/set-username' && method === 'POST') {
      const { userId, username } = await readJsonBody(req);
      const normalizedId = normalizeUserId(userId);
      if (!normalizedId) {
        sendJson(res, 400, { error: 'userId required' });
        return;
      }
      const normalizedUsername = normalizeUsername(username);
      const validationError = validateUsername(normalizedUsername);
      if (validationError) {
        sendJson(res, 400, { error: validationError });
        return;
      }

      const existing = await User.findOne({ username: normalizedUsername }).lean();
      if (existing && existing.userId !== normalizedId) {
        sendJson(res, 409, { error: 'Username already taken' });
        return;
      }

      const user = await User.findOneAndUpdate(
        { userId: normalizedId },
        { $set: { username: normalizedUsername } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
      sendJson(res, 200, { user });
      return;
    }

    // GET /api/users/check-username - Check if username is available
    if (url?.startsWith('/api/users/check-username') && method === 'GET') {
      const urlObj = new URL(url, `http://${req.headers.host}`);
      const username = urlObj.searchParams.get('username');
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/13d600c1-3f34-4e60-b1d2-361a4f00b402',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api.js:check-username-entry',message:'Check username entry',data:{username:username,usernameType:typeof username,usernameLength:username?.length},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'H1'})}).catch(()=>{});
      // #endregion

      if (!username) {
        sendJson(res, 400, { error: 'username parameter required' });
        return;
      }

      // Validate username format
      if (username.length < 3 || username.length > 20) {
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/13d600c1-3f34-4e60-b1d2-361a4f00b402',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api.js:check-username-length-fail',message:'Length validation failed',data:{username:username,length:username.length},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'H4'})}).catch(()=>{});
        // #endregion
        sendJson(res, 200, { available: false, error: 'Username must be 3-20 characters' });
        return;
      }

      if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/13d600c1-3f34-4e60-b1d2-361a4f00b402',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api.js:check-username-format-fail',message:'Format validation failed',data:{username:username,regex_test:!/^[a-zA-Z0-9_]+$/.test(username)},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'H4'})}).catch(()=>{});
        // #endregion
        sendJson(res, 200, { available: false, error: 'Username can only contain letters, numbers, and underscores' });
        return;
      }

      // Check if username exists (case-insensitive)
      const existing = await User.findOne({ 
        username: { $regex: new RegExp(`^${username}$`, 'i') } 
      });
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/13d600c1-3f34-4e60-b1d2-361a4f00b402',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api.js:check-username-db-result',message:'Database query result',data:{username:username,existingFound:!!existing,existingId:existing?._id,existingUsername:existing?.username,available:!existing},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'H2'})}).catch(()=>{});
      // #endregion
      sendJson(res, 200, { available: !existing });
      return;
    }

    // POST /api/users/set-username - Set username for user
    if (url === '/api/users/set-username' && method === 'POST') {
      const { userId, username } = await readJsonBody(req);
      const normalizedId = normalizeUserId(userId);
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/13d600c1-3f34-4e60-b1d2-361a4f00b402',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api.js:set-username-entry',message:'Set username entry',data:{userId:userId?.substring(0,20),normalizedId:normalizedId?.substring(0,20),username:username},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'FIX'})}).catch(()=>{});
      // #endregion

      if (!normalizedId || !username) {
        sendJson(res, 400, { error: 'userId and username are required' });
        return;
      }

      // Validate username format
      if (username.length < 3 || username.length > 20) {
        sendJson(res, 400, { error: 'Username must be 3-20 characters' });
        return;
      }

      if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        sendJson(res, 400, { error: 'Username can only contain letters, numbers, and underscores' });
        return;
      }

      // Check if username is already taken (case-insensitive)
      const existing = await User.findOne({ 
        username: { $regex: new RegExp(`^${username}$`, 'i') } 
      });
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/13d600c1-3f34-4e60-b1d2-361a4f00b402',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api.js:set-username-existing-check',message:'Checked existing username',data:{username:username,existingFound:!!existing,existingUserId:existing?.userId?.substring(0,20),normalizedId:normalizedId?.substring(0,20),isSameUser:existing?.userId===normalizedId},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'FIX'})}).catch(()=>{});
      // #endregion
      if (existing && existing.userId !== normalizedId) {
        sendJson(res, 400, { error: 'Username already taken' });
        return;
      }

      // Update user with username (with upsert to create if doesn't exist)
      const user = await User.findOneAndUpdate(
        { userId: normalizedId },
        { $set: { username: username }, $setOnInsert: { createdAt: new Date() } },
        { new: true, upsert: true }
      );
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/13d600c1-3f34-4e60-b1d2-361a4f00b402',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api.js:set-username-success',message:'Username set successfully',data:{userId:user.userId?.substring(0,20),username:user.username,wasUpserted:!existing},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'FIX'})}).catch(()=>{});
      // #endregion

      sendJson(res, 200, { success: true, username: user.username });
      return;
    }

    if (url === '/api/sessions/start' && method === 'POST') {
      const { userId, openedAt } = await readJsonBody(req);
      const normalizedId = normalizeUserId(userId);
      if (!normalizedId) {
        sendJson(res, 400, { error: 'userId required' });
        return;
      }

      const sessionId = crypto.randomUUID();
      const session = {
        sessionId,
        openedAt: openedAt ? new Date(openedAt) : new Date(),
        closedAt: null,
        durationSeconds: 0,
      };

      await User.findOneAndUpdate(
        { userId: normalizedId },
        {
          $setOnInsert: { createdAt: new Date() },
          $push: { sessions: session },
        },
        { upsert: true }
      );
      sendJson(res, 200, { sessionId });
      return;
    }

    if (url === '/api/sessions/end' && method === 'POST') {
      const { userId, sessionId, closedAt, durationSeconds } = await readJsonBody(req);
      const normalizedId = normalizeUserId(userId);
      if (!normalizedId || !sessionId) {
        sendJson(res, 400, { error: 'userId and sessionId required' });
        return;
      }

      const duration = Math.max(0, Number(durationSeconds || 0));
      const closeDate = closedAt ? new Date(closedAt) : new Date();

      const user = await User.findOne({ userId: normalizedId });
      if (!user) {
        sendJson(res, 404, { error: 'User not found' });
        return;
      }

      const sessionIndex = user.sessions.findIndex((s) => s.sessionId === sessionId);
      if (sessionIndex >= 0) {
        user.sessions[sessionIndex].closedAt = closeDate;
        user.sessions[sessionIndex].durationSeconds = duration;
      } else {
        user.sessions.push({
          sessionId,
          openedAt: null,
          closedAt: closeDate,
          durationSeconds: duration,
        });
      }

      user.totalSecondsOnSite += duration;
      await user.save();
      sendJson(res, 200, { ok: true });
      return;
    }

    if (url === '/api/quests/complete' && method === 'POST') {
      const {
        userId,
        questId,
        name,
        priority,
        startedAt,
        finishedAt,
        durationSeconds,
        timeSpentMs,
      } = await readJsonBody(req);
      const normalizedId = normalizeUserId(userId);
      if (!normalizedId || !questId) {
        sendJson(res, 400, { error: 'userId and questId required' });
        return;
      }

      const questDurationSeconds = Math.max(0, Number(durationSeconds || 0));
      const quest = {
        questId,
        name: name || '',
        priority: priority || '',
        startedAt: startedAt ? new Date(startedAt) : null,
        finishedAt: finishedAt ? new Date(finishedAt) : new Date(),
        durationSeconds: questDurationSeconds,
      };

      const workedMs = Math.max(0, Number(timeSpentMs || 0));

      await User.findOneAndUpdate(
        { userId: normalizedId },
        {
          $setOnInsert: { createdAt: new Date() },
          $push: { quests: quest },
          $inc: {
            totalQuestsCompleted: 1,
            totalTimeWorkedMs: workedMs,
          },
        },
        { upsert: true }
      );

      sendJson(res, 200, { ok: true });
      return;
    }

    if (url?.startsWith('/api/tasks/') && method === 'GET') {
      const userId = decodeURIComponent(url.replace('/api/tasks/', ''));
      const normalizedId = normalizeUserId(userId);
      if (!normalizedId) {
        sendJson(res, 400, { error: 'userId required' });
        return;
      }

      const user = await User.findOne({ userId: normalizedId }).lean();
      sendJson(res, 200, { tasks: user?.tasks || [] });
      return;
    }

    if (url === '/api/tasks/upsert' && method === 'POST') {
      const { userId, task } = await readJsonBody(req);
      const normalizedId = normalizeUserId(userId);
      if (!normalizedId || !task?.id) {
        sendJson(res, 400, { error: 'userId and task required' });
        return;
      }

      const existing = await User.findOne({ userId: normalizedId });
      if (!existing) {
        const user = await User.create({
          userId: normalizedId,
          tasks: [task],
        });
        sendJson(res, 200, { tasks: user.tasks || [] });
        return;
      }

      const idx = existing.tasks.findIndex((t) => t?.id === task.id);
      if (idx >= 0) {
        existing.tasks[idx] = { ...existing.tasks[idx], ...task };
      } else {
        existing.tasks.push(task);
      }
      await existing.save();
      sendJson(res, 200, { tasks: existing.tasks || [] });
      return;
    }

    if (url === '/api/tasks/delete' && method === 'POST') {
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
      return;
    }

    if (url?.startsWith('/api/stats/') && method === 'GET') {
      const userId = decodeURIComponent(url.replace('/api/stats/', ''));
      const normalizedId = normalizeUserId(userId);
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
        username: user.username || null,
        totalSecondsOnSite: user.totalSecondsOnSite,
        totalHoursOnSite: user.totalSecondsOnSite / 3600,
        totalQuestsCompleted: user.totalQuestsCompleted,
        totalTimeWorkedMs: user.totalTimeWorkedMs,
        quests: user.quests || [],
        sessions: user.sessions || [],
      });
      return;
    }

    // ==================== FRIENDS API ====================

    // POST /api/friend-requests - Send friend request
    if (url === '/api/friend-requests' && method === 'POST') {
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
      return;
    }

    // GET /api/friend-requests/:userId - Get received friend requests
    if (url?.startsWith('/api/friend-requests/') && method === 'GET') {
      const userId = decodeURIComponent(url.replace('/api/friend-requests/', ''));
      const normalizedId = normalizeUserId(userId);
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
    if (url?.startsWith('/api/friend-requests/') && method === 'PATCH') {
      const requestId = decodeURIComponent(url.split('/').pop());
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

    // GET /api/friends/:userId - Get friends list
    if (url?.startsWith('/api/friends/') && method === 'GET') {
      const userId = decodeURIComponent(url.replace('/api/friends/', ''));
      const normalizedId = normalizeUserId(userId);
      if (!normalizedId) {
        sendJson(res, 400, { error: 'userId required' });
        return;
      }

      // Find all accepted friend requests where user is either requester or receiver
      const requests = await FriendRequest.find({
        $or: [
          { requesterId: normalizedId, status: 'accepted' },
          { receiverId: normalizedId, status: 'accepted' }
        ]
      });

      // Map to friend list with usernames and online status
      const friends = await Promise.all(
        requests.map(async (req) => {
          const friendId = req.requesterId === normalizedId ? req.receiverId : req.requesterId;
          const friendUser = await User.findOne({ userId: friendId }).lean();
          
          return {
            id: friendId,
            username: friendUser?.username || friendUser?.name || friendUser?.userId || friendId,
            isOnline: friendUser?.isOnline || false,
            lastSeen: friendUser?.lastSeen || null
          };
        })
      );

      sendJson(res, 200, { friends });
      return;
    }

    // DELETE /api/friends - Remove friend
    if (url === '/api/friends' && method === 'DELETE') {
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
      return;
    }

    // GET /api/users/summary/:userId - Get user summary (quests, time worked, online status)
    if (url?.startsWith('/api/users/summary/') && method === 'GET') {
      const userId = decodeURIComponent(url.replace('/api/users/summary/', ''));
      const normalizedId = normalizeUserId(userId);
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
      return;
    }

    // GET /api/users/search - Search users by username
    if (url?.startsWith('/api/users/search') && method === 'GET') {
      const urlObj = new URL(url, `http://${req.headers.host}`);
      const query = urlObj.searchParams.get('q') || '';
      const excludeUserId = normalizeUserId(urlObj.searchParams.get('excludeUserId') || '');

      if (!query) {
        sendJson(res, 200, { users: [] });
        return;
      }

      const normalizedQuery = normalizeUserId(query);

      // Search for users whose userId or name contains the query
      const searchConditions = {
        $or: [
          { userId: { $regex: normalizedQuery, $options: 'i' } },
          { name: { $regex: query, $options: 'i' } }
        ]
      };

      if (excludeUserId) {
        searchConditions.userId = { ...searchConditions.userId, $ne: excludeUserId };
      }

      const users = await User.find(searchConditions)
        .select('userId name')
        .limit(10)
        .lean();

      const userList = users.map(user => ({
        id: user.userId,
        username: user.name || user.userId
      }));

      sendJson(res, 200, { users: userList });
      return;
    }

    notFound(res);
  });
};
