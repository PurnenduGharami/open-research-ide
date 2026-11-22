export function searchLiterature(query: string, options?: { fetch?: typeof fetch; limit?: number }): Promise<any>;
export function literatureNodes(result: any): { nodes: any[]; edges: any[]; sources: any[] };
