import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import Resend from 'next-auth/providers/resend'
import { DrizzleAdapter } from '@auth/drizzle-adapter'
import { db, users } from '@repo/db'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import type { UserRole } from '@repo/types'

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(72),
})

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db),

  providers: [
    Credentials({
      credentials: {
        email: { type: 'email', label: 'Email' },
        password: { type: 'password', label: 'Password' },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials)
        if (!parsed.success) return null

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, parsed.data.email))
          .limit(1)

        if (!user || !user.password_hash) return null

        const valid = await bcrypt.compare(parsed.data.password, user.password_hash)
        if (!valid) return null

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          tenant_id: user.tenant_id,
          location_id: user.location_id ? String(user.location_id) : null,
          facility_id: user.facility_id ? String(user.facility_id) : null,
        }
      },
    }),
    Resend({
      apiKey: process.env.AUTH_RESEND_KEY!,
      from: process.env.AUTH_EMAIL_FROM ?? 'no-reply@courierrecycling.com',
    }),
  ],

  session: {
    strategy: 'jwt',
    maxAge: 7 * 24 * 60 * 60, // 7 days — AUTH-05: covers prison 7-day sessions
  },

  pages: {
    signIn: '/sign-in',
    error: '/auth/error',
  },

  cookies: {
    sessionToken: {
      name: 'authjs.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        // AUTH-06: Leading dot = shared across ALL subdomains
        domain:
          process.env.NODE_ENV === 'production'
            ? (process.env.AUTH_COOKIE_DOMAIN ?? '.courierrecycling.com')
            : undefined, // localhost: no domain restriction
      },
    },
  },

  callbacks: {
    async jwt({ token, user, trigger }) {
      // On initial sign-in, load custom claims from DB user record
      if (user && user.id) {
        const [dbUser] = await db
          .select({
            role: users.role,
            tenant_id: users.tenant_id,
            location_id: users.location_id,
            facility_id: users.facility_id,
          })
          .from(users)
          .where(eq(users.id, user.id))
          .limit(1)

        if (dbUser) {
          token.role = dbUser.role as UserRole
          token.tenant_id = dbUser.tenant_id
          token.location_id = dbUser.location_id
            ? String(dbUser.location_id)
            : null
          token.facility_id = dbUser.facility_id
            ? String(dbUser.facility_id)
            : null
        }
      }

      // On session update trigger, refresh claims from DB
      // This handles AUTH-08 (can_view_financials toggle) taking effect
      if (trigger === 'update' && token.sub) {
        const [dbUser] = await db
          .select({
            role: users.role,
            tenant_id: users.tenant_id,
            location_id: users.location_id,
            facility_id: users.facility_id,
          })
          .from(users)
          .where(eq(users.id, token.sub))
          .limit(1)

        if (dbUser) {
          token.role = dbUser.role as UserRole
          token.tenant_id = dbUser.tenant_id
          token.location_id = dbUser.location_id
            ? String(dbUser.location_id)
            : null
          token.facility_id = dbUser.facility_id
            ? String(dbUser.facility_id)
            : null
        }
      }

      return token
    },

    async session({ session, token }) {
      // Expose JWT claims to server components via auth()
      if (session.user) {
        session.user.id = token.sub!
        session.user.role = token.role as UserRole
        session.user.tenant_id = token.tenant_id as string | null
        session.user.location_id = token.location_id as string | null
        session.user.facility_id = token.facility_id as string | null
      }
      return session
    },

    async signIn({ user }) {
      // Block sign-in for deactivated users (AUTH-09)
      if (user.id) {
        const [dbUser] = await db
          .select({ active: users.active })
          .from(users)
          .where(eq(users.id, user.id))
          .limit(1)

        if (dbUser && !dbUser.active) {
          return false // Reject sign-in
        }
      }
      return true
    },
  },
})
