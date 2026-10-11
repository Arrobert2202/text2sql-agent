import { Router, Request, Response } from 'express';
import { WebClient } from '@slack/web-api';
import OpenAI from 'openai';
import { AIService } from '../services/ai.service';
import { PDFService } from '../services/pdf.service';
import { WorkspaceService } from '../services/workspace.service';
import { pdfExportService } from '../services/pdf-export.service';
import { SchedulerService } from '../services/scheduler.service';
import { postgresDb } from '../db/postgres.service';
import { logger } from '../utils/logger';
import { env } from '../config/env';

const router = Router();
const aiService = new AIService(postgresDb);
const pdfService = new PDFService(postgresDb);
const workspaceService = new WorkspaceService(postgresDb);
const schedulerService = new SchedulerService(postgresDb, aiService, pdfExportService);
const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

// Initialize the Slack WebClient
const slack = new WebClient(env.SLACK_BOT_TOKEN);

// Initialize scheduled reports on startup
schedulerService.initializeScheduler().catch((err) => {
    logger.error({ err }, 'Failed to initialize scheduler on boot');
});

// OAuth Installation Callback
router.get('/oauth_callback', async (req: Request, res: Response) => {
    const { code } = req.query;
    if (!code || typeof code !== 'string') {
        return res.status(400).send('Missing OAuth verification code.');
    }

    try {
        const response = await slack.oauth.v2.access({
            client_id: env.SLACK_CLIENT_ID || '',
            client_secret: env.SLACK_CLIENT_SECRET || '',
            code
        });

        if (response.ok && response.team?.id) {
            await workspaceService.upsertWorkspace(response.team.id, response.team.name || 'Unnamed Team');
            logger.info(`Workspace successfully registered via OAuth: ${response.team.id} (${response.team.name})`);
            return res.status(200).send('Installation successful! DataBot is now connected to your workspace.');
        } else {
            logger.error({ response }, 'Slack OAuth access token exchange failed');
            return res.status(400).send('OAuth installation failed.');
        }
    } catch (err) {
        logger.error({ err }, 'Error during Slack OAuth callback');
        return res.status(500).send('Internal Server Error during installation.');
    }
});

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
            
            // Respond to Slack quickly to prevent webhook retry timeouts
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
                                    text: `⚠️ Nu am putut descărca documentul *${file.name}*. Eroare acces rețea Slack.`,
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
                    }
                }

                const hasFiles = event.files && event.files.length > 0;
                
                if (userText && !hasFiles) {
                    // Task 3: Parse scheduling intent (e.g., @DataBot schedule "Win rate by rep" every friday at 9am)
                    const isScheduleIntent = /\b(schedule|programeaz[aă]|recurring)\b/i.test(userText);
                    if (isScheduleIntent) {
                        try {
                            const schedulePrompt = `You are an expert CRON scheduling assistant. The user wants to schedule an automated recurring report.
Extract the natural language query to analyze, and convert the requested schedule into a standard 5-field CRON expression (minute hour day-of-month month day-of-week).
Rules:
- Standard 5-field CRON syntax (e.g., '0 9 * * 5' for every Friday at 9am, '0 8 * * *' for daily at 8am).
- Output ONLY a JSON object: {"query": string, "cron": string | null, "explanation": string}
- If no valid recurrence can be found, return {"cron": null}.`;

                            const parseRes = await openai.chat.completions.create({
                                model: 'gpt-4o-mini',
                                messages: [
                                    { role: 'system', content: schedulePrompt },
                                    { role: 'user', content: userText }
                                ],
                                response_format: { type: "json_object" },
                                temperature: 0
                            });

                            const parsed = JSON.parse(parseRes.choices[0].message?.content || '{}');
                            if (parsed.cron && parsed.query) {
                                const reportId = await schedulerService.addScheduledReport(
                                    tenantId,
                                    event.channel,
                                    parsed.query,
                                    parsed.cron
                                );

                                await slack.chat.postMessage({
                                    channel: event.channel,
                                    text: `🗓️ *Report Scheduled Successfully!*\n• *Inquiry:* "${parsed.query}"\n• *Schedule:* ${parsed.explanation || parsed.cron} (CRON: \`${parsed.cron}\`)\n• *Report ID:* #${reportId}\n\nI will automatically generate and upload the executive PDF report to this channel on schedule.`,
                                    thread_ts: threadTs
                                });
                                return;
                            }
                        } catch (scheduleErr) {
                            logger.error({ err: scheduleErr }, '[Slack] Failed to parse schedule intent');
                        }
                    }

                    // Standard AI Query Execution Pipeline
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
                        text: response.isError ? "DataBot encountered an error." : "DataBot generated insights.",
                        blocks: blocks,
                        thread_ts: threadTs
                    });

                    // Detect if the user requested a downloadable PDF Report
                    const isReportRequested = /\b(report|pdf|raport)\b/i.test(userText);
                    if (isReportRequested && !response.isError) {
                        try {
                            logger.info(`[Slack] Generating and uploading PDF report for tenant ${tenantId}`);
                            const pdfBuffer = await pdfExportService.generateReport({
                                question: userText,
                                analysisText: response.text,
                                chartUrl: response.chartUrl,
                                tenantId
                            });

                            const dateStr = new Date().toISOString().split('T')[0];
                            await slack.files.uploadV2({
                                channel_id: event.channel,
                                file: pdfBuffer,
                                filename: `DataBot_RevOps_Report_${dateStr}.pdf`,
                                title: `DataBot Executive Report (${dateStr})`,
                                initial_comment: "📄 Here is your executive PDF report ready for download:",
                                thread_ts: threadTs
                            });
                            logger.info('[Slack] PDF report uploaded successfully.');
                        } catch (pdfErr) {
                            logger.error({ err: pdfErr }, '[Slack] Failed to generate or upload PDF report');
                        }
                    }
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
