/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: [
    "unpdf",
    "@citation-js/core",
    "@citation-js/plugin-bibtex",
    "@citation-js/plugin-csl",
    "@citation-js/plugin-ris",
  ],
  ...(process.env.NEXT_OUTPUT_STANDALONE === "1" ? { output: "standalone" } : {}),
};

export default nextConfig;
