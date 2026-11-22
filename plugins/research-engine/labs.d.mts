export interface DiscoveredLab {
  id: string;
  name: string;
  institution: string;
  url?: string;
  rorUrl?: string;
  pathway: string;
  fit: string;
  contacted: boolean;
  authors: string[];
  paperDois: string[];
  sourceRefs: string[];
  price: { kind: "quoted" | "model-estimated" | "unavailable"; note: string; amount?: number; currency?: string };
}

export function discoverLabsFromDois(
  doisInput: string[],
  options?: { limit?: number; openAlexBaseUrl?: string; timeoutMs?: number; fetch?: typeof fetch },
): Promise<{ retrievedAt: string; works: Array<Record<string, unknown>>; labs: DiscoveredLab[]; sources: Array<Record<string, unknown>> }>;

export function labNodesFromDiscovery(discovery: { labs: DiscoveredLab[] }): Array<{
  id: string;
  type: "lab";
  title: string;
  sourceRefs: string[];
  data: Record<string, unknown>;
}>;
