import { PROVIDER_DEFAULTS, resolveProviderApiKey } from "../runtime-config.mjs";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function stripProviderPrefix(provider, model) {
  const clean = String(model || "").trim();
  const prefixes = [`${provider}/`, "google/", "gemini/", "vertex/", "gemma-local/", "ollama/", "custom/"];
  for (const prefix of prefixes) {
    if (clean.toLowerCase().startsWith(prefix)) return clean.slice(prefix.length);
  }
  return clean;
}

export function isRateLimitError(error) {
  const text = String(error?.message || error || "");
  return error?.status === 429 || error?.statusCode === 429 || /(?:\b429\b|rate.?limit|too many requests|resource_exhausted)/i.test(text);
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

async function ensureOk(response) {
  if (response.ok) return response;
  const text = await response.text().catch(() => "");
  const error = new Error(`HTTP ${response.status}: ${text.slice(0, 300)}`);
  error.status = response.status;
  error.retryAfterMs = parseRetryAfterMs(response);
  throw error;
}

export function sanitizeGeminiSchema(schema) {
  if (!schema || typeof schema !== "object") return undefined;
  const out = {};
  if (typeof schema.type === "string") out.type = schema.type;
  if (typeof schema.description === "string") out.description = schema.description;
  if (Array.isArray(schema.enum)) out.enum = schema.enum;
  if (schema.items && typeof schema.items === "object") {
    const cleanItems = sanitizeGeminiSchema(schema.items);
    if (cleanItems) out.items = cleanItems;
  }
  if (schema.properties && typeof schema.properties === "object") {
    const entries = Object.entries(schema.properties)
      .map(([k, v]) => [k, sanitizeGeminiSchema(v)])
      .filter(([, v]) => Boolean(v));
    if (entries.length) out.properties = Object.fromEntries(entries);
    else if (out.type === "object") return undefined;
  } else if (out.type === "object") {
    return undefined;
  }
  if (Array.isArray(schema.required) && schema.required.length && out.properties) {
    out.required = schema.required.filter((name) => name in out.properties);
  }
  return out;
}

function buildGeminiEndpoint({ provider, model, baseUrl, runtimeConfig, streaming = true }) {
  const modelName = stripProviderPrefix(provider, model);
  let rootUrl = (baseUrl || PROVIDER_DEFAULTS[provider]?.baseUrl || PROVIDER_DEFAULTS.gemini.baseUrl).replace(/\/$/, "");
  if (provider === "vertex" && runtimeConfig?.vertexProject && rootUrl === PROVIDER_DEFAULTS.vertex.baseUrl) {
    const loc = encodeURIComponent(runtimeConfig.vertexLocation || "us-central1");
    const proj = encodeURIComponent(runtimeConfig.vertexProject);
    rootUrl = `https://${runtimeConfig.vertexLocation || "us-central1"}-aiplatform.googleapis.com/v1/projects/${proj}/locations/${loc}/publishers/google`;
  }
  const action = streaming ? "streamGenerateContent?alt=sse" : "generateContent";
  return `${rootUrl}/models/${encodeURIComponent(modelName)}:${action}`;
}

function formatGeminiContents(messages) {
  const contents = [];
  for (const msg of messages) {
    if (msg.role === "tool") {
      const responsePart = {
        functionResponse: {
          name: msg.toolName || "tool",
          response: { output: msg.content },
        },
      };
      const prev = contents[contents.length - 1];
      if (prev && prev.role === "user" && prev.parts.every((part) => Boolean(part.functionResponse))) {
        prev.parts.push(responsePart);
      } else {
        contents.push({ role: "user", parts: [responsePart] });
      }
      continue;
    }

    if (msg.role === "assistant") {
      if (Array.isArray(msg.rawParts) && msg.rawParts.length) {
        contents.push({ role: "model", parts: msg.rawParts });
        continue;
      }
      const parts = [];
      if (msg.content) parts.push({ text: msg.content });
      for (const call of msg.toolCalls || []) {
        parts.push({ functionCall: { name: call.name, args: call.arguments || {} } });
      }
      if (parts.length) contents.push({ role: "model", parts });
      continue;
    }

    contents.push({ role: "user", parts: [{ text: String(msg.content || "") }] });
  }
  return contents;
}

function extractGeminiChunkParts(chunk, state) {
  const parts = chunk?.candidates?.[0]?.content?.parts;
  if (Array.isArray(parts)) {
    for (const part of parts) {
      state.rawParts.push(part);
      if (typeof part.text === "string" && !part.thought && part.text) {
        state.textChunks.push(part.text);
        state.onDelta?.(part.text);
      }
      if (part.functionCall) {
        state.toolCalls.push({
          id: `gemini_call_${state.toolCalls.length}_${Date.now()}`,
          name: part.functionCall.name,
          arguments: part.functionCall.args || {},
        });
      }
    }
  }
  if (chunk?.usageMetadata) {
    state.usage = {
      inputTokens: chunk.usageMetadata.promptTokenCount,
      outputTokens: chunk.usageMetadata.candidatesTokenCount,
    };
  }
}

async function readGeminiSse(response, onDelta) {
  const state = { rawParts: [], textChunks: [], toolCalls: [], usage: undefined, onDelta };
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let newlineIndex;
    while ((newlineIndex = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);
      if (!line.startsWith("data:")) continue;
      const dataStr = line.slice(5).trim();
      if (!dataStr || dataStr === "[DONE]") continue;
      try {
        extractGeminiChunkParts(JSON.parse(dataStr), state);
      } catch { /* Ignore partial/keepalive frames. */ }
    }
  }
  if (buffer.trim().startsWith("data:")) {
    const dataStr = buffer.trim().slice(5).trim();
    if (dataStr && dataStr !== "[DONE]") {
      try { extractGeminiChunkParts(JSON.parse(dataStr), state); } catch { /* Ignore trailing incomplete line. */ }
    }
  }
  return { text: state.textChunks.join(""), toolCalls: state.toolCalls, rawParts: state.rawParts, usage: state.usage };
}

