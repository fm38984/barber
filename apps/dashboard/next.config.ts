import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@barberflow/shared-types'],
};

export default nextConfig;
