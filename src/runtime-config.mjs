import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const CONFIG_FILENAME = "runtime-config.json";
export const DEFAULT_MODEL = "gemini-2.5-flash";

export const PROVIDER_DEFAULTS = {
  gemini: {
    label: "Google Gemini API",
    defaultModel: "gemini-2.5-flash",
    envKey: "GEMINI_API_KEY",
    fallbackEnvKeys: ["GOOGLE_API_KEY"],
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
  },
  vertex: {
    label: "Google Cloud Vertex AI",
    defaultModel: "gemini-2.5-pro",
    envKey: "VERTEX_API_KEY",
    fallbackEnvKeys: ["GOOGLE_CLOUD_ACCESS_TOKEN"],
    baseUrl: "https://aiplatform.googleapis.com/v1/publishers/google",
  },
  "gemma-local": {
    label: "Local Gemma (Ollama)",
    defaultModel: "gemma3:12b",
    envKey: "",
    fallbackEnvKeys: [],
    baseUrl: "http://127.0.0.1:11434/v1",
  },
  custom: {
    label: "Custom Compatible Endpoint",
    defaultModel: "gemini-2.5-flash",
    envKey: "CUSTOM_API_KEY",
    fallbackEnvKeys: [],
    baseUrl: "http://127.0.0.1:8080/v1",
  },
};

const VALID_PROVIDERS = new Set(Object.keys(PROVIDER_DEFAULTS));

export function runtimeConfigPath(root = process.cwd()) {
  return path.join(root, "workspace", CONFIG_FILENAME);
}

function inferProviderFromModel(model) {
  const value = String(model || "").toLowerCase();
  if (value.startsWith("vertex/")) return "vertex";
  if (value.startsWith("gemma-local/") || value.startsWith("ollama/") || value.includes("gemma")) return "gemma-local";
  if (value.startsWith("custom/")) return "custom";
  return "gemini";
}

function defaultConfigFromEnv() {
  const envModel = String(process.env.RESEARCH_MODEL || DEFAULT_MODEL).trim();
  const envReviewModel = String(process.env.RESEARCH_REVIEW_MODEL || envModel).trim();
  const envOrchProvider = String(process.env.RESEARCH_PROVIDER || "").trim().toLowerCase();
  const envReviewProvider = String(process.env.RESEARCH_REVIEW_PROVIDER || envOrchProvider).trim().toLowerCase();
  const orchestratorProvider = VALID_PROVIDERS.has(envOrchProvider) ? envOrchProvider : inferProviderFromModel(envModel);
  const reviewerProvider = VALID_PROVIDERS.has(envReviewProvider) ? envReviewProvider : inferProviderFromModel(envReviewModel);
  return {
    harness: "standalone",
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
    vertexProject: process.env.GOOGLE_CLOUD_PROJECT || "",
    vertexLocation: process.env.GOOGLE_CLOUD_LOCATION || "us-central1",
    secrets: {},
  };
}

export async function readRuntimeConfig(root = process.cwd()) {
  const base = defaultConfigFromEnv();
  try {
    const raw = JSON.parse(await readFile(runtimeConfigPath(root), "utf8"));
    const orchProvider = VALID_PROVIDERS.has(raw.orchestrator?.provider) ? raw.orchestrator.provider : base.orchestrator.provider;
    const revProvider = VALID_PROVIDERS.has(raw.reviewers?.provider) ? raw.reviewers.provider : base.reviewers.provider;
    return {
      harness: "standalone",
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
      vertexProject: typeof raw.vertexProject === "string" ? raw.vertexProject.trim() : base.vertexProject,
      vertexLocation: typeof raw.vertexLocation === "string" && raw.vertexLocation.trim() ? raw.vertexLocation.trim() : base.vertexLocation,
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
  for (const fallback of spec.fallbackEnvKeys || []) {
    if (process.env[fallback]) return String(process.env[fallback]).trim();
  }
  return "";
}

export function getPublicRuntimeConfig(config) {
  const providersConfigured = {};
  for (const provider of Object.keys(PROVIDER_DEFAULTS)) {
    providersConfigured[provider] = provider === "gemma-local" ? true : Boolean(resolveProviderApiKey(provider, config));
  }
  return {
    harness: "standalone",
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
    vertexProject: config.vertexProject || undefined,
    vertexLocation: config.vertexLocation || undefined,
    providersConfigured,
    hasSemanticScholarKey: Boolean(process.env.SEMANTIC_SCHOLAR_API_KEY || config.secrets?.semanticScholarApiKey),
    hasOpenAlexMailto: Boolean(process.env.OPENALEX_MAILTO || config.secrets?.openAlexMailto),
  };
}

export async function saveRuntimeConfig(root = process.cwd(), patch = {}) {
  const current = await readRuntimeConfig(root);
  const next = structuredClone(current);
  next.harness = "standalone";

  if (typeof patch.vertexProject === "string") next.vertexProject = patch.vertexProject.trim().slice(0, 120);
  if (typeof patch.vertexLocation === "string" && patch.vertexLocation.trim()) {
    next.vertexLocation = patch.vertexLocation.trim().slice(0, 80);
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
    }
  }

  const target = runtimeConfigPath(root);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 });
  try { await chmod(target, 0o600); } catch { /* Windows ignores POSIX chmod. */ }
  return next;
}
