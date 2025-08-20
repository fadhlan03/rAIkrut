import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  /**
   * By default, React-PDF (via pdfjs-dist) conditionally requires the native
   * "canvas" package when it detects a Node environment. Turbopack/webpack
   * cannot statically evaluate this check and therefore tries to bundle the
   * native module for the browser bundle, leading to:
   *   Module not found: Can't resolve '../build/Release/canvas.node'
   *
   * We explicitly alias the module to `false` for client-side builds so it is
   * treated as an empty module, while still allowing it to resolve on the
   * server if ever needed.
   */
  webpack: (config) => {
    // Prevent bundling native "canvas" module on both server and client.
    config.resolve.alias = {
      ...config.resolve.alias,
      canvas: false,
    };

    config.resolve.fallback = {
      ...config.resolve.fallback,
      canvas: false,
    };

    return config;
  },
  // Ensure Turbopack (used by `next dev --turbopack`) also ignores the native "canvas" module
  turbopack: {
    resolveAlias: {
      // Point "canvas" to an empty shim so Turbopack never tries to load the native module
      canvas: './canvas-empty-shim.js',
    },
  },
};

export default nextConfig;
