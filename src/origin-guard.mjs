const loopbackHost = (host) => /^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(host);

export function assertSameOriginHeaders({ origin, host, forwardedHost, forwardedProto, nextUrlHost, nextUrlProtocol }) {
  if (!origin) return;
  let originUrl;
  try {
    originUrl = new URL(origin);
  } catch {
    throw new Error("Cross-origin mutations are not allowed");
  }
  const fHost = forwardedHost?.split(",")[0]?.trim();
  const fProto = forwardedProto?.split(",")[0]?.trim();
  const requestHosts = [fHost, host, nextUrlHost].filter((value) => Boolean(value));
  const expectedProto = fProto ? `${fProto.replace(/:$/, "")}:` : nextUrlProtocol;
  const sameHost = requestHosts.includes(originUrl.host);
  const loopbackAlias = loopbackHost(originUrl.host) && requestHosts.some(loopbackHost);
  if ((!sameHost && !loopbackAlias) || originUrl.protocol !== expectedProto) {
    throw new Error("Cross-origin mutations are not allowed");
  }
}
