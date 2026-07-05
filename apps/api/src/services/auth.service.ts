import { UserService } from './user.service.js'
import { EmailVerificationTokenService } from './email-verification-token.service.js'
import { SessionService } from './session.service.js'
import { hashPassword, verifyPassword, generateOpaqueToken, hashToken } from '../security.js'
import { config } from '../config.js'

export interface EmailSender {
  sendEmail(to: string, subject: string, html: string): Promise<void>
}

export class AuthError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'AuthError'
    this.status = status
  }
}

export interface RegisterInput {
  email: string
  password: string
  name?: string
}

export interface LoginInput {
  email: string
  password: string
  rememberMe?: boolean
}

export interface AuthUser {
  id: string
  email: string
  name: string | null
  emailVerified: boolean
  isAdmin: boolean
  isBanned: boolean
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_PASSWORD_LENGTH = 8

export class AuthService {
  private userService: UserService
  private emailVerificationTokenService: EmailVerificationTokenService
  private sessionService: SessionService
  private emailService: EmailSender

  constructor(emailService: EmailSender) {
    this.userService = new UserService()
    this.emailVerificationTokenService = new EmailVerificationTokenService()
    this.sessionService = new SessionService()
    this.emailService = emailService
  }

  async register(input: RegisterInput): Promise<{
    user: { id: string; email: string; name: string | null }
    emailSent: boolean
  }> {
    const normalizedEmail = input.email.trim().toLowerCase()

    if (!EMAIL_REGEX.test(normalizedEmail)) {
      throw new AuthError(422, 'Invalid email address')
    }

    if (input.password.length < MIN_PASSWORD_LENGTH) {
      throw new AuthError(422, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
    }

    const existingUser = await this.userService.findFullUserByEmail(normalizedEmail)
    if (existingUser) {
      throw new AuthError(409, 'An account with this email already exists')
    }

    const passwordHash = hashPassword(input.password)

    const user = await this.userService.createUser({
      email: normalizedEmail,
      passwordHash,
      name: input.name || undefined,
    })

    const emailSent = await this.sendVerificationEmail(user.id, normalizedEmail)

    return {
      user: { id: user.id, email: normalizedEmail, name: user.name },
      emailSent,
    }
  }

  private async sendVerificationEmail(userId: string, email: string): Promise<boolean> {
    const rawToken = generateOpaqueToken()
    const expiresAt = new Date(
      Date.now() + config.emailVerificationTtlDays * 24 * 60 * 60 * 1000,
    )

    // Only the hash is persisted; the raw token exists solely in the email link.
    await this.emailVerificationTokenService.createEmailVerificationToken({
      userId,
      token: hashToken(rawToken),
      email,
      expiresAt,
    })

    const verificationUrl = `${config.appBaseUrl}/verify-email?token=${encodeURIComponent(rawToken)}`
    const subject = 'Verify your email address'
    const html = [
      '<h1>Verify your email address</h1>',
      '<p>Thank you for registering with ShredAfterReading.</p>',
      '<p>Click the link below to verify your email address:</p>',
      `<p><a href="${verificationUrl}">${verificationUrl}</a></p>`,
      `<p>This link will expire in ${config.emailVerificationTtlDays} days.</p>`,
    ].join('\n')

    try {
      await this.emailService.sendEmail(email, subject, html)
      return true
    } catch (error) {
      console.error('Failed to send verification email:', error)
      return false
    }
  }

  async verifyEmail(rawToken: string): Promise<{ email: string }> {
    const record = await this.emailVerificationTokenService.findEmailVerificationTokenByToken(
      hashToken(rawToken),
    )

    if (!record) {
      throw new AuthError(400, 'Invalid verification token')
    }

    if (record.used) {
      throw new AuthError(409, 'Verification token has already been used')
    }

    if (record.expiresAt < new Date()) {
      throw new AuthError(410, 'Verification token has expired')
    }

    await this.emailVerificationTokenService.updateEmailVerificationToken(record.token, true)
    const user = await this.userService.markEmailVerified(record.userId)

    return { email: user.email }
  }

  async login(input: LoginInput): Promise<{
    user: AuthUser
    sessionToken: string
    expiresAt: Date
  }> {
    const normalizedEmail = input.email.trim().toLowerCase()
    const user = await this.userService.findFullUserByEmail(normalizedEmail)

    if (!user || !verifyPassword(input.password, user.passwordHash)) {
      throw new AuthError(401, 'Invalid credentials')
    }

    if (user.isBanned) {
      throw new AuthError(403, 'This account has been banned')
    }

    if (!user.emailVerified) {
      throw new AuthError(403, 'Please verify your email address before logging in')
    }

    const ttlMs = input.rememberMe
      ? config.rememberMeTtlDays * 24 * 60 * 60 * 1000
      : config.sessionTtlHours * 60 * 60 * 1000

    const rawToken = generateOpaqueToken()
    const expiresAt = new Date(Date.now() + ttlMs)

    await this.sessionService.createSession({
      userId: user.id,
      token: hashToken(rawToken),
      expiresAt,
    })

    return {
      user: this.toAuthUser(user),
      sessionToken: rawToken,
      expiresAt,
    }
  }

  async logout(rawToken: string): Promise<void> {
    try {
      await this.sessionService.deleteSession(hashToken(rawToken))
    } catch {
      // Unknown or already-deleted sessions make logout a no-op.
    }
  }

  async getUserForSession(rawToken: string): Promise<AuthUser | null> {
    const session = await this.sessionService.findSessionByToken(hashToken(rawToken))

    if (!session) {
      return null
    }

    if (session.expiresAt < new Date()) {
      await this.logout(rawToken)
      return null
    }

    const user = await this.userService.findFullUserById(session.userId)

    if (!user) {
      return null
    }

    return this.toAuthUser(user)
  }

  private toAuthUser(user: {
    id: string
    email: string
    name: string | null
    emailVerified: Date | null
    isAdmin: boolean
    isBanned: boolean
  }): AuthUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      emailVerified: user.emailVerified !== null,
      isAdmin: user.isAdmin,
      isBanned: user.isBanned,
    }
  }
}
