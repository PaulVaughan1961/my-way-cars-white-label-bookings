import withPWA from "next-pwa";

const isDev = process.env.NODE_ENV === "development";

const nextConfig = withPWA({
dest: "public",
register: true,
importScripts: ["/push-sw.js"],
skipWaiting: true,
disable: isDev,
})({
reactStrictMode: true,
turbopack: {},
});

export default nextConfig;
