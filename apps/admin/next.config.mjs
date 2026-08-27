/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@anticlock/contracts'],
  output: 'standalone',
};

export default nextConfig;
