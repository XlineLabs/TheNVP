/** @type {import('next').NextConfig} */
const nextConfig = {
  // Long-poll routes (GET /api/jobs/next) hold the request up to ~25s.
  // Vercel: bump the function timeout via route segment config (maxDuration).
};

export default nextConfig;
