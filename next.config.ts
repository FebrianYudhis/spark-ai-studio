import type { NextConfig } from "next";

// Supresi otomatis ExperimentalWarning untuk node:sqlite di Next.js & worker threads
if (typeof process !== 'undefined') {
  if (!process.env.NODE_OPTIONS || !process.env.NODE_OPTIONS.includes('--no-warnings=ExperimentalWarning')) {
    process.env.NODE_OPTIONS = `${process.env.NODE_OPTIONS || ''} --no-warnings=ExperimentalWarning`.trim();
  }

  if (typeof process.emitWarning === 'function') {
    const originalEmitWarning = process.emitWarning;
    process.emitWarning = function (warning: string | Error, ...args: unknown[]) {
      if (typeof warning === 'string' && warning.includes('SQLite is an experimental feature')) {
        return;
      }
      if (
        typeof warning === 'object' &&
        warning !== null &&
        'name' in warning &&
        warning.name === 'ExperimentalWarning' &&
        'message' in warning &&
        typeof warning.message === 'string' &&
        warning.message.includes('SQLite')
      ) {
        return;
      }
      return Reflect.apply(originalEmitWarning, process, [warning, ...args]);
    };
  }
}

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
