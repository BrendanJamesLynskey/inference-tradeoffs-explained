/**
 * Next.js config.
 *
 * MDX content is loaded at runtime via `next-mdx-remote` (as in
 * transformer-explainer), so we deliberately do NOT use `@next/mdx` for
 * page-level MDX compilation. Every page is statically rendered: there is
 * no database, no auth and no API route.
 *
 * Chapter 5 ("Heterogeneous pools") moved to /learn/05-heterogeneous-pools
 * when the simulator was cut back to serving; other sites link to its old
 * URL, which redirects permanently (308).
 *
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: true,
  },
  async redirects() {
    return [
      {
        source: "/learn/05-heterogeneous-and-optical-pools",
        destination: "/learn/05-heterogeneous-pools",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
