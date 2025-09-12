import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Rewrites no longer needed once Next API is active
  async redirects() {
    return [
      {
        source: "/post/:slug",
        destination: "/posts/:slug",
        permanent: true,
      },
      {
        source: "/admin.html",
        destination: "/editor",
        permanent: true,
      },
      {
        source: "/admin",
        destination: "/editor",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
