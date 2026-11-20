import { CostExplorerClient } from '@aws-sdk/client-cost-explorer';
import { env } from './env.js';

export const costExplorer = new CostExplorerClient({ region: env.AWS_REGION });
