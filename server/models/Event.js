import mongoose from 'mongoose';

const EventSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  eventType: { type: String, required: true, index: true },
  payload: { type: mongoose.Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now },
});

const Event = mongoose.models.Event || mongoose.model('Event', EventSchema);

export default Event;
