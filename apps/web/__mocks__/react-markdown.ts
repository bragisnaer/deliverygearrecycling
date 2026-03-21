// ESM mock for react-markdown — Vitest cannot import the ESM-only package in Node env
import React from 'react'

export default function ReactMarkdown({ children }: { children?: string }) {
  return React.createElement('div', { 'data-testid': 'mock-markdown' }, children)
}
