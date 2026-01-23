import mongoose from 'mongoose';
import { appendFileSync } from 'fs';

let connectionPromise = null;

export const connectMongo = async (mongoUri) => {
  // #region agent log
  try{appendFileSync('c:\\Users\\start\\Desktop\\THE pomodon\\pomo-dungeon\\.cursor\\debug.log',JSON.stringify({location:'db.js:connectMongo-entry',message:'Connect mongo called',data:{mongoUri:mongoUri?'[SET]':'[MISSING]',mongoUriLength:mongoUri?.length,hasExistingConnection:!!connectionPromise,mongooseState:mongoose.connection.readyState},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'MONGO'})+'\n');}catch(e){}
  // #endregion
  if (!mongoUri) {
    throw new Error('Missing MONGODB_URI');
  }
  if (!connectionPromise) {
    // #region agent log
    try{appendFileSync('c:\\Users\\start\\Desktop\\THE pomodon\\pomo-dungeon\\.cursor\\debug.log',JSON.stringify({location:'db.js:connectMongo-creating',message:'Creating new connection',data:{mongoUri:mongoUri?.substring(0,20)+'...',mongooseStateBefore:mongoose.connection.readyState},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'MONGO'})+'\n');}catch(e){}
    // #endregion
    connectionPromise = mongoose.connect(mongoUri, {});
    connectionPromise.then(() => {
      // #region agent log
      try{appendFileSync('c:\\Users\\start\\Desktop\\THE pomodon\\pomo-dungeon\\.cursor\\debug.log',JSON.stringify({location:'db.js:connectMongo-success',message:'MongoDB connected successfully',data:{mongooseState:mongoose.connection.readyState,dbName:mongoose.connection.name},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'MONGO'})+'\n');}catch(e){}
      // #endregion
    }).catch((err) => {
      // #region agent log
      try{appendFileSync('c:\\Users\\start\\Desktop\\THE pomodon\\pomo-dungeon\\.cursor\\debug.log',JSON.stringify({location:'db.js:connectMongo-error',message:'MongoDB connection error',data:{errorMessage:err.message,errorName:err.name,mongooseState:mongoose.connection.readyState},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'MONGO'})+'\n');}catch(e){}
      // #endregion
    });
  }
  return connectionPromise;
};
