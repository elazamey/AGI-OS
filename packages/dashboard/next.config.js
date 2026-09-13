/** @type {import('next').NextConfig} */
const nextConfig = {
  // The workspace lints once at the root (`pnpm lint` in CI). Re-running ESLint
  // inside `next build` duplicates that and fails on the missing next plugin.
  eslint: { ignoreDuringBuilds: true },
  // Type errors must still fail the build.
  typescript: { ignoreBuildErrors: false },
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
