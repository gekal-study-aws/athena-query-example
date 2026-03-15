import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'export',
  // Static export does not support rewrites.
  // We need to use full URLs for API calls in the frontend code.
};

export default nextConfig;
