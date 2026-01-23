import { io } from 'socket.io-client';

let socket = null;
let currentUserId = null;
const statusCallbacks = new Set();

export const initSocket = (userId) => {
  if (socket && socket.connected && currentUserId === userId) {
    return socket;
  }

  // Disconnect existing socket if user changed
  if (socket && currentUserId !== userId) {
    socket.disconnect();
  }

  currentUserId = userId;
  
  // Connect to socket server (same origin as the app)
  socket = io(window.location.origin, {
    transports: ['websocket', 'polling'],
  });

  socket.on('connect', () => {
    console.log('Socket connected:', socket.id);
    if (currentUserId) {
      socket.emit('user-online', currentUserId);
    }
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected');
  });

  socket.on('user-status-change', (data) => {
    // Notify all registered callbacks
    statusCallbacks.forEach(callback => {
      callback(data);
    });
  });

  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
    currentUserId = null;
  }
};

export const onUserStatusChange = (callback) => {
  statusCallbacks.add(callback);
  
  // Return unsubscribe function
  return () => {
    statusCallbacks.delete(callback);
  };
};

export const getSocket = () => socket;
