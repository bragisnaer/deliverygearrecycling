import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin'
import path from 'path'

const withNextIntl = createNextIntlPlugin('./i18n/request.ts')

const nextConfig: NextConfig = {
	transpilePackages: ["@repo/db", "@repo/types"],
	output: "standalone",
	serverExternalPackages: ['@react-pdf/renderer', 'postgres'],
	turbopack: {
		root: path.resolve(__dirname, '../..'),
	},
};

export default withNextIntl(nextConfig);
