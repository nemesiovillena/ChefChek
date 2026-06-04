import { Injectable } from "@nestjs/common";

interface EmailTemplate {
  subject: string;
  html: string;
  text?: string;
}

@Injectable()
export class EmailService {
  private readonly fromEmail = process.env.EMAIL_FROM || "noreply@chefchek.com";

  async sendEmail(to: string, template: EmailTemplate): Promise<boolean> {
    // En producción, esto usaría un servicio real como SendGrid, SES, etc.
    console.log(`[Email Mock] Sending to: ${to}`);
    console.log(`[Email Mock] Subject: ${template.subject}`);
    console.log(`[Email Mock] Body length: ${template.html.length}`);

    return true;
  }

  async sendNotificationEmail(
    to: string,
    data: {
      userName: string;
      title: string;
      message: string;
      type: string;
    },
  ): Promise<boolean> {
    const template = this.getNotificationTemplate(data);
    return await this.sendEmail(to, template);
  }

  async sendAlertEmail(
    to: string,
    data: {
      userName: string;
      alertType: string;
      title: string;
      description: string;
      severity: string;
    },
  ): Promise<boolean> {
    const template = this.getAlertTemplate(data);
    return await this.sendEmail(to, template);
  }

  async sendWelcomeEmail(
    to: string,
    data: {
      userName: string;
      tenantName: string;
      loginUrl: string;
    },
  ): Promise<boolean> {
    const template = this.getWelcomeTemplate(data);
    return await this.sendEmail(to, template);
  }

  private getNotificationTemplate(data: {
    userName: string;
    title: string;
    message: string;
    type: string;
  }): EmailTemplate {
    return {
      subject: `${data.title} - ChefChek`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Hola ${data.userName},</h2>
          <p>Tienes una nueva notificación en ChefChek:</p>
          <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 10px 0;">
            <strong>${data.title}</strong>
            <p>${data.message}</p>
            <small style="color: #666;">Tipo: ${data.type}</small>
          </div>
          <p style="color: #666; font-size: 12px;">Este es un mensaje automático, por favor no respondas.</p>
        </div>
      `,
    };
  }

  private getAlertTemplate(data: {
    userName: string;
    alertType: string;
    title: string;
    description: string;
    severity: string;
  }): EmailTemplate {
    const severityColors = {
      LOW: "#4CAF50",
      MEDIUM: "#FF9800",
      HIGH: "#F44336",
      CRITICAL: "#D32F2F",
    };

    const color =
      severityColors[data.severity as keyof typeof severityColors] || "#333";

    return {
      subject: `⚠️ ${data.title} - ChefChek Alert`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Hola ${data.userName},</h2>
          <div style="border-left: 4px solid ${color}; padding-left: 15px; margin: 20px 0;">
            <h3 style="color: ${color}; margin: 0 0 10px 0;">${data.title}</h3>
            <p style="margin: 0;">${data.description}</p>
            <small style="color: #666;">Severidad: ${data.severity} | Tipo: ${data.alertType}</small>
          </div>
          <p style="color: #666; font-size: 12px;">Por favor revisa este alerta en tu dashboard de ChefChek.</p>
        </div>
      `,
    };
  }

  private getWelcomeTemplate(data: {
    userName: string;
    tenantName: string;
    loginUrl: string;
  }): EmailTemplate {
    return {
      subject: `¡Bienvenido a ChefChek - ${data.tenantName}!`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="text-align: center; margin: 30px 0;">
            <h1 style="color: #333;">¡Bienvenido a ChefChek!</h1>
            <p style="font-size: 18px; color: #666;">Tu plataforma de gestión de cocina profesional</p>
          </div>
          <p>Estimado/a <strong>${data.userName}</strong>,</p>
          <p>Tu cuenta en <strong>${data.tenantName}</strong> ha sido creada exitosamente.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.loginUrl}" style="background: #4CAF50; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
              Acceder a ChefChek
            </a>
          </div>
          <p style="color: #666; font-size: 12px;">Si tienes alguna pregunta, no dudes en contactarnos.</p>
        </div>
      `,
    };
  }
}
