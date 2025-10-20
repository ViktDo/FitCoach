// apps/fitcoach-next/next.config.js
const path = require('path');

/** @type {import('next').NextConfig} */
module.exports = {
  output: 'standalone',
  images: {
    remotePatterns: [{ protocol: 'https', hostname: 's3.beget.com' }],
  },
  webpack: (config) => {
    // Алиас, чтобы '@/...' всегда резолвился в папку 'app'
    config.resolve.alias['@'] = path.resolve(__dirname, 'app');
    return config;
  },
};