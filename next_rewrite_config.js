/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      // Rewrite all requests that don't start with /api to the root
      // This is helpful for supporting client-side routing in a SPA
      {
        source: '/((?!api|_next/static|_next/image|favicon.ico).*)',
        destination: '/',
      },
    ];
  },
};

module.exports = nextConfig;
