import { PROVIDER_DEFAULTS, resolveProviderApiKey } from "../runtime-config.mjs";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function stripProviderPrefix(provider, model) {
  const clean = String(model || "").trim();
  const prefixes = [`${provider}/`, "openai/", "google/", "gemini/", "anthropic/", "ollama/"];
  if (provider === "openrouter") return clean.replace(/^openrouter\//i, "");
  for (const prefix of prefixes) {
    if (clean.toLowerCase().startsWith(prefix)) return clean.slice(prefix.length);
  }
  return clean;
}

export function isRateLimitError(error) {
  const text = String(error?.message || error || "");
  return error?.status === 429 || error?.statusCode === 429 || /(?:\b429\b|rate.?limit|too many requests|queue_exceeded)/i.test(text);
}

export function parseRetryAfterMs(headersOrError) {
  const raw = headersOrError?.retryAfterMs ?? headersOrError?.headers?.get?.("retry-after");
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return Math.min(raw, 15000);
  if (typeof raw === "string") {
    const seconds = Number(raw);
    if (Number.isFinite(seconds) && seconds > 0) return Math.min(seconds * 1000, 15000);
    const asDate = Date.parse(raw);
    if (Number.isFinite(asDate) && asDate > Date.now()) return Math.min(asDate - Date.now(), 15000);
  }
  return null;
}

export async function withExponentialBackoff(fn, { maxRetries = 3, baseDelayMs = 1000, onRetry, signal } = {}) {
  let attempt = 0;
  while (true) {
    if (signal?.aborted) throw new Error("Investigation stopped by researcher");
    try {
      return await fn(attempt);
    } catch (error) {
      if (signal?.aborted || !isRateLimitError(error) || attempt >= maxRetries) throw error;
      attempt += 1;
      const retryAfter = parseRetryAfterMs(error);
      const jitter = Math.floor(Math.random() * 400);
      const delayMs = retryAfter ?? Math.min(baseDelayMs * (2 ** (attempt - 1)) + jitter, 15000);
      onRetry?.({ attempt, maxRetries, delayMs, error });
      await sleep(delayMs);
    }
  }
}

async function fetchJsonWithError(url, init, fetcher) {
  const response = await fetcher(url, init);
  const text = await response.text();
  if (!response.ok) {
    const error = new Error(`HTTP ${response.status}: ${text.slice(0, 300)}`);
    error.status = response.status;
    error.retryAfterMs = parseRetryAfterMs(response);
    throw error;
  }
  return text ? JSON.parse(text) : {};
}

async function callOpenAiCompatible({ provider, model, baseUrl, apiKey, system, messages, tools, onDelta, signal, fetcher }) {
  const endpoint = `${(baseUrl || PROVIDER_DEFAULTS[provider]?.baseUrl || "https://api.openai.com/v1").replace(/\/$/, "")}/chat/completions`;
  const headers = { "Content-Type": "application/json" };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  if (provider === "openrouter") {
    headers["HTTP-Referer"] = "http://127.0.0.1:3000";
    headers["X-Title"] = "Open Research IDE";
  }
  const formattedMessages = [];
  if (system) formattedMessages.push({ role: "system", content: system });
  for (const msg of messages) {
    if (msg.role === "tool") {
      formattedMessages.push({ role: "tool", tool_call_id: msg.toolCallId, content: msg.content });
    } else if (msg.toolCalls?.length) {
      formattedMessages.push({
        role: "assistant",
        content: msg.content || "",
        tool_calls: msg.toolCalls.map((call) => ({
          id: call.id,
          type: "function",
          function: { name: call.name, arguments: JSON.stringify(call.arguments || {}) },
        })),
      });
    } else {
      formattedMessages.push({ role: msg.role, content: msg.content });
    }
  }
  const body = {
    model: stripProviderPrefix(provider, model),
    messages: formattedMessages,
    temperature: 0.2,
  };
  if (tools?.length) {
    body.tools = tools.map((tool) => ({
      type: "function",
      function: { name: tool.name, description: tool.description, parameters: tool.parameters },
    }));
    body.tool_choice = "auto";
  }
  const payload = await fetchJsonWithError(endpoint, { method: "POST", headers, body: JSON.stringify(body), signal }, fetcher);
  const choice = payload.choices?.[0]?.message || {};
  const text = typeof choice.content === "string" ? choice.content : "";
  if (text && onDelta) onDelta(text);
  const toolCalls = (choice.tool_calls || []).map((call) => {
    let args = {};
    try { args = JSON.parse(call.function?.arguments || "{}"); } catch { args = {}; }
    return { id: call.id || `call_${Math.random().toString(36).slice(2, 10)}`, name: call.function?.name, arguments: args };
  });
  return {
    text,
    toolCalls,
    usage: payload.usage
      ? { inputTokens: payload.usage.prompt_tokens, outputTokens: payload.usage.completion_tokens }
      : undefined,
  };
}

async function callAnthropic({ model, baseUrl, apiKey, system, messages, tools, onDelta, signal, fetcher }) {
  const endpoint = `${(baseUrl || PROVIDER_DEFAULTS.anthropic.baseUrl).replace(/\/$/, "")}/messages`;
  const formatted = [];
  for (const msg of messages) {
    if (msg.role === "tool") {
      formatted.push({ role: "user", content: [{ type: "tool_result", tool_use_id: msg.toolCallId, content: msg.content }] });
    } else if (msg.toolCalls?.length) {
      const blocks = [];
      if (msg.content) blocks.push({ type: "text", text: msg.content });
      for (const call of msg.toolCalls) {
        blocks.push({ type: "tool_use", id: call.id, name: call.name, input: call.arguments || {} });
      }
      formatted.push({ role: "assistant", content: blocks });
    } else {
      formatted.push({ role: msg.role, content: msg.content });
    }
  }
  const body = {
    model: stripProviderPrefix("anthropic", model),
    max_tokens: 4096,
    ...(system ? { system } : {}),
    messages: formatted,
    ...(tools?.length ? {
      tools: tools.map((tool) => ({ name: tool.name, description: tool.description, input_schema: tool.parameters })),
    } : {}),
  };
  const payload = await fetchJsonWithError(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
    signal,
  }, fetcher);
  const blocks = Array.isArray(payload.content) ? payload.content : [];
  const text = blocks.filter((b) => b.type === "text").map((b) => b.text).join("\n");
  if (text && onDelta) onDelta(text);
  const toolCalls = blocks.filter((b) => b.type === "tool_use").map((b) => ({
    id: b.id,
    name: b.name,
    arguments: b.input || {},
  }));
  return {
    text,
    toolCalls,
    usage: payload.usage
      ? { inputTokens: payload.usage.input_tokens, outputTokens: payload.usage.output_tokens }
      : undefined,
  };
}

