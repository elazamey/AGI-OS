/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    '@agi-os/kernel',
    '@agi-os/governance',
    '@agi-os/memory',
    '@agi-os/self-model',
    '@agi-os/orchestrator',
    '@agi-os/reflection',
    '@agi-os/cognition',
  ],
};

module.exports = nextConfig;
