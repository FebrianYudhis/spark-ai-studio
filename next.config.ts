import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  allowedDevOrigins: [
    '192.168.*.*',
    '10.*.*.*',
    '172.16.*.*',
    '100.*.*.*',
    '*.local',
    'localhost',
  ],
};

export default nextConfig;
