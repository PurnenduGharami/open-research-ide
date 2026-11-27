import type { ResearchProject } from "../packages/contracts/index";

export function importProjectBundle(root: string, bufferOrString: Buffer | Uint8Array | string): Promise<{
  project: ResearchProject;
  filesRestored: number;
  hasRoCrate: boolean;
  verification: {
    total: number;
    verified: number;
    failed: Array<{ nodeId: string; reason: string }>;
  };
}>;
