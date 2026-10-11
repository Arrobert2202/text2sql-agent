import PDFDocument from 'pdfkit';
import { logger } from '../utils/logger';

export interface ReportOptions {
    question: string;
    analysisText: string;
    chartUrl?: string | null;
    tenantId: string;
}

export class PDFExportService {
    /**
     * Generates a branded, publication-ready executive PDF report.
     * Compiles user prompt, AI analysis, metadata, and fetched QuickChart graphics into a Buffer.
     */
    public async generateReport(options: ReportOptions): Promise<Buffer> {
        return new Promise(async (resolve, reject) => {
            try {
                const doc = new PDFDocument({
                    margin: 40,
                    size: 'A4',
                    info: {
                        Title: 'DataBot Executive RevOps Report',
                        Author: 'DataBot AI',
                        Subject: options.question
                    }
                });

                const chunks: Buffer[] = [];
                doc.on('data', (chunk) => chunks.push(chunk));
                doc.on('end', () => resolve(Buffer.concat(chunks)));
                doc.on('error', (err) => reject(err));

                const pageWidth = doc.page.width;
                const contentWidth = pageWidth - 80;

                // --- 1. Brand Header Banner ---
                doc.rect(40, 40, contentWidth, 54).fill('#0F172A'); // Slate-900
                doc.fillColor('#FFFFFF')
                    .fontSize(16)
                    .font('Helvetica-Bold')
                    .text('DATABOT REVOPS INTELLIGENCE', 56, 52);

                doc.fontSize(9)
                    .font('Helvetica')
                    .fillColor('#94A3B8') // Slate-400
                    .text('Automated Executive Analytics & Decision Support', 56, 73);

                doc.moveDown(2);

                // --- 2. Report Metadata Block ---
                const generatedDate = new Date().toUTCString();
                const startY = 108;
                doc.rect(40, startY, contentWidth, 34).fill('#F8FAFC'); // Slate-50
                doc.rect(40, startY, contentWidth, 34).strokeColor('#E2E8F0').stroke();

                doc.font('Helvetica-Bold').fontSize(8).fillColor('#475569');
                doc.text('TENANT / WORKSPACE:', 52, startY + 8);
                doc.font('Helvetica').text(options.tenantId, 160, startY + 8);

                doc.font('Helvetica-Bold').text('DATE GENERATED:', 52, startY + 20);
                doc.font('Helvetica').text(generatedDate, 160, startY + 20);

                // --- 3. Executive Inquiry (User Prompt) ---
                const inquiryY = startY + 46;
                doc.font('Helvetica-Bold').fontSize(11).fillColor('#0F172A').text('1. Executive Inquiry', 40, inquiryY);
                doc.moveDown(0.4);

                doc.rect(40, doc.y, contentWidth, 42).fill('#EEF2F6');
                const promptBoxY = doc.y;
                doc.font('Helvetica-Oblique')
                    .fontSize(9.5)
                    .fillColor('#1E293B')
                    .text(`"${options.question}"`, 52, promptBoxY + 12, { width: contentWidth - 24 });

                doc.y = promptBoxY + 54;

                // --- 4. Key Findings & Data Analysis ---
                doc.font('Helvetica-Bold').fontSize(11).fillColor('#0F172A').text('2. Key Findings & Analysis', 40, doc.y);
                doc.moveDown(0.5);

                // Sanitize Slack formatting (convert *bold* to plain or readable text)
                const cleanAnalysis = options.analysisText
                    .replace(/\*/g, '')
                    .replace(/•/g, '-')
                    .trim();

                doc.font('Helvetica')
                    .fontSize(9.5)
                    .fillColor('#334155')
                    .text(cleanAnalysis, 40, doc.y, {
                        width: contentWidth,
                        lineGap: 4
                    });

                doc.moveDown(1.5);

                // --- 5. Visual Trends & Analytics Chart ---
                if (options.chartUrl) {
                    try {
                        const chartResponse = await fetch(options.chartUrl);
                        if (chartResponse.ok) {
                            const arrayBuffer = await chartResponse.arrayBuffer();
                            const imageBuffer = Buffer.from(arrayBuffer);

                            // Check remaining page space, add page if tight
                            if (doc.y + 240 > doc.page.height - 60) {
                                doc.addPage();
                            }

                            doc.font('Helvetica-Bold').fontSize(11).fillColor('#0F172A').text('3. Visual Analytics & Metrics', 40, doc.y);
                            doc.moveDown(0.6);

                            const chartY = doc.y;
                            doc.rect(40, chartY, contentWidth, 230).strokeColor('#E2E8F0').stroke();
                            doc.image(imageBuffer, 45, chartY + 10, {
                                fit: [contentWidth - 10, 210],
                                align: 'center',
                                valign: 'center'
                            });

                            doc.y = chartY + 240;
                        }
                    } catch (chartErr) {
                        logger.warn({ err: chartErr }, 'Failed to fetch or embed QuickChart image into PDF');
                    }
                }

                // --- 6. Footer ---
                const footerY = doc.page.height - 35;
                doc.font('Helvetica')
                    .fontSize(8)
                    .fillColor('#94A3B8')
                    .text('Confidential • Internal RevOps Report • Powered by DataBot AI', 40, footerY, {
                        align: 'center',
                        width: contentWidth
                    });

                doc.end();
            } catch (err) {
                logger.error({ err }, 'PDF Report generation failed');
                reject(err);
            }
        });
    }
}

export const pdfExportService = new PDFExportService();
