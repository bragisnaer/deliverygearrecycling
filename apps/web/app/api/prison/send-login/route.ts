import { NextRequest, NextResponse } from 'next/server'
import { db, prisonFacilities } from '@repo/db'
import { eq } from 'drizzle-orm'
import { signIn } from '@/auth'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { facility } = body

  if (!facility || typeof facility !== 'string') {
    return NextResponse.json(
      { error: 'Missing facility parameter' },
      { status: 400 }
    )
  }

  // Look up facility by slug (unique text column added in plan 01-02)
  const [fac] = await db
    .select({
      id: prisonFacilities.id,
      name: prisonFacilities.name,
      contact_email: prisonFacilities.contact_email,
      active: prisonFacilities.active,
    })
    .from(prisonFacilities)
    .where(eq(prisonFacilities.slug, facility))
    .limit(1)

  if (!fac) {
    return NextResponse.json(
      { error: 'Facility not found' },
      { status: 404 }
    )
  }

  if (!fac.active) {
    return NextResponse.json(
      { error: 'Facility is inactive' },
      { status: 403 }
    )
  }

  // Trigger Auth.js magic link sign-in to the facility contact email
  try {
    await signIn('resend', {
      email: fac.contact_email,
      redirect: false,
      callbackUrl: '/',
    })
  } catch {
    // signIn may throw a redirect; the magic link email is sent regardless
  }

  return NextResponse.json({ success: true })
}
