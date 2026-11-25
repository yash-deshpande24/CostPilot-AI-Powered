import Recommendation from '../models/Recommendation.js';

// Saves scan findings. Existing items keep their status (dismissed stays dismissed).
// Items that used to be "new" but were not found this time become "resolved".
export async function saveScanResults({ source, findings, scannedTypes, startedAt }) {
  let created = 0;
  let updated = 0;
  for (const f of findings) {
    const existing = await Recommendation.findOne({ source, type: f.type, resourceId: f.resourceId });
    if (!existing) {
      await Recommendation.create({ ...f, source, lastSeenAt: new Date() });
      created++;
    } else {
      existing.set({
        title: f.title,
        detail: f.detail,
        region: f.region,
        monthlySavings: f.monthlySavings,
        lastSeenAt: new Date(),
      });
      if (existing.status === 'resolved') existing.status = 'new';
      await existing.save();
      updated++;
    }
  }
  const res = await Recommendation.updateMany(
    { source, type: { $in: scannedTypes }, status: 'new', lastSeenAt: { $lt: startedAt } },
    { $set: { status: 'resolved' } }
  );
  // A finding with an open pull request that no longer exists usually means the fix landed.
  const fixed = await Recommendation.updateMany(
    { source, type: { $in: scannedTypes }, status: 'pr_opened', lastSeenAt: { $lt: startedAt } },
    { $set: { status: 'applied', appliedAt: new Date() } }
  );
  return { created, updated, resolved: res.modifiedCount, applied: fixed.modifiedCount };
}
