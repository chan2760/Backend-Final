/** @type {import('next').NextConfig} */

const nextConfig = {
  // basePath: '/api',
  reactCompiler: true,
  async rewrites() {
    return [
      {
        source: "/api/books",
        destination: "/api/book",
      },
      {
        source: "/api/books/:id",
        destination: "/api/book/:id",
      },
    ];
  },
};

export default nextConfig;
