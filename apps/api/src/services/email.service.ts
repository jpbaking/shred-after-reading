import nodemailer from 'nodemailer'
import { config as appConfig } from '../config.js'

export interface EmailConfig {
  host: string
  port: number
  secure: boolean
  auth?: {
    user: string
    pass: string
  }
}

export class EmailService {
  private transporter: nodemailer.Transporter

  constructor(config: EmailConfig) {
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.auth,
    })
  }

  async sendEmail(to: string, subject: string, html: string): Promise<void> {
    await this.transporter.sendMail({
      from: appConfig.smtpFromAddress,
      to,
      subject,
      html,
    })
  }
}