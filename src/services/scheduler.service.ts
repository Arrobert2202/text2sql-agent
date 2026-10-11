import cron, { ScheduledTask } from 'node-cron';
import { WebClient } from '@slack/web-api';
import { AIService } from './ai.service';
import { PDFExportService } from './pdf-export.service';
import { DatabaseService } from '../db/database.interface';
import { logger } from '../utils/logger';
import { env } from '../config/env';

export interface ScheduledReportRow {
    id: number;
    tenant_id: string;
    channel_id: string;
    natural_language_query: string;
    cron_schedule: string;
    is_active: boolean;
}

export class SchedulerService {
    private scheduledTasks: Map<number, ScheduledTask> = new Map();
    private slack: WebClient;

    constructor(
        private dbService: DatabaseService,
        private aiService: AIService,
        private pdfExportService: PDFExportService
    ) {
        this.slack = new WebClient(env.SLACK_BOT_TOKEN);
    }

    /**
     * Initializes all active scheduled reports from PostgreSQL on startup.
     */
    public async initializeScheduler(): Promise<void> {
        try {
            const query = `
                SELECT id, tenant_id, channel_id, natural_language_query, cron_schedule, is_active
                FROM scheduled_reports
                WHERE is_active = true;
            `;
            const reports = await this.dbService.query(query);
            logger.info(`[Scheduler] Loading ${reports.length} active scheduled reports from database...`);

            for (const report of reports) {
                this.registerCronJob(report as ScheduledReportRow);
            }
        } catch (error) {
            logger.error({ err: error }, '[Scheduler] Failed to initialize scheduled reports');
        }
    }

    /**
     * Registers and starts a cron task for a scheduled report row.
     */
    private registerCronJob(report: ScheduledReportRow): void {
        if (!cron.validate(report.cron_schedule)) {
            logger.error(`[Scheduler] Invalid CRON expression: "${report.cron_schedule}" for report #${report.id}`);
            return;
        }

        // Cancel existing task if reloading
        if (this.scheduledTasks.has(report.id)) {
            this.scheduledTasks.get(report.id)?.stop();
            this.scheduledTasks.delete(report.id);
        }

        const task = cron.schedule(report.cron_schedule, async () => {
            logger.info(`[Scheduler] Executing scheduled report #${report.id}: "${report.natural_language_query}" for tenant ${report.tenant_id}`);
            try {
                // 1. Execute AI analysis (leverages semantic cache & read-only tenant DB)
                const aiResponse = await this.aiService.processQuestion(report.tenant_id, report.natural_language_query);

                // 2. Generate PDF Report Buffer
                const pdfBuffer = await this.pdfExportService.generateReport({
                    question: report.natural_language_query,
                    analysisText: aiResponse.text,
                    chartUrl: aiResponse.chartUrl,
                    tenantId: report.tenant_id
                });

                // 3. Post directly to Slack channel
                const dateStr = new Date().toISOString().split('T')[0];
                await this.slack.files.uploadV2({
                    channel_id: report.channel_id,
                    file: pdfBuffer,
                    filename: `Scheduled_RevOps_Report_${dateStr}.pdf`,
                    title: `Automated Report: ${report.natural_language_query}`,
                    initial_comment: `⏰ *Automated Scheduled Report*\n*Inquiry:* "${report.natural_language_query}"\n\n${aiResponse.text}`
                });

                logger.info(`[Scheduler] Successfully delivered scheduled report #${report.id} to channel ${report.channel_id}`);
            } catch (err) {
                logger.error({ err }, `[Scheduler] Error running scheduled report #${report.id}`);
            }
        });

        this.scheduledTasks.set(report.id, task);
        logger.info(`[Scheduler] Registered CRON job #${report.id} ("${report.cron_schedule}") for query: "${report.natural_language_query}"`);
    }

    /**
     * Adds a new scheduled report to PostgreSQL and starts its cron job.
     */
    public async addScheduledReport(
        tenantId: string,
        channelId: string,
        naturalLanguageQuery: string,
        cronSchedule: string
    ): Promise<number> {
        const query = `
            INSERT INTO scheduled_reports (tenant_id, channel_id, natural_language_query, cron_schedule, is_active)
            VALUES ($1, $2, $3, $4, true)
            RETURNING id;
        `;
        const result = await this.dbService.query(query, [tenantId, channelId, naturalLanguageQuery, cronSchedule]);
        const id = result[0].id as number;

        this.registerCronJob({
            id,
            tenant_id: tenantId,
            channel_id: channelId,
            natural_language_query: naturalLanguageQuery,
            cron_schedule: cronSchedule,
            is_active: true
        });

        return id;
    }

    /**
     * Cancels an existing scheduled report.
     */
    public async cancelScheduledReport(reportId: number): Promise<void> {
        const query = `UPDATE scheduled_reports SET is_active = false WHERE id = $1;`;
        await this.dbService.query(query, [reportId]);

        const task = this.scheduledTasks.get(reportId);
        if (task) {
            task.stop();
            this.scheduledTasks.delete(reportId);
            logger.info(`[Scheduler] Cancelled CRON job #${reportId}`);
        }
    }
}
