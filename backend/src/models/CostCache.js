import mongoose from 'mongoose';

// Stores Cost Explorer answers so we do not pay for the same API call repeatedly.
const schema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  data: { type: mongoose.Schema.Types.Mixed, required: true },
  fetchedAt: { type: Date, required: true },
});

export default mongoose.model('CostCache', schema);
