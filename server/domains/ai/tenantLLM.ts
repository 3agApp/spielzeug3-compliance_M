/**
 * server/domains/ai/tenantLLM.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Tenant-aware LLM invocation layer.
 *
 * Rules:
 *  - The tenant MUST have configured an AI provider + API key in system_settings.
 *  - If no key is configured, ALL AI features throw PRECONDITION_FAILED.
 *  - Supported providers: openai (GPT-4o), anthropic (Claude 3.5 Sonnet), gemini (Gemini 1.5 Pro)
 *  - The built-in Manus Forge key is NEVER used for tenant AI analysis.
 */

import { getSystemSetting } from "../../db";
import { TRPCError } from "@trpc/server";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AIProvider = "openai" | "anthropic" | "gemini";

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMResponseFormat {
  type: "json_schema" | "json_object" | "text";
  json_schema?: {
    name: string;
    strict?: boolean;
    schema: Record<string, unknown>;
  };
}

export interface TenantLLMParams {
  messages: LLMMessage[];
  response_format?: LLMResponseFormat;
  maxTokens?: number;
}

export interface TenantLLMResult {
  content: string;
  provider: AIProvider;
  model: string;
}

export interface TenantAIConfig {
  provider: AIProvider;
  apiKey: string;
  model: string;
  configured: true;
}

export interface TenantAIConfigMissing {
  configured: false;
}

// ─── Config loader ────────────────────────────────────────────────────────────

export async function getTenantAIConfig(): Promise<TenantAIConfig | TenantAIConfigMissing> {
  const [providerSetting, keySetting, modelSetting] = await Promise.all([
    getSystemSetting("ai_provider"),
    getSystemSetting("ai_api_key"),
    getSystemSetting("ai_model"),
  ]);

  const provider = (providerSetting?.settingValue ?? "").trim() as AIProvider;
  const apiKey = (keySetting?.settingValue ?? "").trim();

  if (!provider || !apiKey || !["openai", "anthropic", "gemini"].includes(provider)) {
    return { configured: false };
  }

  // Use saved model or fall back to provider default
  const savedModel = (modelSetting?.settingValue ?? "").trim();
  const model = savedModel && PROVIDER_MODELS[provider]?.includes(savedModel)
    ? savedModel
    : PROVIDER_MODELS[provider][0];

  return { configured: true, provider, apiKey, model };
}

/**
 * Assert that the tenant has a valid AI config – throws PRECONDITION_FAILED if not.
 */
export async function requireTenantAIConfig(): Promise<TenantAIConfig> {
  const config = await getTenantAIConfig();
  if (!config.configured) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "AI features require an API key. Please configure your AI provider and API key in Settings → AI.",
    });
  }
  return config;
}

// ─── Provider adapters ────────────────────────────────────────────────────────

// All available models per provider (first entry = default)
export const PROVIDER_MODELS: Record<AIProvider, string[]> = {
  openai: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"],
  anthropic: ["claude-3-5-sonnet-20241022", "claude-3-haiku-20240307", "claude-3-opus-20240229"],
  gemini: ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-2.0-flash"],
};

// Human-readable model labels
export const MODEL_LABELS: Record<string, string> = {
  "gpt-4o": "GPT-4o (Recommended)",
  "gpt-4o-mini": "GPT-4o mini (Faster & cheaper)",
  "gpt-4-turbo": "GPT-4 Turbo",
  "gpt-3.5-turbo": "GPT-3.5 Turbo (Budget)",
  "claude-3-5-sonnet-20241022": "Claude 3.5 Sonnet (Recommended)",
  "claude-3-haiku-20240307": "Claude 3 Haiku (Fast & cheap)",
  "claude-3-opus-20240229": "Claude 3 Opus (Most capable)",
  "gemini-1.5-pro": "Gemini 1.5 Pro (Recommended)",
  "gemini-1.5-flash": "Gemini 1.5 Flash (Fast & cheap)",
  "gemini-2.0-flash": "Gemini 2.0 Flash (Latest)",
};

