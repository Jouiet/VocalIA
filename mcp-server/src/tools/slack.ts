import { z } from 'zod';

export const slackTools = {
    send_notification: {
        name: 'slack_send_notification',
        description: 'Send a notification to a Slack channel via Webhook',
        parameters: {
            message: z.string().describe('The message content to send'),
            channel: z.string().optional().describe('Channel override (if supported by webhook)'),
            username: z.string().optional().describe('Bot username override'),
            icon_emoji: z.string().optional().describe('Bot icon emoji override (e.g. :robot_face:)'),
        },
        handler: async ({ message, channel, username, icon_emoji }: { message: string, channel?: string, username?: string, icon_emoji?: string }) => {
            const webhookUrl = process.env.SLACK_WEBHOOK_URL;

            if (!webhookUrl) {
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({
                            status: "error",
                            message: "Missing SLACK_WEBHOOK_URL in .env",
                            hint: "Configure an Incoming Webhook in Slack Apps and add it to .env"
                        }, null, 2)
                    }]
                };
            }

            try {
                const payload: any = { text: message };
                if (channel) payload.channel = channel;
                if (username) payload.username = username;
                if (icon_emoji) payload.icon_emoji = icon_emoji;

                const response = await fetch(webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    throw new Error(`Slack API error: ${response.status} ${response.statusText}`);
                }

                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({ status: "success", message: "Notification sent to Slack" }, null, 2)
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
    }
};
