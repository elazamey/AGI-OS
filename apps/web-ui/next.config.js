/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: { unoptimized: true },
  basePath: process.env.NODE_ENV === 'production' ? '/AGI-OS' : '',
  assetPrefix: process.env.NODE_ENV === 'production' ? '/AGI-OS/' : '',
  reactStrictMode: true,
};

module.exports = nextConfig;
