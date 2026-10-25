import { StreamChat } from 'stream-chat';
import { StreamClient } from '@stream-io/node-sdk';

let streamClient: StreamChat | null = null;
let streamServerClient: StreamClient | null = null;
let cachedApiKey: string | null = null;

function credentials() {
  return {
    apiKey: process.env.STREAM_API_KEY,
    apiSecret: process.env.STREAM_API_SECRET,
  };
}

export function getStreamClient(): StreamChat {
  const { apiKey, apiSecret } = credentials();
  if (!apiKey || !apiSecret) {
    throw new Error('Stream is not configured. Set STREAM_API_KEY and STREAM_API_SECRET.');
  }
  
  if (!streamClient) {
    streamClient = StreamChat.getInstance(apiKey, apiSecret);
  }
  
  return streamClient;
}

/** Shared server SDK for short-lived user tokens and Stream Video calls. */
export function getStreamServerClient(): StreamClient {
  const { apiKey, apiSecret } = credentials();
  if (!apiKey || !apiSecret) {
    throw new Error('Stream is not configured. Set STREAM_API_KEY and STREAM_API_SECRET.');
  }
  if (!streamServerClient || cachedApiKey !== apiKey) {
    streamServerClient = new StreamClient(apiKey, apiSecret);
    cachedApiKey = apiKey;
  }
  return streamServerClient;
}

export function isStreamConfigured(): boolean {
  const { apiKey, apiSecret } = credentials();
  return Boolean(apiKey && apiSecret);
}