async function invokeOpenAI(
  apiKey: string,
  model: string,
  messages: LLMMessage[],
  responseFormat?: LLMResponseFormat,
  maxTokens = 8192
): Promise<string> {
  const payload: Record<string, unknown> = {
    model,
    messages,
    max_tokens: maxTokens,
  };

  if (responseFormat) {
    payload.response_format = responseFormat;
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(120_000),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${err}`);
  }

  const data = await response.json() as any;
  return data.choices?.[0]?.message?.content ?? "";
}

async function invokeAnthropic(
  apiKey: string,
  model: string,
  messages: LLMMessage[],
  responseFormat?: LLMResponseFormat,
  maxTokens = 8192
): Promise<string> {
  // Anthropic uses system messages separately
  const systemMsg = messages.find((m) => m.role === "system")?.content ?? "";
  const userMessages = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role, content: m.content }));

  // For JSON output, add instruction to system prompt
  let systemContent = systemMsg;
  if (responseFormat?.type === "json_schema" || responseFormat?.type === "json_object") {
    systemContent += "\n\nRespond ONLY with valid JSON, no markdown code blocks, no extra text.";
    if (responseFormat.json_schema?.schema) {
      systemContent += `\nSchema: ${JSON.stringify(responseFormat.json_schema.schema)}`;
    }
  }

  const payload: Record<string, unknown> = {
    model,
    max_tokens: maxTokens,
    messages: userMessages,
  };

  if (systemContent) {
    payload.system = systemContent;
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(120_000),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${err}`);
  }

  const data = await response.json() as any;
  const raw = data.content?.[0]?.text ?? "";

  // Strip markdown code fences if present
  return raw.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();
}

async function invokeGemini(
  apiKey: string,
  model: string,
  messages: LLMMessage[],
  responseFormat?: LLMResponseFormat,
  maxTokens = 8192
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  // Convert messages to Gemini format
  const systemMsg = messages.find((m) => m.role === "system")?.content ?? "";
  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

  const generationConfig: Record<string, unknown> = {
    maxOutputTokens: maxTokens,
    temperature: 0.1,
  };

  if (responseFormat?.type === "json_schema" || responseFormat?.type === "json_object") {
    generationConfig.responseMimeType = "application/json";
  }

  const payload: Record<string, unknown> = {
    contents,
    generationConfig,
  };

  if (systemMsg) {
    payload.systemInstruction = { parts: [{ text: systemMsg }] };
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(120_000),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${err}`);
  }

  const data = await response.json() as any;
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

// ─── Main invocation function ─────────────────────────────────────────────────

/**
 * Invoke the tenant's configured LLM provider.
 * Throws PRECONDITION_FAILED if no API key is configured.
 */
export async function invokeTenantLLM(params: TenantLLMParams): Promise<TenantLLMResult> {
  const config = await requireTenantAIConfig();

  const { messages, response_format, maxTokens = 8192 } = params;

  let content: string;

  switch (config.provider) {
    case "openai":
      content = await invokeOpenAI(config.apiKey, config.model, messages, response_format, maxTokens);
      break;
    case "anthropic":
      content = await invokeAnthropic(config.apiKey, config.model, messages, response_format, maxTokens);
      break;
    case "gemini":
      content = await invokeGemini(config.apiKey, config.model, messages, response_format, maxTokens);
      break;
    default:
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: `Unknown AI provider: ${config.provider}. Supported: openai, anthropic, gemini.`,
      });
  }

  return {
    content,
    provider: config.provider,
    model: config.model,
  };
}

/**
 * Test the tenant's configured AI key with a minimal request.
 * Returns success/failure with model info.
 */
export async function testTenantAIKey(): Promise<{
  success: boolean;
  provider: AIProvider;
  model: string;
  reply: string;
  error?: string;
}> {
  const config = await requireTenantAIConfig();

  try {
    const result = await invokeTenantLLM({
      messages: [{ role: "user", content: "Reply with exactly: OK" }],
    });

    return {
      success: true,
      provider: config.provider,
      model: result.model,
      reply: result.content,
    };
  } catch (err) {
    return {
      success: false,
      provider: config.provider,
      model: config.model,
      reply: "",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
