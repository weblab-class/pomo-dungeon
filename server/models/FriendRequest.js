import mongoose from 'mongoose';

const FriendRequestSchema = new mongoose.Schema({
  requesterId: {
    type: String,
    required: true,
    ref: 'User'
  },
  receiverId: {
    type: String,
    required: true,
    ref: 'User'
  },
  status: {
    type: String,
    enum: ['pending', 'accepted'],
    default: 'pending'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Compound unique index to prevent duplicate friend requests
FriendRequestSchema.index({ requesterId: 1, receiverId: 1 }, { unique: true });

// Indexes for efficient queries
FriendRequestSchema.index({ receiverId: 1, status: 1 });
FriendRequestSchema.index({ requesterId: 1, status: 1 });

const FriendRequest = mongoose.models.FriendRequest || mongoose.model('FriendRequest', FriendRequestSchema);

export default FriendRequest;
