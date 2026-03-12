import withPWA from "next-pwa";

const nextConfig = withPWA({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: false,
})({
  reactStrictMode: true,
  turbopack: {},
});

export default nextConfig;