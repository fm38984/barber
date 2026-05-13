/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@barberflow/shared-types'],
};

export default nextConfig;
