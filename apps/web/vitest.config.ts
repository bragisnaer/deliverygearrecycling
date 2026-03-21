import { defineConfig } from 'vitest/config'
import path from 'path'

const webRoot = path.resolve(__dirname, '.')

export default defineConfig({
  resolve: {
    alias: [
      // Most-specific aliases first (Vite applies first match)
      // Mock next/server and next-auth — not available in Vitest's Node environment
      { find: 'next/server', replacement: path.resolve(webRoot, '__mocks__/next-server.ts') },
      { find: 'next-auth', replacement: path.resolve(webRoot, '__mocks__/next-auth.ts') },
      // Mock @/auth — proxy.test.ts only tests getTenantFromHost (pure function)
      { find: '@/auth', replacement: path.resolve(webRoot, '__mocks__/auth.ts') },
      // Mock react-markdown and plugins — ESM-only packages cannot run in Vitest Node env
      { find: 'react-markdown', replacement: path.resolve(webRoot, '__mocks__/react-markdown.ts') },
      { find: 'remark-gfm', replacement: path.resolve(webRoot, '__mocks__/remark-gfm.ts') },
      { find: 'rehype-raw', replacement: path.resolve(webRoot, '__mocks__/rehype-raw.ts') },
      // Generic @ alias for everything else
      { find: '@', replacement: webRoot },
    ],
  },
  test: {
    environment: 'node',
    include: ['**/*.test.ts'],
    exclude: ['node_modules', '.next'],
  },
})
