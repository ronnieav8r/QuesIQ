export function getOpenAiRealtimeApiKey() {
  return process.env.OPENAI_REALTIME_API_KEY || process.env.OPENAI_API_KEY;
}
