import mongoose from 'mongoose';

// Saved explanations, so asking about the same day twice costs nothing. Entries expire after 7 days.
const schema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: { type: mongoose.Schema.Types.Mixed, required: true },
  createdAt: { type: Date, default: Date.now, expires: 7 * 24 * 3600 },
});

export default mongoose.model('AiCache', schema);
