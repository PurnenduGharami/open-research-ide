import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import { GatewayClient, getGatewaySessionMessageSubscriptionCoordinator } from "@openclaw/gateway-client";
import { PROTOCOL_VERSION } from "@openclaw/gateway-protocol/version";

const emitter = new EventEmitter();
emitter.setMaxListeners(100);
let clientPromise;
let client;
let clientFactory = (options) => new GatewayClient(options);

export function gatewayEvents() { return emitter; }
export function setGatewayClientFactory(factory) {
  if (clientPromise) throw new Error("Close the Gateway before replacing its client factory");
  clientFactory = factory || ((options) => new GatewayClient(options));
}

export async function getGateway() {
  if (clientPromise) return clientPromise;
  if (!process.env.OPENCLAW_GATEWAY_TOKEN) throw new Error("OpenClaw Gateway token is not configured. Run ./setup.sh");
  clientPromise = new Promise((resolve, reject) => {
    const url = process.env.OPENCLAW_GATEWAY_URL || "ws://127.0.0.1:18789";
    const token = process.env.OPENCLAW_GATEWAY_TOKEN;
    let settled = false;
    const connected = clientFactory({
      url, token, minProtocol: PROTOCOL_VERSION, maxProtocol: PROTOCOL_VERSION,
      clientDisplayName: "Open Research IDE", clientVersion: "0.1.0",
      role: "operator", scopes: ["operator.read", "operator.write"],
      caps: ["tool-events", "chat-only-assistant-text", "session-scoped-events"],
      requestTimeoutMs: 30000,
      onHelloOk: () => { client = connected; settled = true; resolve(connected); },
      onConnectError: (error) => { if (!settled) { clientPromise = undefined; reject(error); } emitter.emit("connection", { status: "error", message: error.message }); },
      onClose: (_code, reason) => {
        if (client === connected) { client = undefined; clientPromise = undefined; }
        emitter.emit("connection", { status: "closed", message: reason });
      },
      onEvent: (event) => emitter.emit("gateway", event),
    });
    connected.start();
  });
  return clientPromise;
}

export async function preflight() {
  const gateway = await getGateway();
  const [status, agents, modelPayload] = await Promise.all([
    gateway.request("status", {}),
    gateway.request("agents.list", {}),
    gateway.request("models.list", { view: "configured" }),
  ]);
  const modelRows = Array.isArray(modelPayload) ? modelPayload : modelPayload.models || modelPayload.data || modelPayload.entries || [];
  const models = modelRows.flatMap((row) => {
    if (typeof row === "string") return [row];
    const id = row.id || row.model || row.name;
    return id ? [id, ...(row.provider ? [`${row.provider}/${id}`] : [])] : [];
  });
  const target = process.env.RESEARCH_MODEL || "cerebras/moonshotai-kimi-k3.1-pro-trial";
  const agentRows = Array.isArray(agents) ? agents : agents.agents || agents.entries || [];
  const modelRow = modelRows.find((row) => {
    if (typeof row === "string") return row === target;
    const id = row.id || row.model || row.name;
    return id === target || `${row.provider}/${id}` === target;
  });
  const modelAvailable = models.includes(target) && modelRow?.available !== false;
  const research = agentRows.find((agent) => agent.id === "research");
  const reviewers = ["research-auditor", "research-critic", "research-feasibility"].map((id) => ({
    id, status: agentRows.some((agent) => agent.id === id) ? "configured" : "missing",
  }));
  return {
    ok: Boolean(research) && reviewers.every((agent) => agent.status === "configured") && modelAvailable,
    gateway: "connected", protocol: PROTOCOL_VERSION,
    cerebrasModel: modelAvailable ? target : models.includes(target) ? "configured but unavailable" : "not advertised",
    researchAgent: research ? "configured" : "missing",
    reviewers,
    providerConfigured: Boolean(status),
    note: "Non-generative check: no research session or model request was created.",
  };
}

const contentText = (message) => {
  if (!message) return "";
  if (typeof message === "string") return message;
  if (typeof message.text === "string") return message.text;
  const content = message.content || message.message?.content || [];
  if (typeof content === "string") return content;
  return content.filter((item) => item.type === "text").map((item) => item.text || "").join("\n");
};

export async function sendTurn({ sessionKey, agentId, message, idempotencyKey = randomUUID(), onDelta }) {
  const gateway = await getGateway();
  const subscriptions = getGatewaySessionMessageSubscriptionCoordinator(gateway);
  const subscription = await subscriptions.acquire(sessionKey, { agentId });
  return new Promise((resolve, reject) => {
    let ack;
    let settled = false;
    const pendingTerminals = new Map();
    const startedAt = Date.now();
    const cleanup = () => {
      clearTimeout(timer);
      emitter.off("gateway", listener);
      void subscriptions.release(subscription).catch(() => {});
    };
    const finishResolve = (payload) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve({ runId: ack.runId || idempotencyKey, text: contentText(payload.message), message: payload.message, usage: payload.message?.usage || payload.usage, durationMs: Date.now() - startedAt });
    };
    const finishReject = (error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };
    const finishTerminal = (payload) => {
      if (payload.state === "final") finishResolve(payload);
      else finishReject(new Error(payload.errorMessage || `Research run ${payload.state}`));
    };
    const listener = (event) => {
      if (event.event !== "chat") return;
      const payload = event.payload || {};
      if (payload.sessionKey && payload.sessionKey !== sessionKey) return;
      if (payload.runId && ack?.runId && payload.runId !== ack.runId) return;
      if (payload.state === "delta") onDelta?.(payload.deltaText || "", payload);
      if (["final", "error", "aborted"].includes(payload.state)) {
        if (!ack) pendingTerminals.set(payload.runId || "", payload);
        else finishTerminal(payload);
      }
    };
    const timer = setTimeout(() => finishReject(new Error("Research run exceeded 10 minutes; it may still be active in OpenClaw")), 600000);
    emitter.on("gateway", listener);
    gateway.request("chat.send", { sessionKey, agentId, message, idempotencyKey, timeoutMs: 600000 }).then((response) => {
      if (settled) return;
      ack = response || {};
      const runId = ack.runId || idempotencyKey;
      gatewayEvents().emit("run", { sessionKey, runId, status: "running", startedAt });
      const pending = pendingTerminals.get(ack.runId || "") || pendingTerminals.get("");
      if (pending) finishTerminal(pending);
    }, finishReject);
  });
}

export async function closeGateway() { if (client) await client.stopAndWait({ timeoutMs: 3000 }); client = undefined; clientPromise = undefined; }
