type OpenAiProduct = "dpe" | "interview" | "study" | "support";

export function getOpenAiApiKey(product: OpenAiProduct = "interview") {
  if (product === "support") {
    return process.env.OPENAI_QUIRA_API_KEY || process.env.OPENAI_SUPPORT_API_KEY || process.env.OPENAI_API_KEY;
  }

  if (product === "study") {
    return process.env.OPENAI_STUDY_API_KEY || process.env.OPENAI_API_KEY;
  }

  if (product === "dpe") {
    return process.env.OPENAI_DPE_API_KEY || process.env.OPENAI_API_KEY;
  }

  return process.env.OPENAI_INTERVIEW_API_KEY || process.env.OPENAI_API_KEY;
}

export function getOpenAiInterviewTestTunnelApiKey() {
  const source = getOpenAiInterviewTestTunnelApiKeySource();
  return source ? process.env[source] : undefined;
}

export function getOpenAiInterviewTestTunnelApiKeySource() {
  const sources = [
    "OPENAI_INTERVIEW_TEST_TUNNEL_API_KEY",
    "OPENAI_INTERVIEW_REALTIME_API_KEY",
    "OPENAI_INTERVIEW_API_KEY",
    "OPENAI_REALTIME_API_KEY",
    "OPENAI_API_KEY",
  ];

  return sources.find((source) => process.env[source]?.trim());
}

export function getOpenAiRealtimeApiKey(product: OpenAiProduct = "interview") {
  if (product === "study") {
    return (
      process.env.OPENAI_STUDY_REALTIME_API_KEY ||
      process.env.OPENAI_STUDY_API_KEY ||
      process.env.OPENAI_REALTIME_API_KEY ||
      process.env.OPENAI_API_KEY
    );
  }

  if (product === "dpe") {
    return (
      process.env.OPENAI_DPE_REALTIME_API_KEY ||
      process.env.OPENAI_DPE_API_KEY ||
      process.env.OPENAI_REALTIME_API_KEY ||
      process.env.OPENAI_API_KEY
    );
  }

  return (
    process.env.OPENAI_INTERVIEW_REALTIME_API_KEY ||
    process.env.OPENAI_INTERVIEW_API_KEY ||
    process.env.OPENAI_REALTIME_API_KEY ||
    process.env.OPENAI_API_KEY
  );
}