async function callGemini({ model, baseUrl, apiKey, system, messages, tools, onDelta, signal, fetcher }) {
  const modelName = stripProviderPrefix("gemini", model);
  const endpoint = `${(baseUrl || PROVIDER_DEFAULTS.gemini.baseUrl).replace(/\/$/, "")}/models/${encodeURIComponent(modelName)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const contents = [];
  for (const msg of messages) {
    if (msg.role === "tool") {
      contents.push({
        role: "user",
        parts: [{ functionResponse: { name: msg.toolName || "tool", response: { content: msg.content } } }],
      });
    } else if (msg.toolCalls?.length) {
      const parts = [];
      if (msg.content) parts.push({ text: msg.content });
      for (const call of msg.toolCalls) {
        parts.push({ functionCall: { name: call.name, args: call.arguments || {} } });
      }
      contents.push({ role: "model", parts });
    } else {
      contents.push({ role: msg.role === "assistant" ? "model" : "user", parts: [{ text: msg.content }] });
    }
  }
  const body = {
    contents,
    ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
    ...(tools?.length ? {
      tools: [{ functionDeclarations: tools.map((tool) => ({ name: tool.name, description: tool.description, parameters: tool.parameters })) }],
    } : {}),
  };
  const payload = await fetchJsonWithError(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  }, fetcher);
  const parts = payload.candidates?.[0]?.content?.parts || [];
  const text = parts.filter((p) => typeof p.text === "string").map((p) => p.text).join("\n");
  if (text && onDelta) onDelta(text);
  const toolCalls = parts.filter((p) => p.functionCall).map((p, idx) => ({
    id: `gemini_call_${idx}_${Date.now()}`,
    name: p.functionCall.name,
    arguments: p.functionCall.args || {},
  }));
  return {
    text,
    toolCalls,
    usage: payload.usageMetadata
      ? { inputTokens: payload.usageMetadata.promptTokenCount, outputTokens: payload.usageMetadata.candidatesTokenCount }
      : undefined,
  };
}

export async function invokeModelProvider({ roleConfig, runtimeConfig, system, messages, tools, onDelta, signal, fetch: customFetch }) {
  const fetcher = customFetch || globalThis.fetch;
  const provider = roleConfig.provider || "cerebras";
  const apiKey = resolveProviderApiKey(provider, runtimeConfig);
  if (provider !== "ollama" && !apiKey) {
    throw new Error(`Missing API key for ${PROVIDER_DEFAULTS[provider]?.label || provider}. Configure it in the Setup modal or .env.`);
  }
  const startedAt = Date.now();
  const args = { provider, model: roleConfig.model, baseUrl: roleConfig.baseUrl, apiKey, system, messages, tools, onDelta, signal, fetcher };
  let result;
  if (provider === "anthropic") result = await callAnthropic(args);
  else if (provider === "gemini") result = await callGemini(args);
  else result = await callOpenAiCompatible(args);
  return { ...result, durationMs: Date.now() - startedAt };
}

export async function checkProviderHealth(roleConfig, runtimeConfig, options = {}) {
  const fetcher = options.fetch || globalThis.fetch;
  const provider = roleConfig.provider || "cerebras";
  const spec = PROVIDER_DEFAULTS[provider];
  const apiKey = resolveProviderApiKey(provider, runtimeConfig);
  if (provider !== "ollama" && !apiKey) {
    return { ok: false, detail: `${spec?.label || provider} API key not configured (${spec?.envKey || "key missing"})` };
  }
  if (provider === "ollama") {
    const base = (roleConfig.baseUrl || spec.baseUrl).replace(/\/v1\/?$/, "");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    try {
      const response = await fetcher(`${base}/api/tags`, { signal: controller.signal });
      if (!response.ok) return { ok: false, detail: `Ollama unreachable (HTTP ${response.status})` };
      return { ok: true, detail: `Ollama reachable · ${roleConfig.model}` };
    } catch (error) {
      return { ok: false, detail: `Ollama unreachable at ${base}: ${error?.message || error}` };
    } finally {
      clearTimeout(timer);
    }
  }
  return { ok: true, detail: `${spec?.label || provider} key present · ${roleConfig.model}` };
}
