import { z } from 'zod';
import * as path from 'path';
import * as fs from 'fs';
import { createRequire } from 'module';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

/**
 * Email MCP Tools - Session 249.6
 *
 * Capabilities:
 * - Send emails with attachments
 * - Support for HTML and plain text
 * - Multi-tenant SMTP configuration via SecretVault
 *
 * Supports: SMTP, Gmail, Outlook, SendGrid, Mailgun
 */

import { corePath } from '../paths.js';

const require = createRequire(import.meta.url);
let SecretVault: any = null;
try {
    SecretVault = require(corePath('SecretVault.cjs'));
} catch {
    // Fallback to env vars
}

interface SMTPConfig {
    host: string;
    port: number;
    secure: boolean;
    auth: {
        user: string;
        pass: string;
    };
    from: string;
}

/**
 * Get SMTP configuration for a tenant
 */
async function getSMTPConfig(tenantId: string = 'agency_internal'): Promise<SMTPConfig | null> {
    if (SecretVault) {
        const creds = await SecretVault.loadCredentials(tenantId);
        if (creds.SMTP_HOST && creds.SMTP_USER && creds.SMTP_PASS) {
            return {
                host: creds.SMTP_HOST,
                port: parseInt(creds.SMTP_PORT || '587'),
                secure: creds.SMTP_SECURE === 'true' || creds.SMTP_PORT === '465',
                auth: {
                    user: creds.SMTP_USER,
                    pass: creds.SMTP_PASS
                },
                from: creds.SMTP_FROM || creds.SMTP_USER
            };
        }
    }

    // Fallback to environment variables
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
        return {
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: process.env.SMTP_SECURE === 'true' || process.env.SMTP_PORT === '465',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            },
            from: process.env.SMTP_FROM || process.env.SMTP_USER
        };
    }

    return null;
}

/**
 * Create transporter from config
 */
function createTransporter(config: SMTPConfig): Transporter {
    return nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: config.auth
    });
}

