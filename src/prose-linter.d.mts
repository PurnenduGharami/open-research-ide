import type { ManuscriptDocument, ProseAuditReport } from "../packages/contracts/index";

export function auditManuscriptProse(manuscript: Pick<ManuscriptDocument, "abstract" | "sections">, options?: { useVale?: boolean; valeConfigPath?: string }): Promise<ProseAuditReport>;
export function humanizeProseText(text: string): string;
