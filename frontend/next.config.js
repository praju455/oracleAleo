/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@demox-labs/aleo-wallet-adapter-base",
    "@demox-labs/aleo-wallet-adapter-leo",
    "@demox-labs/aleo-wallet-adapter-react",
    "@demox-labs/aleo-wallet-adapter-reactui",
    "aleo-adapters",
  ],
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };
    return config;
  },
};

module.exports = nextConfig;