export const emailTools = {
    send_email: {
        name: 'email_send',
        description: 'Send an email with optional attachments',
        parameters: {
            to: z.string().describe('Recipient email address(es), comma-separated for multiple'),
            subject: z.string().describe('Email subject line'),
            body: z.string().describe('Email body content (plain text)'),
            html: z.string().optional().describe('HTML version of the email body'),
            cc: z.string().optional().describe('CC recipients, comma-separated'),
            bcc: z.string().optional().describe('BCC recipients, comma-separated'),
            attachments: z.array(z.string()).optional().describe('Array of file paths to attach'),
            replyTo: z.string().optional().describe('Reply-to email address'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ to, subject, body, html, cc, bcc, attachments, replyTo, _meta }: {
            to: string,
            subject: string,
            body: string,
            html?: string,
            cc?: string,
            bcc?: string,
            attachments?: string[],
            replyTo?: string,
            _meta?: { tenantId?: string }
        }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const config = await getSMTPConfig(tenantId);

            if (!config) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing SMTP configuration",
                            required: ["SMTP_HOST", "SMTP_USER", "SMTP_PASS"],
                            optional: ["SMTP_PORT", "SMTP_SECURE", "SMTP_FROM"],
                            hint: "Configure via SecretVault or environment variables"
                        }, null, 2)
                    }]
                };
            }

            try {
                const transporter = createTransporter(config);

                // Verify connection
                await transporter.verify();

                // Build mail options
                const mailOptions: any = {
                    from: config.from,
                    to,
                    subject,
                    text: body
                };

                if (html) mailOptions.html = html;
                if (cc) mailOptions.cc = cc;
                if (bcc) mailOptions.bcc = bcc;
                if (replyTo) mailOptions.replyTo = replyTo;

                // Handle attachments
                if (attachments && attachments.length > 0) {
                    mailOptions.attachments = attachments.map(filePath => {
                        if (!fs.existsSync(filePath)) {
                            throw new Error(`Attachment not found: ${filePath}`);
                        }
                        return {
                            filename: path.basename(filePath),
                            path: filePath
                        };
                    });
                }

                // Send email
                const info = await transporter.sendMail(mailOptions);

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            message: "Email sent successfully",
                            email: {
                                messageId: info.messageId,
                                to,
                                subject,
                                accepted: info.accepted,
                                rejected: info.rejected,
                                attachments_count: attachments?.length || 0
                            }
                        }, null, 2)
                    }]
                };
            } catch (error: any) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: error.message,
                            code: error.code,
                            hint: error.code === 'EAUTH'
                                ? "Authentication failed. Check SMTP_USER and SMTP_PASS."
                                : error.code === 'ECONNREFUSED'
                                ? "Connection refused. Check SMTP_HOST and SMTP_PORT."
                                : undefined
                        }, null, 2)
                    }]
                };
            }
        }
    },

    send_email_with_template: {
        name: 'email_send_template',
        description: 'Send an email using a predefined template',
        parameters: {
            to: z.string().describe('Recipient email address'),
            template: z.enum(['lead_confirmation', 'booking_confirmation', 'follow_up', 'invoice']).describe('Template name'),
            variables: z.record(z.string(), z.string()).describe('Template variables (e.g., {name: "John", company: "Acme"})'),
            attachments: z.array(z.string()).optional().describe('Array of file paths to attach'),
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ to, template, variables, attachments, _meta }: {
            to: string,
            template: string,
            variables: Record<string, string>,
            attachments?: string[],
            _meta?: { tenantId?: string }
        }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const config = await getSMTPConfig(tenantId);

            if (!config) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing SMTP configuration"
                        }, null, 2)
                    }]
                };
            }

            // Template definitions
            const templates: Record<string, { subject: string, body: string, html: string }> = {
                lead_confirmation: {
                    subject: 'Merci pour votre intérêt - VocalIA',
                    body: `Bonjour {{name}},\n\nMerci d'avoir contacté VocalIA. Nous avons bien reçu votre demande.\n\nUn conseiller vous contactera dans les plus brefs délais.\n\nCordialement,\nL'équipe VocalIA`,
                    html: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                            <div style="background: linear-gradient(135deg, #5E6AD2 0%, #4338ca 100%); padding: 30px; text-align: center;">
                                <h1 style="color: white; margin: 0;">VocalIA</h1>
                            </div>
                            <div style="padding: 30px; background: #f8fafc;">
                                <h2 style="color: #1e1b4b;">Bonjour {{name}},</h2>
                                <p style="color: #475569; line-height: 1.6;">Merci d'avoir contacté VocalIA. Nous avons bien reçu votre demande.</p>
                                <p style="color: #475569; line-height: 1.6;">Un conseiller vous contactera dans les plus brefs délais.</p>
                                <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
                                <p style="color: #94a3b8; font-size: 14px;">Cordialement,<br>L'équipe VocalIA</p>
                            </div>
                        </div>
                    `
                },
                booking_confirmation: {
                    subject: 'Confirmation de votre rendez-vous - VocalIA',
                    body: `Bonjour {{name}},\n\nVotre rendez-vous est confirmé pour le {{date}} à {{time}}.\n\nÀ bientôt,\nL'équipe VocalIA`,
                    html: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                            <div style="background: linear-gradient(135deg, #5E6AD2 0%, #4338ca 100%); padding: 30px; text-align: center;">
                                <h1 style="color: white; margin: 0;">VocalIA</h1>
                            </div>
                            <div style="padding: 30px; background: #f8fafc;">
                                <h2 style="color: #1e1b4b;">Confirmation de rendez-vous</h2>
                                <p style="color: #475569; line-height: 1.6;">Bonjour <strong>{{name}}</strong>,</p>
                                <div style="background: white; border-left: 4px solid #5E6AD2; padding: 15px; margin: 20px 0;">
                                    <p style="margin: 0; color: #1e1b4b;"><strong>Date:</strong> {{date}}</p>
                                    <p style="margin: 10px 0 0; color: #1e1b4b;"><strong>Heure:</strong> {{time}}</p>
                                </div>
                                <p style="color: #94a3b8; font-size: 14px;">À bientôt,<br>L'équipe VocalIA</p>
                            </div>
                        </div>
                    `
                },
                follow_up: {
                    subject: 'Suite à notre conversation - VocalIA',
                    body: `Bonjour {{name}},\n\nSuite à notre conversation, voici les informations demandées.\n\n{{message}}\n\nN'hésitez pas à nous recontacter.\n\nCordialement,\nL'équipe VocalIA`,
                    html: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                            <div style="background: linear-gradient(135deg, #5E6AD2 0%, #4338ca 100%); padding: 30px; text-align: center;">
                                <h1 style="color: white; margin: 0;">VocalIA</h1>
                            </div>
                            <div style="padding: 30px; background: #f8fafc;">
                                <p style="color: #475569;">Bonjour <strong>{{name}}</strong>,</p>
                                <p style="color: #475569;">Suite à notre conversation, voici les informations demandées:</p>
                                <div style="background: white; padding: 15px; border-radius: 8px; margin: 20px 0;">
                                    <p style="color: #1e1b4b; white-space: pre-wrap;">{{message}}</p>
                                </div>
                                <p style="color: #94a3b8; font-size: 14px;">Cordialement,<br>L'équipe VocalIA</p>
                            </div>
                        </div>
                    `
                },
                invoice: {
                    subject: 'Facture #{{invoice_number}} - VocalIA',
                    body: `Bonjour {{name}},\n\nVeuillez trouver ci-joint votre facture #{{invoice_number}}.\n\nMontant: {{amount}}\nÉchéance: {{due_date}}\n\nCordialement,\nL'équipe VocalIA`,
                    html: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                            <div style="background: linear-gradient(135deg, #5E6AD2 0%, #4338ca 100%); padding: 30px; text-align: center;">
                                <h1 style="color: white; margin: 0;">VocalIA</h1>
                            </div>
                            <div style="padding: 30px; background: #f8fafc;">
                                <h2 style="color: #1e1b4b;">Facture #{{invoice_number}}</h2>
                                <p style="color: #475569;">Bonjour <strong>{{name}}</strong>,</p>
                                <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                                    <table style="width: 100%; border-collapse: collapse;">
                                        <tr>
                                            <td style="color: #64748b; padding: 10px 0;">Montant:</td>
                                            <td style="color: #1e1b4b; font-weight: bold; text-align: right;">{{amount}}</td>
                                        </tr>
                                        <tr>
                                            <td style="color: #64748b; padding: 10px 0;">Échéance:</td>
                                            <td style="color: #1e1b4b; text-align: right;">{{due_date}}</td>
                                        </tr>
                                    </table>
                                </div>
                                <p style="color: #94a3b8; font-size: 14px;">Cordialement,<br>L'équipe VocalIA</p>
                            </div>
                        </div>
                    `
                }
            };

            const tpl = templates[template];
            if (!tpl) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: `Unknown template: ${template}`,
                            available_templates: Object.keys(templates)
                        }, null, 2)
                    }]
                };
            }

            // Replace variables in template
            let subject = tpl.subject;
            let body = tpl.body;
            let html = tpl.html;

            for (const [key, value] of Object.entries(variables)) {
                const pattern = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
                subject = subject.replace(pattern, value);
                body = body.replace(pattern, value);
                html = html.replace(pattern, value);
            }

            try {
                const transporter = createTransporter(config);
                await transporter.verify();

                const mailOptions: any = {
                    from: config.from,
                    to,
                    subject,
                    text: body,
                    html
                };

                if (attachments && attachments.length > 0) {
                    mailOptions.attachments = attachments.map(filePath => ({
                        filename: path.basename(filePath),
                        path: filePath
                    }));
                }

                const info = await transporter.sendMail(mailOptions);

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            message: "Template email sent successfully",
                            email: {
                                messageId: info.messageId,
                                to,
                                template,
                                variables_used: Object.keys(variables)
                            }
                        }, null, 2)
                    }]
                };
            } catch (error: any) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: error.message
                        }, null, 2)
                    }]
                };
            }
        }
    },

    verify_smtp: {
        name: 'email_verify_smtp',
        description: 'Verify SMTP connection and credentials',
        parameters: {
            _meta: z.object({ tenantId: z.string().optional() }).optional().describe('Tenant context'),
        },
        handler: async ({ _meta }: { _meta?: { tenantId?: string } }) => {
            const tenantId = _meta?.tenantId || 'agency_internal';
            const config = await getSMTPConfig(tenantId);

            if (!config) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing SMTP configuration",
                            required: ["SMTP_HOST", "SMTP_USER", "SMTP_PASS"]
                        }, null, 2)
                    }]
                };
            }

            try {
                const transporter = createTransporter(config);
                await transporter.verify();

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "success",
                            message: "SMTP connection verified successfully",
                            config: {
                                host: config.host,
                                port: config.port,
                                secure: config.secure,
                                user: config.auth.user,
                                from: config.from
                            }
                        }, null, 2)
                    }]
                };
            } catch (error: any) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: error.message,
                            code: error.code
                        }, null, 2)
                    }]
                };
            }
        }
    }
};
