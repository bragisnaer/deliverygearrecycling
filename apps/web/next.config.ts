import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	transpilePackages: ["@repo/db", "@repo/types"],
	output: "standalone",
};

export default nextConfig;
