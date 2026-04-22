import { Resend } from 'resend'
import type React from 'react'

const resend = new Resend(process.env.RESEND_API_KEY)

const FROM_ADDRESS = process.env.RESEND_FROM_ADDRESS ?? 'onboarding@resend.dev'

const isRealKey = process.env.RESEND_API_KEY && !process.env.RESEND_API_KEY.includes('_test_')

export async function sendEmail({
  to,
  subject,
  react,
}: {
  to: string | string[]
  subject: string
  react: React.ReactElement
}) {
  if (!isRealKey) {
    console.log('[email] Skipping send — no real RESEND_API_KEY configured')
    return { success: false, error: 'Email not configured' }
  }
  try {
    const { data, error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to,
      subject,
      react,
    })
    if (error) {
      console.error('[email] Send failed:', error)
      return { success: false, error: error.message }
    }
    return { success: true, id: data?.id }
  } catch (err) {
    console.error('[email] Exception:', err)
    return { success: false, error: String(err) }
  }
}
