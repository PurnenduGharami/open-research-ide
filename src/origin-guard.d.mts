export function assertSameOriginHeaders(input: {
  origin?: string | null;
  host?: string | null;
  forwardedHost?: string | null;
  forwardedProto?: string | null;
  nextUrlHost?: string | null;
  nextUrlProtocol: string;
}): void;
