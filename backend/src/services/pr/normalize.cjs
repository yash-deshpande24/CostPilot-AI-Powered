// Turns a saved recommendation (from the Week 2 scanners) into one simple shape.
// If your Recommendation model uses other field names, add them to the lists below.
// This is the only place that knows the model's field names.
function pick(obj, keys) {
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k];
  }
  return undefined;
}

function kindOf(raw) {
  const t = String(raw || '').toLowerCase();
  if (t.includes('ebs') || t.includes('volume')) return 'ebs';
  if (t.includes('eip') || t.includes('elastic') || t.includes('address')) return 'eip';
  if (t.includes('ec2') || t.includes('idle') || t.includes('instance')) return 'ec2';
  return 'other';
}

const ACTIONS = {
  ebs: { action: 'delete_unattached_volume', label: 'Delete unattached EBS volume', risk: 'high' },
  eip: { action: 'release_elastic_ip', label: 'Release unused Elastic IP', risk: 'low' },
  ec2: { action: 'stop_idle_instance', label: 'Stop idle EC2 instance', risk: 'medium' },
  other: { action: 'review_resource', label: 'Review resource', risk: 'medium' },
};

function normalize(rec) {
  const r = rec && typeof rec.toObject === 'function' ? rec.toObject() : rec || {};
  const kind = kindOf(pick(r, ['type', 'kind', 'scanner', 'category', 'resourceType']));
  const resourceId = String(
    pick(r, ['resourceId', 'resource_id', 'resource', 'targetId', 'instanceId', 'volumeId', 'allocationId']) ||
      r._id ||
      'unknown'
  );
  const savings = Number(
    pick(r, ['monthlySavings', 'estimatedMonthlySavings', 'savings', 'monthlyCost', 'amount']) || 0
  );
  return {
    id: String(r._id || ''),
    kind,
    ...ACTIONS[kind],
    resourceId,
    region: pick(r, ['region', 'awsRegion']) || 'ap-south-1',
    title: pick(r, ['title', 'summary', 'description']) || ACTIONS[kind].label,
    monthlySavings: Number.isFinite(savings) ? savings : 0,
    aiPriority: pick(r, ['aiPriority']),
    aiRisk: pick(r, ['aiRisk']),
    aiEffort: pick(r, ['aiEffort']),
    aiReason: pick(r, ['aiReason']),
    details: pick(r, ['details', 'detail', 'meta', 'metadata']) || {},
  };
}

module.exports = { normalize, kindOf, ACTIONS };
