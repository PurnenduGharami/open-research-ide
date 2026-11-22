export function gatewayEvents(): import("node:events").EventEmitter;
export function setGatewayClientFactory(factory?: (options: any) => any): void;
export function getGateway(): Promise<any>;
export function preflight(): Promise<{ ok: boolean; gateway: string; protocol: number; cerebrasModel: string; researchAgent: string; reviewers: Array<{ id: string; status: string }>; providerConfigured: boolean; note: string }>;
export function sendTurn(options: { sessionKey: string; agentId: string; message: string; idempotencyKey?: string; onDelta?: (delta: string, payload: any) => void }): Promise<{ runId: string; text: string; message: any; usage: any; durationMs: number }>;
export function closeGateway(): Promise<void>;
