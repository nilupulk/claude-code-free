import { createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  compress: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },

  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60,
  },

  async headers() {
    const securityHeaders = [
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-XSS-Protection", value: "0" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    ];

    return [
      {
        source: "/_next/static/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/fonts/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store" },
          ...securityHeaders,
        ],
      },
      {
        source: "/((?!_next/static|_next/image|fonts).*)",
        headers: securityHeaders,
      },
    ];
  },

  webpack(config, { isServer }) {
    if (!isServer) {
      const platformDir = path.resolve(__dirname, "lib/platform/web");

      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        "fs/promises": false,
        path: false,
        os: false,
        child_process: false,
        crypto: false,
        stream: false,
        buffer: false,
        events: false,
        util: false,
        assert: false,
        http: false,
        https: false,
        net: false,
        tls: false,
        zlib: false,
        readline: false,
        tty: false,
        worker_threads: false,
      };

      config.resolve.alias = {
        ...config.resolve.alias,
        "fs/promises": path.resolve(platformDir, "fs.ts"),
        fs: path.resolve(platformDir, "fs.ts"),
        path: path.resolve(platformDir, "path.ts"),
        os: path.resolve(platformDir, "os.ts"),
        child_process: path.resolve(platformDir, "exec.ts"),
        process: path.resolve(platformDir, "process.ts"),
        ink: path.resolve(__dirname, "lib/ink-compat/index.ts"),
      };
    }

    return config;
  },
};

export default nextConfig;
