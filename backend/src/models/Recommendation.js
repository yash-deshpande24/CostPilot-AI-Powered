import mongoose from 'mongoose';

const recommendationSchema = new mongoose.Schema(
  {
    owner: { type: String, required: true, index: true },
    type: { type: String, required: true },
    resource: { type: String, required: true },
    region: { type: String, default: 'us-east-1' },
    title: { type: String, required: true },
    detail: { type: String, default: '' },
    monthlySavings: { type: Number, required: true },
    status: { type: String, enum: ['open', 'dismissed'], default: 'open' },
  },
  { timestamps: true }
);

export default mongoose.model('Recommendation', recommendationSchema);