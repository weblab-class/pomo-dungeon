import mongoose from 'mongoose';

const QuestSchema = new mongoose.Schema(
  {
    questId: { type: String, required: true },
    name: { type: String, default: '' },
    priority: { type: String, default: '' },
    startedAt: { type: Date },
    finishedAt: { type: Date },
    durationSeconds: { type: Number, default: 0 },
  },
  { _id: false }
);

const SessionSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true },
    openedAt: { type: Date },
    closedAt: { type: Date },
    durationSeconds: { type: Number, default: 0 },
  },
  { _id: false }
);

const UserSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  email: { type: String, default: '' },
  name: { type: String, default: '' },
  picture: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  totalSecondsOnSite: { type: Number, default: 0 },
  totalQuestsCompleted: { type: Number, default: 0 },
  totalTimeWorkedMs: { type: Number, default: 0 },
  tasks: { type: [mongoose.Schema.Types.Mixed], default: [] },
  quests: { type: [QuestSchema], default: [] },
  sessions: { type: [SessionSchema], default: [] },
});

const User = mongoose.models.User || mongoose.model('User', UserSchema);

export default User;
