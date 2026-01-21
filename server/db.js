import mongoose from 'mongoose';

let connectionPromise = null;

export const connectMongo = async (mongoUri) => {
  if (!mongoUri) {
    throw new Error('Missing MONGODB_URI');
  }
  if (!connectionPromise) {
    connectionPromise = mongoose.connect(mongoUri, {});
  }
  return connectionPromise;
};
