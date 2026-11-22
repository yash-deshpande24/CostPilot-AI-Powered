import mongoose from 'mongoose';

// One document per user per UTC day. Used for the daily limit and, in Week 7, Datadog cost metrics.
const schema = new mongoose.Schema({
  userId: { type: String, required: true },
  date: { type: String, required: true }, // YYYY-MM-DD (UTC)
  calls: { type: Number, default: 0 },
  inputTokens: { type: Number, default: 0 },
  outputTokens: { type: Number, default: 0 },
});
schema.index({ userId: 1, date: 1 }, { unique: true });

export default mongoose.model('AiUsage', schema);
