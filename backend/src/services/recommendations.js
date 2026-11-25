import Recommendation from '../models/Recommendation.js';

// Saves scan findings. Existing items keep their status (dismissed stays dismissed).
// Items that were "new" but are no longer found become "resolved".
// Items with an open pull request that are no longer found become "applied": the fix worked.
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
  const notSeen = { source, type: { $in: scannedTypes }, lastSeenAt: { $lt: startedAt } };
  const res = await Recommendation.updateMany({ ...notSeen, status: 'new' }, { $set: { status: 'resolved' } });
  const applied = await Recommendation.updateMany({ ...notSeen, status: 'pr_opened' }, { $set: { status: 'applied' } });
  return { created, updated, resolved: res.modifiedCount, applied: applied.modifiedCount };
}
