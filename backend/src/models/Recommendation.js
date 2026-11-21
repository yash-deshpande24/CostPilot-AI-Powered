import mongoose from 'mongoose';

export const TYPES = ['unattached_ebs', 'unattached_eip', 'idle_ec2'];
export const STATUSES = ['new', 'pr_opened', 'applied', 'dismissed', 'resolved'];

const schema = new mongoose.Schema(
  {
    source: { type: String, enum: ['mock', 'aws'], required: true },
    type: { type: String, enum: TYPES, required: true },
    resourceId: { type: String, required: true },
    region: String,
    title: { type: String, required: true },
    detail: String,
    monthlySavings: { type: Number, default: 0 },
    status: { type: String, enum: STATUSES, default: 'new' },
    prUrl: String, // filled in Week 6
    lastSeenAt: Date,
  },
  { timestamps: true }
);

schema.index({ source: 1, type: 1, resourceId: 1 }, { unique: true });

export default mongoose.model('Recommendation', schema);
