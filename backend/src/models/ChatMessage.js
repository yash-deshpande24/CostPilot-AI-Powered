import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: String, required: true },
    mode: { type: String, enum: ['claude', 'mock'] },
  },
  { timestamps: true }
);

export default mongoose.model('ChatMessage', schema);
