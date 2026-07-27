/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // This app has its own lockfile inside a yarn monorepo; pin the root so
  // Next does not trace files from an unrelated parent directory.
  outputFileTracingRoot: import.meta.dirname,
  poweredByHeader: false,
  // pg must stay on the server; it is never bundled for the browser.
  serverExternalPackages: ['pg'],
  async headers() {
    const crm = process.env.TWENTY_BASE_URL ?? 'https://crm.xopure.com';

    return [
      {
        source: '/:path*',
        headers: [
          // The app is embedded as a dashboard iframe widget, so exactly one
          // host may frame it.
          { key: 'Content-Security-Policy', value: `frame-ancestors ${crm};` },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'same-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
