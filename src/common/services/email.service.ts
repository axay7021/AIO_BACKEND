import * as Dotenv from 'dotenv';
import { BadRequestException, Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as handlebars from 'handlebars';
import * as nodemailer from 'nodemailer';
import { mailData } from '@common/interfaces/admin/admin.interface';

Dotenv.config();

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;
  private defaults: { from: string };
  constructor() {
    const emailConfig = {
      transport: {
        host: 'smtp.mailgun.org',
        port: 587,
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      },
      defaults: {
        from: 'test@sandbox26bccf622d80419ebf2144f0a48880ca.mailgun.org',
      },
    };

    // Initialize Nodemailer transporter with the transport config
    this.transporter = nodemailer.createTransport(emailConfig.transport);

    // Set the defaults
    this.defaults = emailConfig.defaults;
  }

  async renderHbsTemplate(templatePath: string, data: object): Promise<string> {
    const template = handlebars.compile(fs.readFileSync(templatePath, 'utf-8'));
    return template(data);
  }

  async sendOtpToMail(toMail: string, data: mailData): Promise<boolean> {
    try {
      // console.log('data=====>', toMail, data);
      const getPath = path.join(__dirname, '../../../../html');
      const templatePath = path.join(getPath, 'sendotp.html');
      const otp = data.otp;
      const html = await this.renderHbsTemplate(templatePath, {
        otp,
        toMail,
      });

      // Email payload
      const emailPayload = {
        from: this.defaults.from,
        to: toMail,
        subject: `${otp} is your Follow Client code`,
        html: html,
      };

      // Send email using Nodemailer
      await this.transporter.sendMail(emailPayload);

      return true;
    } catch (error) {
      console.error('Error sending email:', error);
      throw new BadRequestException('Failed to send email');
    }
  }
}
