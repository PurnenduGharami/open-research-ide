import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const CONFIG_FILENAME = "runtime-config.json";
export const DEFAULT_MODEL = "cerebras/moonshotai-kimi-k3.1-pro-trial";

export const PROVIDER_DEFAULTS = {
  cerebras: { label: "Cerebras", defaultModel: "cerebras/moonshotai-kimi-k3.1-pro-trial", envKey: "CEREBRAS_API_KEY", baseUrl: "https://api.cerebras.ai/v1" },
  "openai-compatible": { label: "OpenAI / Compatible", defaultModel: "gpt-4.1-mini", envKey: "OPENAI_API_KEY", baseUrl: "https://api.openai.com/v1" },
  anthropic: { label: "Anthropic", defaultModel: "claude-sonnet-4-5", envKey: "ANTHROPIC_API_KEY", baseUrl: "https://api.anthropic.com/v1" },
  gemini: { label: "Google Gemini", defaultModel: "gemini-2.5-flash", envKey: "GEMINI_API_KEY", baseUrl: "https://generativelanguage.googleapis.com/v1beta" },
  openrouter: { label: "OpenRouter", defaultModel: "moonshotai/kimi-k2", envKey: "OPENROUTER_API_KEY", baseUrl: "https://openrouter.ai/api/v1" },
  ollama: { label: "Local Ollama", defaultModel: "qwen2.5:14b", envKey: "", baseUrl: "http://127.0.0.1:11434/v1" },
};

const VALID_PROVIDERS = new Set(Object.keys(PROVIDER_DEFAULTS));
const VALID_HARNESSES = new Set(["openclaw", "standalone"]);

export function runtimeConfigPath(root = process.cwd()) {
  return path.join(root, "workspace", CONFIG_FILENAME);
}

function inferProviderFromModel(model) {
  const value = String(model || "").toLowerCase();
  if (value.startsWith("cerebras/")) return "cerebras";
  if (value.startsWith("anthropic/") || value.includes("claude")) return "anthropic";
  if (value.startsWith("gemini/") || value.startsWith("google/") || value.includes("gemini")) return "gemini";
  if (value.startsWith("openrouter/")) return "openrouter";
  if (value.startsWith("ollama/")) return "ollama";
  if (value.startsWith("openai/") || value.startsWith("gpt-")) return "openai-compatible";
  return "cerebras";
}

function defaultConfigFromEnv() {
  const envHarness = String(process.env.RESEARCH_HARNESS || "").trim().toLowerCase();
  const envModel = String(process.env.RESEARCH_MODEL || DEFAULT_MODEL).trim();
  const envReviewModel = String(process.env.RESEARCH_REVIEW_MODEL || envModel).trim();
  const envOrchProvider = String(process.env.RESEARCH_PROVIDER || "").trim().toLowerCase();
  const envReviewProvider = String(process.env.RESEARCH_REVIEW_PROVIDER || envOrchProvider).trim().toLowerCase();
  const harness = VALID_HARNESSES.has(envHarness) ? envHarness : "openclaw";
  const orchestratorProvider = VALID_PROVIDERS.has(envOrchProvider) ? envOrchProvider : inferProviderFromModel(envModel);
  const reviewerProvider = VALID_PROVIDERS.has(envReviewProvider) ? envReviewProvider : inferProviderFromModel(envReviewModel);
  return {
    harness,
    orchestrator: {
      provider: orchestratorProvider,
      model: envModel,
      baseUrl: process.env.RESEARCH_BASE_URL || PROVIDER_DEFAULTS[orchestratorProvider].baseUrl,
    },
    reviewers: {
      provider: reviewerProvider,
      model: envReviewModel,
      baseUrl: process.env.RESEARCH_REVIEW_BASE_URL || PROVIDER_DEFAULTS[reviewerProvider].baseUrl,
    },
    openclawGatewayUrl: process.env.OPENCLAW_GATEWAY_URL || "ws://127.0.0.1:18789",
    secrets: {},
  };
}

