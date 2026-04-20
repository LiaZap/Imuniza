/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Only emit standalone bundle inside Docker build; pnpm symlinks break it on Windows.
  output: process.env.NEXT_OUTPUT_STANDALONE === 'true' ? 'standalone' : undefined,
  outputFileTracingRoot: process.env.NEXT_OUTPUT_TRACING_ROOT,
  transpilePackages: ['@imuniza/shared'],
  async rewrites() {
    const apiUrl = process.env.API_BASE_URL ?? 'http://localhost:3001';
    return [{ source: '/api/:path*', destination: `${apiUrl}/:path*` }];
  },
};

export default nextConfig;
