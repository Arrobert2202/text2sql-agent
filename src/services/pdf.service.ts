const pdfParse = require('pdf-parse');
import OpenAI from 'openai';
import { DatabaseService } from '../db/database.interface';
import { env } from '../config/env';
import { logger } from '../utils/logger';

export class PDFService {
    private openai: OpenAI;

    constructor(private dbService: DatabaseService) {
        this.openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
    }

    /**
     * Splits text into smaller chunks for vector embeddings
     */
    private chunkText(text: string, chunkSize: number = 1000, overlap: number = 200): string[] {
        const chunks: string[] = [];
        let startIndex = 0;
        
        while (startIndex < text.length) {
            const endIndex = startIndex + chunkSize;
            chunks.push(text.slice(startIndex, endIndex));
            startIndex += (chunkSize - overlap);
        }
        
        return chunks;
    }

    /**
     * Extracts text from a PDF buffer, chunks it, generates embeddings, and saves to the database
     */
    public async processAndStorePDF(tenantId: string, fileName: string, pdfBuffer: Buffer): Promise<void> {
        try {
            logger.info(`Parsing PDF: ${fileName} for tenant: ${tenantId}`);
            
            // Extract text
            const pdfData = await pdfParse(pdfBuffer);
            const fullText = pdfData.text.replace(/\n+/g, ' ').trim();

            if (!fullText) {
                throw new Error("No text found in PDF.");
            }

            // Split into chunks
            const chunks = this.chunkText(fullText);
            logger.info(`Generated ${chunks.length} chunks for ${fileName}`);

            // Process and store each chunk
            for (const chunk of chunks) {
                // Generate embedding using OpenAI
                const embeddingResponse = await this.openai.embeddings.create({
                    model: "text-embedding-3-small", // Standard embedding model
                    input: chunk,
                });
                
                const embeddingVector = embeddingResponse.data[0].embedding;
                
                // Format the array for pgvector: '[0.1, 0.2, ...]'
                const vectorString = `[${embeddingVector.join(',')}]`;

                // Save to PostgreSQL
                await this.dbService.query(
                    `INSERT INTO document_chunks (tenant_id, file_name, content, embedding) VALUES ($1, $2, $3, $4)`,
                    [tenantId, fileName, chunk, vectorString]
                );
            }
            
            logger.info(`Successfully stored PDF embeddings for ${fileName}`);
        } catch (error) {
            logger.error({ err: error }, `Failed to process PDF ${fileName}`);
            throw error;
        }
    }
}