export async function readRuntimeConfig(root = process.cwd()) {
  const base = defaultConfigFromEnv();
  try {
    const raw = JSON.parse(await readFile(runtimeConfigPath(root), "utf8"));
    const harness = VALID_HARNESSES.has(raw.harness) ? raw.harness : base.harness;
    const orchProvider = VALID_PROVIDERS.has(raw.orchestrator?.provider) ? raw.orchestrator.provider : base.orchestrator.provider;
    const revProvider = VALID_PROVIDERS.has(raw.reviewers?.provider) ? raw.reviewers.provider : base.reviewers.provider;
    return {
      harness,
      orchestrator: {
        provider: orchProvider,
        model: typeof raw.orchestrator?.model === "string" && raw.orchestrator.model.trim() ? raw.orchestrator.model.trim() : PROVIDER_DEFAULTS[orchProvider].defaultModel,
        baseUrl: typeof raw.orchestrator?.baseUrl === "string" && raw.orchestrator.baseUrl.trim() ? raw.orchestrator.baseUrl.trim() : PROVIDER_DEFAULTS[orchProvider].baseUrl,
      },
      reviewers: {
        provider: revProvider,
        model: typeof raw.reviewers?.model === "string" && raw.reviewers.model.trim() ? raw.reviewers.model.trim() : PROVIDER_DEFAULTS[revProvider].defaultModel,
        baseUrl: typeof raw.reviewers?.baseUrl === "string" && raw.reviewers.baseUrl.trim() ? raw.reviewers.baseUrl.trim() : PROVIDER_DEFAULTS[revProvider].baseUrl,
      },
      openclawGatewayUrl: typeof raw.openclawGatewayUrl === "string" && raw.openclawGatewayUrl.trim() ? raw.openclawGatewayUrl.trim() : base.openclawGatewayUrl,
      secrets: raw.secrets && typeof raw.secrets === "object" ? raw.secrets : {},
    };
  } catch (error) {
    if (error?.code === "ENOENT") return base;
    throw error;
  }
}

export function resolveProviderApiKey(provider, config) {
  const spec = PROVIDER_DEFAULTS[provider];
  if (!spec) return "";
  const stored = config?.secrets?.[provider];
  if (typeof stored === "string" && stored.trim()) return stored.trim();
  if (spec.envKey && process.env[spec.envKey]) return String(process.env[spec.envKey]).trim();
  return "";
}

export function getPublicRuntimeConfig(config) {
  const providersConfigured = {};
  for (const provider of Object.keys(PROVIDER_DEFAULTS)) {
    providersConfigured[provider] = provider === "ollama" ? true : Boolean(resolveProviderApiKey(provider, config));
  }
  return {
    harness: config.harness,
    orchestrator: {
      provider: config.orchestrator.provider,
      model: config.orchestrator.model,
      baseUrl: config.orchestrator.baseUrl,
    },
    reviewers: {
      provider: config.reviewers.provider,
      model: config.reviewers.model,
      baseUrl: config.reviewers.baseUrl,
    },
    openclawGatewayUrl: config.openclawGatewayUrl,
    hasGatewayToken: Boolean(process.env.OPENCLAW_GATEWAY_TOKEN || config.secrets?.openclawGatewayToken),
    providersConfigured,
    hasSemanticScholarKey: Boolean(process.env.SEMANTIC_SCHOLAR_API_KEY || config.secrets?.semanticScholarApiKey),
    hasOpenAlexMailto: Boolean(process.env.OPENALEX_MAILTO || config.secrets?.openAlexMailto),
  };
}

export async function saveRuntimeConfig(root = process.cwd(), patch = {}) {
  const current = await readRuntimeConfig(root);
  const next = structuredClone(current);

  if (patch.harness && VALID_HARNESSES.has(patch.harness)) {
    next.harness = patch.harness;
  }
  if (patch.openclawGatewayUrl && typeof patch.openclawGatewayUrl === "string") {
    const trimmed = patch.openclawGatewayUrl.trim();
    if (/^wss?:\/\//i.test(trimmed)) next.openclawGatewayUrl = trimmed;
  }
  for (const role of ["orchestrator", "reviewers"]) {
    const incoming = patch[role];
    if (!incoming || typeof incoming !== "object") continue;
    const provider = VALID_PROVIDERS.has(incoming.provider) ? incoming.provider : next[role].provider;
    next[role] = {
      provider,
      model: typeof incoming.model === "string" && incoming.model.trim() ? incoming.model.trim().slice(0, 160) : PROVIDER_DEFAULTS[provider].defaultModel,
      baseUrl: typeof incoming.baseUrl === "string" && incoming.baseUrl.trim() ? incoming.baseUrl.trim().slice(0, 300) : PROVIDER_DEFAULTS[provider].baseUrl,
    };
  }
  if (patch.secrets && typeof patch.secrets === "object") {
    next.secrets = { ...(next.secrets || {}) };
    for (const [key, value] of Object.entries(patch.secrets)) {
      if (typeof value !== "string") continue;
      const trimmed = value.trim();
      if (!trimmed) continue;
      next.secrets[key] = trimmed;
      if (key === "semanticScholarApiKey") process.env.SEMANTIC_SCHOLAR_API_KEY = trimmed;
      if (key === "openAlexMailto") process.env.OPENALEX_MAILTO = trimmed;
      if (key === "openclawGatewayToken") process.env.OPENCLAW_GATEWAY_TOKEN = trimmed;
    }
  }

  const target = runtimeConfigPath(root);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 });
  try { await chmod(target, 0o600); } catch { /* Windows ignores POSIX chmod. */ }
  return next;
}
