// Starter rule-based detector. Replace thresholds with a tested baseline model.
export function detectCostAnomaly(current, previous, threshold = 0.25) {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous <= 0) {
    return { anomalous: false, changePercent: null, reason: 'Insufficient comparison data' };
  }
  const changePercent = (current - previous) / previous;
  return {
    anomalous: changePercent >= threshold,
    changePercent: Number((changePercent * 100).toFixed(2))
  };
}
