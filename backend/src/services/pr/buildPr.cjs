// Builds the branch name, file, title and description of a pull request.
// The pull request adds ONE small remediation file to the GitOps repo.
// CostPilot never changes AWS directly: a human reviews, merges and applies.
function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'item';
}

function money(n) {
  return `$${Number(n || 0).toFixed(2)}`;
}

function buildPr(n, { dir = 'costpilot-gitops/remediations', now = new Date(), suffix } = {}) {
  const day = now.toISOString().slice(0, 10).replace(/-/g, '');
  const tail = suffix || Math.random().toString(16).slice(2, 6);
  const base = `${n.kind}-${slug(n.resourceId)}`;
  const branch = `costpilot/${base}-${day}-${tail}`;
  const path = `${dir}/${base}.yaml`;
  const title = `CostPilot: ${n.label} ${n.resourceId} (save about ${money(n.monthlySavings)}/month)`;

  // JSON strings are valid YAML scalars, so this file is safe for any resource name.
  const content = [
    '# Opened by CostPilot. Review it, then merge or close this pull request.',
    'apiVersion: costpilot.io/v1',
    'kind: Remediation',
    'metadata:',
    `  name: ${JSON.stringify(base)}`,
    `  createdAt: ${JSON.stringify(now.toISOString())}`,
    'spec:',
    `  action: ${n.action}`,
    `  resourceId: ${JSON.stringify(n.resourceId)}`,
    `  region: ${JSON.stringify(n.region)}`,
    `  estimatedMonthlySavingsUsd: ${n.monthlySavings.toFixed(2)}`,
    `  risk: ${n.aiRisk || n.risk}`,
    `  recommendationId: ${JSON.stringify(n.id)}`,
    '',
  ].join('\n');

  const lines = [
    `CostPilot found a waste finding and suggests this change.`,
    '',
    `| | |`,
    `|---|---|`,
    `| Action | ${n.label} |`,
    `| Resource | \`${n.resourceId}\` |`,
    `| Region | ${n.region} |`,
    `| Estimated saving | ${money(n.monthlySavings)} per month |`,
    `| Risk | ${n.aiRisk || n.risk} |`,
  ];
  if (n.aiEffort) lines.push(`| Effort | ${n.aiEffort} |`);
  if (n.aiReason) lines.push('', `**Why:** ${n.aiReason}`);
  lines.push(
    '',
    '### Before you merge',
    '',
    '- [ ] I checked in the AWS console that this resource is not needed.',
    n.kind === 'ebs' ? '- [ ] I created a snapshot if the data might be needed later.' : '- [ ] I know who owns this resource.',
    '- [ ] I am ready to apply the change.',
    '',
    '_CostPilot only opens this pull request. It has no permission to change AWS. Nothing happens until a person merges and applies it._'
  );

  return { branch, path, title, content, body: lines.join('\n') };
}

module.exports = { buildPr, slug, money };
