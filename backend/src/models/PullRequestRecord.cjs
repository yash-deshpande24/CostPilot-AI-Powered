const mongoose = require('mongoose');

// One row per pull request CostPilot opened (or previewed in mock mode).
const schema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, index: true },
    recommendation: { type: mongoose.Schema.Types.ObjectId, index: true },
    mode: { type: String, enum: ['mock', 'github'], default: 'mock' },
    kind: String,
    resourceId: String,
    savings: Number,
    title: String,
    branch: String,
    path: String,
    number: Number,
    url: String,
    state: { type: String, enum: ['open', 'closed'], default: 'open' },
  },
  { timestamps: true }
);

module.exports = mongoose.models.PullRequestRecord || mongoose.model('PullRequestRecord', schema);
