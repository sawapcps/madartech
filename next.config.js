/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization, X-API-Key' },
          { key: 'Access-Control-Max-Age', value: '86400' },
        ],
      },
    ];
  },
  // ✅ أضف هذا القسم الجديد
  async redirects() {
    return [
      {
        source: '/api/v1/storage',
        destination: 'https://cloud.madartech.uk/api/v1/storage',
        permanent: false,
      },
    ];
  },
};

module.exports = nextConfig;
