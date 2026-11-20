import 'dotenv/config';
import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } from '@aws-sdk/client-sqs';

const queueUrl = process.env.SQS_QUEUE_URL;
const client = new SQSClient({ region: process.env.AWS_REGION || 'ap-south-1' });

async function handleMessage(message) {
  // Validate message schema and make handlers idempotent before production.
  console.log('Received job:', message.Body);
}

async function poll() {
  if (!queueUrl) {
    console.log('SQS_QUEUE_URL is empty; worker is idle.');
    return;
  }
  while (true) {
    const result = await client.send(new ReceiveMessageCommand({
      QueueUrl: queueUrl, MaxNumberOfMessages: 5, WaitTimeSeconds: 20, VisibilityTimeout: 60
    }));
    for (const message of result.Messages ?? []) {
      try {
        await handleMessage(message);
        await client.send(new DeleteMessageCommand({
          QueueUrl: queueUrl, ReceiptHandle: message.ReceiptHandle
        }));
      } catch (error) {
        console.error('Job failed; message will become visible after visibility timeout.', error);
      }
    }
  }
}
poll().catch((error) => { console.error(error); process.exit(1); });
