import { Router, Request, Response } from 'express';
import { WebClient } from '@slack/web-api';
import { AIService } from '../services/ai.service';
import { PDFService } from '../services/pdf.service';
import { postgresDb } from '../db/postgres.service';
import { logger } from '../utils/logger';
import { env } from '../config/env';

const router = Router();
const aiService = new AIService(postgresDb);
const pdfService = new PDFService(postgresDb);

// Initialize the Slack WebClient
const slack = new WebClient(env.SLACK_BOT_TOKEN);

router.post('/events', async (req: Request, res: Response) => {
    try {
        const { type, challenge, event } = req.body;

        if (type === 'url_verification') {
            return res.status(200).send(challenge);
        }

        if (event && event.type === 'app_mention') {
            // Remove bot mentions and any URLs (like file attachments)
            let userText = event.text.replace(/<@[^>]+>/g, '');
            userText = userText.replace(/<https?:\/\/[^>]+>/g, ''); // Slack formatted URLs
            userText = userText.replace(/https?:\/\/[^\s]+/g, ''); // Raw URLs
            userText = userText.trim();
            
            const tenantId = event.team || req.body.team_id || 'default_tenant';
            
            // Respond to Slack quickly
            res.status(200).send('OK');

            try {
                // Check if user uploaded a PDF
                if (event.files && event.files.length > 0) {
                    logger.info({ files: event.files }, '[Slack] Files attached to message');
                    for (const file of event.files) {
                        logger.info(`[Slack] Processing file: ${file.name}, type: ${file.filetype}, mimetype: ${file.mimetype}`);
                        if (file.filetype?.toLowerCase() === 'pdf' || file.mimetype === 'application/pdf') {
                            logger.info(`[Slack] PDF file detected: ${file.name}`);
                            
                            // Download PDF using Slack token
                            const fileResponse = await fetch(file.url_private_download, {
                                headers: { Authorization: `Bearer ${env.SLACK_BOT_TOKEN}` }
                            });
                            
                            if (fileResponse.ok) {
                                const arrayBuffer = await fileResponse.arrayBuffer();
                                const buffer = Buffer.from(arrayBuffer);
                                
                                await pdfService.processAndStorePDF(tenantId, file.name, buffer);
                                
                                await slack.chat.postMessage({
                                    channel: event.channel,
                                    text: `📄 Am citit documentul *${file.name}* și l-am salvat în memorie pentru workspace-ul tău. Îmi poți pune întrebări despre el!`,
                                    thread_ts: event.thread_ts || event.ts
                                });
                            } else {
                                logger.error(`[Slack] Failed to download PDF. Status: ${fileResponse.status} ${fileResponse.statusText}`);
                                await slack.chat.postMessage({
                                    channel: event.channel,
                                    text: `⚠️ Nu am putut descărca documentul *${file.name}*. Erorare acces rețea Slack.`,
                                    thread_ts: event.thread_ts || event.ts
                                });
                            }
                        }
                    }
                }

                // Fetch conversational memory ONLY if this is part of a thread
                let conversationHistory: string[] = [];
                const threadTs = event.thread_ts || event.ts;
                
                if (event.thread_ts) {
                    try {
                        const threadData = await slack.conversations.replies({
                            channel: event.channel,
                            ts: event.thread_ts,
                            limit: 6 // get last 6 messages
                        });
                        
                        if (threadData.messages) {
                            conversationHistory = threadData.messages
                                .filter((msg: any) => msg.text) // Ensure text exists
                                .map((msg: any) => {
                                    const isBot = !!msg.bot_id;
                                    const cleanText = msg.text!.replace(/<@[^>]+>/g, '').trim();
                                    return `${isBot ? 'Bot' : 'User'}: ${cleanText}`;
                                });
                        }
                    } catch (err: any) {
                        logger.warn({ err }, '[Slack] Failed to fetch thread history');
                        await slack.chat.postMessage({
                            channel: event.channel,
                            text: `⚠️ [DEBUG] Eroare Slack API la citirea istoricului: ${err.message}`,
                            thread_ts: event.thread_ts
                        }).catch(() => {});
                    }
                }

                // If there's text in the mention AND no files were attached, process it through the AI
                // (If files were attached, we already sent the confirmation message and we skip the AI to avoid confusing it with dummy commands like "read this")
                const hasFiles = event.files && event.files.length > 0;
                
                if (userText && !hasFiles) {
                    const response = await aiService.processQuestion(tenantId, userText, conversationHistory);
                    
                    const headerText = response.isError ? "DataBot Alert" : "DataBot Insights";
                    
                    const blocks: any[] = [
                        {
                            type: "header",
                            text: { type: "plain_text", text: headerText, emoji: false }
                        },
                        { type: "divider" },
                        {
                            type: "section",
                            text: { type: "mrkdwn", text: response.text }
                        }
                    ];

                    if (response.chartUrl) {
                        blocks.push({
                            type: "image",
                            image_url: response.chartUrl,
                            alt_text: "Generated Chart"
                        });
                    }

                    blocks.push({
                        type: "context",
                        elements: [
                            { type: "mrkdwn", text: `Powered by AI DataBot | Workspace: *${tenantId}*` }
                        ]
                    });

                    await slack.chat.postMessage({ 
                        channel: event.channel, 
                        text: response.isError ? "DataBot encountered an error." : "DataBot generated insights.", // fallback text for notifications
                        blocks: blocks,
                        thread_ts: threadTs 
                    });
                }
            } catch (innerError) {
                logger.error({ err: innerError }, '[Slack] Error processing AI request or sending message');
                try {
                    await slack.chat.postMessage({
                        channel: event.channel,
                        text: "❌ Scuze, am întâmpinat o eroare internă la procesarea datelor.",
                        thread_ts: event.thread_ts || event.ts
                    });
                } catch (fallbackError) {}
            }
            return;
        }

        res.status(200).send('OK');
    } catch (error) {
        logger.error({ err: error }, 'Slack Event Error');
        res.status(500).send('Internal Server Error');
    }
});

export { router as slackRoutes };
