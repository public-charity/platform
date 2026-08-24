/**
 * Magic-link auth. No passwords — charity staff are not technical, and
 * password resets are the largest support burden on tools like this.
 *
 * Raw tokens exist only in the email link; the database stores sha256 hashes.
 */
import { createHash, randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'
import { prisma } from './db'

const SESSION_COOKIE = 'pc_session'
const SESSION_TTL_DAYS = 30
const LOGIN_TOKEN_TTL_MIN = 15

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')

export async function createLoginToken(email: string): Promise<string> {
  const normalised = email.trim().toLowerCase()
  const user = await prisma.user.upsert({
    where: { email: normalised },
    create: { email: normalised },
    update: {},
  })
  const raw = randomBytes(32).toString('base64url')
  await prisma.loginToken.create({
    data: {
      userId: user.id,
      tokenHash: sha256(raw),
      expiresAt: new Date(Date.now() + LOGIN_TOKEN_TTL_MIN * 60_000),
    },
  })
  return raw
}

/** Exchange a login token for a session. Single-use, time-limited. */
export async function redeemLoginToken(raw: string) {
  const token = await prisma.loginToken.findUnique({ where: { tokenHash: sha256(raw) } })
  if (!token || token.usedAt || token.expiresAt < new Date()) return null
  await prisma.loginToken.update({ where: { id: token.id }, data: { usedAt: new Date() } })

  const sessionRaw = randomBytes(32).toString('base64url')
  await prisma.session.create({
    data: {
      userId: token.userId,
      tokenHash: sha256(sessionRaw),
      expiresAt: new Date(Date.now() + SESSION_TTL_DAYS * 86_400_000),
    },
  })
  const jar = await cookies()
  jar.set(SESSION_COOKIE, sessionRaw, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_TTL_DAYS * 86_400,
    path: '/',
  })
  return prisma.user.findUnique({ where: { id: token.userId } })
}

export async function currentUser() {
  const jar = await cookies()
  const raw = jar.get(SESSION_COOKIE)?.value
  if (!raw) return null
  const session = await prisma.session.findUnique({
    where: { tokenHash: sha256(raw) },
    include: { user: true },
  })
  if (!session || session.expiresAt < new Date()) return null
  return session.user
}

export async function signOut() {
  const jar = await cookies()
  const raw = jar.get(SESSION_COOKIE)?.value
  if (raw) await prisma.session.deleteMany({ where: { tokenHash: sha256(raw) } })
  jar.delete(SESSION_COOKIE)
}
