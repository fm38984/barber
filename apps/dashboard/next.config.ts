import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@barberflow/shared-types'],
};

export default nextConfig;
