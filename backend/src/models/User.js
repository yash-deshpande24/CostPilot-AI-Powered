import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['admin', 'viewer'], default: 'admin' },
    resetTokenHash: String, // SHA-256 of the reset token, never the token itself
    resetExpires: Date,
  },
  { timestamps: true }
);

export default mongoose.model('User', userSchema);