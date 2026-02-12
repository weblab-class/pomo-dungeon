import { Server } from 'socket.io';
import User from './models/User.js';

const userSockets = new Map(); // Map userId -> Set of socketIds

// Socket metrics: timing + disconnect tracking for real-time latency & stability
const MAX_LATENCIES = 1000;
const MAX_DISCONNECTS = 200;
const socketMetrics = {
  connectionsTotal: 0,
  disconnectsTotal: 0,
  connectionStarts: new Map(), // socketId -> startTime
  connectionDurationsMs: [],
  latenciesMs: [],
  disconnectReasons: [],
};

export function getSocketMetrics() {
  const recentLatencies = socketMetrics.latenciesMs.slice(-500);
  const sorted = recentLatencies.length ? [...recentLatencies].sort((a, b) => a - b) : [];
  const p95Index = sorted.length ? Math.min(Math.floor(sorted.length * 0.95), sorted.length - 1) : -1;
  const currentConnections = socketMetrics.connectionStarts.size;
  const avgDuration =
    socketMetrics.connectionDurationsMs.length > 0
      ? socketMetrics.connectionDurationsMs.reduce((a, b) => a + b, 0) / socketMetrics.connectionDurationsMs.length
      : null;
  return {
    connectionsTotal: socketMetrics.connectionsTotal,
    disconnectsTotal: socketMetrics.disconnectsTotal,
    currentConnections,
    avgConnectionDurationMs: avgDuration ? Math.round(avgDuration) : null,
    p95LatencyMs: p95Index >= 0 ? sorted[p95Index] : null,
    disconnectReasons: socketMetrics.disconnectReasons.slice(-20),
  };
}

export const setupSocketServer = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  io.on('connection', (socket) => {
    console.log('Socket connected:', socket.id);
    socketMetrics.connectionsTotal += 1;
    socketMetrics.connectionStarts.set(socket.id, Date.now());

    // Latency: server sends ping, client responds with pong and timestamp
    socket.on('latency-pong', (clientTs) => {
      const rtt = typeof clientTs === 'number' ? Date.now() - clientTs : null;
      if (rtt != null && rtt >= 0) {
        socketMetrics.latenciesMs.push(rtt);
        if (socketMetrics.latenciesMs.length > MAX_LATENCIES) socketMetrics.latenciesMs.shift();
      }
    });

    // Send one ping immediately so we get a latency sample quickly
    if (socket.connected) socket.emit('latency-ping', { ts: Date.now() });
    const latencyInterval = setInterval(() => {
      if (socket.connected) socket.emit('latency-ping', { ts: Date.now() });
    }, 5000);
    socket.on('disconnect', () => clearInterval(latencyInterval));

    // User comes online
    socket.on('user-online', async (userId) => {
      if (!userId) return;
      
      const normalizedId = userId.trim().toLowerCase();
      
      // Add socket to user's socket set
      if (!userSockets.has(normalizedId)) {
        userSockets.set(normalizedId, new Set());
      }
      userSockets.get(normalizedId).add(socket.id);
      
      // Update user's online status in DB
      try {
        await User.findOneAndUpdate(
          { userId: normalizedId },
          { 
            $set: { 
              isOnline: true,
              lastSeen: new Date()
            } 
          }
        );
        
        // Broadcast to all clients that this user is online
        io.emit('user-status-change', {
          userId: normalizedId,
          isOnline: true,
          lastSeen: new Date()
        });
        
        console.log(`User ${normalizedId} is now online`);
      } catch (error) {
        console.error('Error updating user online status:', error);
      }
    });

    // User goes offline + disconnect tracking
    socket.on('disconnect', async (reason) => {
      console.log('Socket disconnected:', socket.id, reason);
      socketMetrics.disconnectsTotal += 1;
      const start = socketMetrics.connectionStarts.get(socket.id);
      if (start != null) {
        socketMetrics.connectionStarts.delete(socket.id);
        const durationMs = Date.now() - start;
        socketMetrics.connectionDurationsMs.push(durationMs);
        if (socketMetrics.connectionDurationsMs.length > MAX_DISCONNECTS) socketMetrics.connectionDurationsMs.shift();
      }
      socketMetrics.disconnectReasons.push({ reason, at: new Date().toISOString() });
      if (socketMetrics.disconnectReasons.length > MAX_DISCONNECTS) socketMetrics.disconnectReasons.shift();

      // Find which user this socket belonged to
      let disconnectedUserId = null;
      for (const [userId, sockets] of userSockets.entries()) {
        if (sockets.has(socket.id)) {
          sockets.delete(socket.id);
          
          // If no more sockets for this user, they're offline
          if (sockets.size === 0) {
            disconnectedUserId = userId;
            userSockets.delete(userId);
          }
          break;
        }
      }
      
      if (disconnectedUserId) {
        try {
          await User.findOneAndUpdate(
            { userId: disconnectedUserId },
            { 
              $set: { 
                isOnline: false,
                lastSeen: new Date()
              } 
            }
          );
          
          // Broadcast to all clients that this user is offline
          io.emit('user-status-change', {
            userId: disconnectedUserId,
            isOnline: false,
            lastSeen: new Date()
          });
          
          console.log(`User ${disconnectedUserId} is now offline`);
        } catch (error) {
          console.error('Error updating user offline status:', error);
        }
      }
    });
  });

  return io;
};

export const isUserOnline = (userId) => {
  return userSockets.has(userId);
};