async function callGemini({ provider, model, baseUrl, apiKey, runtimeConfig, system, messages, tools, onDelta, signal, fetcher }) {
  const endpoint = buildGeminiEndpoint({ provider, model, baseUrl, runtimeConfig, streaming: true });
  const headers = { "Content-Type": "application/json" };
  if (provider === "vertex" && apiKey.startsWith("ya29.")) {
    headers.Authorization = `Bearer ${apiKey}`;
  } else {
    headers["x-goog-api-key"] = apiKey;
  }

  const functionDeclarations = (tools || []).map((tool) => {
    const cleanParams = sanitizeGeminiSchema(tool.parameters);
    return {
      name: tool.name,
      description: tool.description,
      ...(cleanParams ? { parameters: cleanParams } : {}),
    };
  });

  const body = {
    contents: formatGeminiContents(messages),
    ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
    ...(functionDeclarations.length ? { tools: [{ functionDeclarations }] } : {}),
  };

  const response = await ensureOk(await fetcher(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal,
  }));

  const contentType = String(response.headers?.get?.("content-type") || "").toLowerCase();
  if (contentType.includes("text/event-stream") && response.body?.getReader) {
    return readGeminiSse(response, onDelta);
  }

  const rawText = await response.text();
  const payload = rawText ? JSON.parse(rawText) : {};
  const chunks = Array.isArray(payload) ? payload : [payload];
  const state = { rawParts: [], textChunks: [], toolCalls: [], usage: undefined, onDelta };
  for (const chunk of chunks) extractGeminiChunkParts(chunk, state);
  return { text: state.textChunks.join(""), toolCalls: state.toolCalls, rawParts: state.rawParts, usage: state.usage };
}

async function callCompatibleChat({ provider, model, baseUrl, apiKey, system, messages, tools, onDelta, signal, fetcher }) {
  const endpoint = `${(baseUrl || PROVIDER_DEFAULTS[provider]?.baseUrl || "http://127.0.0.1:11434/v1").replace(/\/$/, "")}/chat/completions`;
  const headers = { "Content-Type": "application/json" };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

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

  const response = await ensureOk(await fetcher(endpoint, { method: "POST", headers, body: JSON.stringify(body), signal }));
  const rawText = await response.text();
  const payload = rawText ? JSON.parse(rawText) : {};
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

export async function invokeModelProvider({ roleConfig, runtimeConfig, system, messages, tools, onDelta, signal, fetch: customFetch }) {
  const fetcher = customFetch || globalThis.fetch;
  const provider = roleConfig.provider || "gemini";
  const apiKey = resolveProviderApiKey(provider, runtimeConfig);
  if (provider !== "gemma-local" && !apiKey) {
    throw new Error(`Missing API key for ${PROVIDER_DEFAULTS[provider]?.label || provider}. Configure it in the Setup modal or .env.`);
  }
  const startedAt = Date.now();
  const args = { provider, model: roleConfig.model, baseUrl: roleConfig.baseUrl, apiKey, runtimeConfig, system, messages, tools, onDelta, signal, fetcher };
  const result = (provider === "gemini" || provider === "vertex")
    ? await callGemini(args)
    : await callCompatibleChat(args);
  return { ...result, durationMs: Date.now() - startedAt };
}

export async function checkProviderHealth(roleConfig, runtimeConfig, options = {}) {
  const fetcher = options.fetch || globalThis.fetch;
  const provider = roleConfig.provider || "gemini";
  const spec = PROVIDER_DEFAULTS[provider];
  const apiKey = resolveProviderApiKey(provider, runtimeConfig);
  if (provider !== "gemma-local" && !apiKey) {
    return { ok: false, detail: `${spec?.label || provider} API key not configured (${spec?.envKey || "key missing"})` };
  }
  if (provider === "gemini" && options.verifyRemote !== false && !process.env.NODE_TEST_CONTEXT) {
    const modelName = stripProviderPrefix("gemini", roleConfig.model);
    const rootUrl = (roleConfig.baseUrl || spec.baseUrl).replace(/\/$/, "");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    try {
      const response = await fetcher(`${rootUrl}/models/${encodeURIComponent(modelName)}`, {
        headers: { "x-goog-api-key": apiKey },
        signal: controller.signal,
      });
      if (!response.ok) return { ok: false, detail: `Google Gemini check failed (HTTP ${response.status}) for ${modelName}` };
      return { ok: true, detail: `Google Gemini ready · ${roleConfig.model}` };
    } catch (error) {
      return { ok: false, detail: `Google Gemini unreachable: ${error?.message || error}` };
    } finally {
      clearTimeout(timer);
    }
  }
  if (provider === "gemma-local") {
    const base = (roleConfig.baseUrl || spec.baseUrl).replace(/\/v1\/?$/, "");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    try {
      const response = await fetcher(`${base}/api/tags`, { signal: controller.signal });
      if (!response.ok) return { ok: false, detail: `Local Gemma (Ollama) unreachable (HTTP ${response.status})` };
      return { ok: true, detail: `Local Gemma (Ollama) reachable · ${roleConfig.model}` };
    } catch (error) {
      return { ok: false, detail: `Local Gemma (Ollama) unreachable at ${base}: ${error?.message || error}` };
    } finally {
      clearTimeout(timer);
    }
  }
  return { ok: true, detail: `${spec?.label || provider} key present · ${roleConfig.model}` };
}
