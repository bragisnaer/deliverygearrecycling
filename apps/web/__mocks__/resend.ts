// Vitest mock for resend — prevents "Missing API key" error when email.ts is
// imported during unit tests. All tests that exercise real email behaviour
// should override the mock at the test level via vi.mock('resend', ...).
import { vi } from 'vitest'

const mockSend = vi.fn().mockResolvedValue({ data: { id: 'test-email-id' }, error: null })

export const Resend = vi.fn().mockImplementation(() => ({
  emails: { send: mockSend },
}))
