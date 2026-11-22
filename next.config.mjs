/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["@openclaw/gateway-client", "@openclaw/gateway-protocol", "ws"],
};

export default nextConfig;
