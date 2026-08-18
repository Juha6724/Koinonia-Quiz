import type { NextConfig } from "next";

const noStoreHeaders = [
  {
    key: "Cache-Control",
    value: "no-cache, no-store, must-revalidate",
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      { source: "/", headers: noStoreHeaders },
      { source: "/admin", headers: noStoreHeaders },
    ];
  },
};

export default nextConfig;
