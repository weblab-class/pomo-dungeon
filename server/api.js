import crypto from 'node:crypto';
import { connectMongo } from './db.js';
import User from './models/User.js';

const normalizeUserId = (userId) => (userId || '').trim().toLowerCase();

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
  server.middlewares.use(async (req, res, next) => {
    if (!req.url?.startsWith('/api/')) {
      next();
      return;
    }

    try {
      await connectMongo(mongoUri);
    } catch (error) {
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

      const user = await User.findOne({ userId: normalizedId });
      if (!user) {
        sendJson(res, 200, { tasks: [] });
        return;
      }

      user.tasks = (user.tasks || []).filter((t) => t?.id !== taskId);
      await user.save();
      sendJson(res, 200, { tasks: user.tasks || [] });
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
        totalSecondsOnSite: user.totalSecondsOnSite,
        totalHoursOnSite: user.totalSecondsOnSite / 3600,
        totalQuestsCompleted: user.totalQuestsCompleted,
        totalTimeWorkedMs: user.totalTimeWorkedMs,
        quests: user.quests || [],
        sessions: user.sessions || [],
      });
      return;
    }

    notFound(res);
  });
};
