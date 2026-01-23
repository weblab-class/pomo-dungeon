import { Server } from 'socket.io';
import User from './models/User.js';

const userSockets = new Map(); // Map userId -> Set of socketIds

export const setupSocketServer = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  io.on('connection', (socket) => {
    console.log('Socket connected:', socket.id);

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

    // User goes offline
    socket.on('disconnect', async () => {
      console.log('Socket disconnected:', socket.id);
      
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
