/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  turbopack: { root: process.cwd() },
  agentRules: false,
};

export default nextConfig;
