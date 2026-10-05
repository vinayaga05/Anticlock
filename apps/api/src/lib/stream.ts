import { StreamChat } from 'stream-chat';

const apiKey = process.env.STREAM_API_KEY;
const apiSecret = process.env.STREAM_API_SECRET;

if (!apiKey || !apiSecret) {
  console.warn('STREAM_API_KEY or STREAM_API_SECRET not set. Stream Chat will not be available.');
}

let streamClient: StreamChat | null = null;

export function getStreamClient(): StreamChat {
  if (!apiKey || !apiSecret) {
    throw new Error('Stream Chat is not configured. Set STREAM_API_KEY and STREAM_API_SECRET.');
  }
  
  if (!streamClient) {
    streamClient = StreamChat.getInstance(apiKey, apiSecret);
  }
  
  return streamClient;
}

export function isStreamConfigured(): boolean {
  return !!(apiKey && apiSecret);
}
