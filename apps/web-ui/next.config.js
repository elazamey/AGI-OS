/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: { unoptimized: true },
  basePath: process.env.NODE_ENV === 'production' ? '/agi-system' : '',
  assetPrefix: process.env.NODE_ENV === 'production' ? '/agi-system/' : '',
  reactStrictMode: true,
};

module.exports = nextConfig;
