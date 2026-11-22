import type { HarnessType, ProviderType, RoleModelConfig, RuntimeConfigSummary } from "../packages/contracts/index";

export interface RuntimeConfig {
  harness: HarnessType;
  orchestrator: RoleModelConfig;
  reviewers: RoleModelConfig;
  openclawGatewayUrl: string;
  secrets: Record<string, string>;
}

export const DEFAULT_MODEL: string;
export const PROVIDER_DEFAULTS: Record<ProviderType, { label: string; defaultModel: string; envKey: string; baseUrl: string }>;
export function runtimeConfigPath(root?: string): string;
export function readRuntimeConfig(root?: string): Promise<RuntimeConfig>;
export function resolveProviderApiKey(provider: ProviderType, config?: RuntimeConfig): string;
export function getPublicRuntimeConfig(config: RuntimeConfig): RuntimeConfigSummary;
export function saveRuntimeConfig(root?: string, patch?: Record<string, unknown>): Promise<RuntimeConfig>;
