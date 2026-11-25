// Turns one waste finding into a reviewable runbook. Merging the pull request changes nothing in AWS:
// a person follows the steps. The text is built from fixed templates, never from free AI output.
import { httpError } from './ai/errors.js';

export const safeId = (s) => /^[A-Za-z0-9._:-]{1,80}$/.test(String(s || ''));
// Names and tags come from AWS and can contain anything, so keep them to one plain line.
const clean = (s) => String(s ?? '').replace(/[\r\n`<>|]/g, ' ').trim().slice(0, 120);
const usd = (n) => `$${(Number(n) || 0).toFixed(2)}`;

const LABEL = { unattached_ebs: 'Delete unattached disk', unattached_eip: 'Release unused IP address', idle_ec2: 'Stop idle server' };

function steps(rec, region, id) {
  const r = `--region ${region}`;
  if (rec.type === 'unattached_ebs') {
    return {
      check: `aws ec2 describe-volumes --volume-ids ${id} ${r} --query "Volumes[0].[State,Size,VolumeType]"`,
      fix: [
        `aws ec2 create-snapshot --volume-id ${id} ${r} --description "backup before deleting, from CostPilot"`,
        '# Note the SnapshotId from the output, then wait until it is complete:',
        `aws ec2 wait snapshot-completed --snapshot-ids <SnapshotId> ${r}`,
        `aws ec2 delete-volume --volume-id ${id} ${r}`,
      ],
      rollback: `aws ec2 create-volume --snapshot-id <SnapshotId> --availability-zone <zone> ${r}`,
      risk: 'The snapshot keeps a copy of the data, so this is safe to undo.',
    };
  }
  if (rec.type === 'unattached_eip') {
    const flag = id.startsWith('eipalloc-') ? `--allocation-id ${id}` : `--public-ip ${id}`;
    return {
      check: `aws ec2 describe-addresses ${flag} ${r}`,
      fix: [`aws ec2 release-address ${flag} ${r}`],
      rollback: 'None. A released address cannot be got back, so check that no DNS record or firewall rule uses it first.',
      risk: 'Low, but the address itself is lost for good.',
    };
  }
  return {
    check: `aws ec2 describe-instances --instance-ids ${id} ${r} --query "Reservations[0].Instances[0].[State.Name,InstanceType]"`,
    fix: [
      '# Confirm with the owner that nothing needs this server, then stop it (do not terminate):',
      `aws ec2 stop-instances --instance-ids ${id} ${r}`,
    ],
    rollback: `aws ec2 start-instances --instance-ids ${id} ${r}`,
    risk: 'A stopped server keeps its disk, so it can be started again. Disks still cost a little.',
  };
}

export function buildRemediation(rec, now = new Date()) {
  if (!safeId(rec.resourceId)) throw httpError(400, 'This resource id has unusual characters, so no pull request was created.');
  const date = now.toISOString().slice(0, 10);
  const id = rec.resourceId;
  const slug = id.replace(/:/g, '-');
  const region = /^[a-z]{2}(-[a-z]+)+-\d$/.test(rec.region || '') ? rec.region : 'ap-south-1';
  const s = steps(rec, region, id);
  const label = LABEL[rec.type] || 'Review resource';

  const path = `remediation/${date}-${rec.type}-${slug}.md`;
  const branch = `costpilot/fix-${rec.type}-${slug}`;
  const title = `Cost fix: ${label} ${id} (about ${usd(rec.monthlySavings)}/month)`;

  const lines = [
    `# ${label}: ${id}`,
    '',
    `Found by CostPilot on ${date}.`,
    '',
    `- What: ${clean(rec.title)}`,
    `- Region: ${region}`,
    `- Estimated saving: ${usd(rec.monthlySavings)} a month (an estimate)`,
    rec.aiRisk ? `- Risk: ${rec.aiRisk}. Effort: ${rec.aiEffort}.` : null,
    rec.aiReason ? `- Why this order: ${clean(rec.aiReason)}` : null,
    '',
    '## 1. Check it is still unused',
    '```',
    s.check,
    '```',
    '',
    '## 2. Apply the fix',
    '```',
    ...s.fix,
    '```',
    '',
    '## 3. Undo it if something breaks',
    '```',
    s.rollback,
    '```',
    '',
    `Risk note: ${s.risk}`,
    '',
  ].filter((l) => l !== null);

  const body = [
    `CostPilot found **${clean(rec.title)}**, worth about **${usd(rec.monthlySavings)} a month**.`,
    '',
    'This pull request only adds a runbook file. **Merging it does not change AWS.**',
    '',
    '- [ ] I checked that nothing uses this resource',
    '- [ ] I ran the steps in the runbook',
    '- [ ] I checked the next CostPilot scan no longer lists it',
  ].join('\n');

  return { path, branch, title, body, content: lines.join('\n') };
}
