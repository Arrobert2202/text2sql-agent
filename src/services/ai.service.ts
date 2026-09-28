import OpenAI from 'openai';
import { env } from '../config/env';
import { DatabaseService } from '../db/database.interface';
import { logger } from '../utils/logger';
import { WorkspaceService } from './workspace.service';

export class AIService {
    private openai: OpenAI;
    private workspaceService: WorkspaceService;
    constructor(private dbService: DatabaseService) { 
        this.openai = new OpenAI({ apiKey: env.OPENAI_API_KEY }); 
        this.workspaceService = new WorkspaceService(this.dbService);
    }

    private isSafeQuery(query: string): boolean {
        const upperQuery = query.toUpperCase();
        const forbiddenKeywords = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'TRUNCATE', 'REPLACE', 'GRANT', 'REVOKE'];
        return !forbiddenKeywords.some(keyword => new RegExp(`\\b${keyword}\\b`).test(upperQuery)) && /^\s*(SELECT|WITH)\b/.test(upperQuery);
    }

    /**
     * Converts a natural language question into a PostgreSQL query.
     * Uses the dynamically loaded schema and enforces tenant isolation.
     */
    private async generateSQL(question: string, tenantId: string): Promise<string | null> {
        const schema = await this.dbService.getSchema();
        const systemPrompt = `You are a senior SQL data analyst. Convert user questions into valid PostgreSQL queries based on this schema:\n${schema}\nRules:\n1. Return ONLY the raw SQL query, no markdown, no explanations.\n2. CRITICAL: Assume the user belongs to tenant/company ID '${tenantId}'. If and ONLY if a table explicitly contains a 'tenant_id' column in the schema above, you MUST filter by tenant_id = '${tenantId}'. Do NOT invent a tenant_id column for tables that do not have it (like auto_parts, customers, orders).\n3. CRITICAL: For string matching, NEVER use the exact user phrase as a single ILIKE. You MUST split the phrase into 1-2 core keywords (root words) and use them with AND. E.g. DO NOT write ILIKE '%filtrul de aer%', instead write name ILIKE '%filtru%' AND name ILIKE '%aer%'\n4. Assume the user is referring to the 'name' column if they mention a product or person without specifying a column.\n5. If the user asks for a chart, graph, or visual, output the SQL query that fetches the DATA needed for that chart.\n6. Only return "INVALID_QUESTION" if the query is completely outside the scope of the schema. Map general business terms like 'products', 'stock', 'inventory' to 'auto_parts', and 'clients' to 'customers'.`;
        const response = await this.openai.chat.completions.create({ model: 'gpt-4o-mini', messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: question }], temperature: 0 });
        let sqlQuery = response.choices[0].message.content?.trim();
        if (!sqlQuery || sqlQuery === "INVALID_QUESTION") return null;
        return sqlQuery.replace(/^```sql\s*/i, '').replace(/```\s*$/, '').trim();
    }

    /**
     * Rewrites a follow-up question into a standalone question using conversation history.
     * Resolves pronouns and implicit references.
     */
    private async contextualizeQuestion(question: string, history: string[]): Promise<string> {
        if (!history || history.length === 0) return question;

        const systemPrompt = `You are an AI assistant tasked with rewriting a user's question into a fully standalone question.
You will be provided with the conversation history and the latest question.
Your goal is to resolve any pronouns (e.g., "it", "they", "he", "this") or implicit references in the latest question based on the history.
Do NOT answer the question. ONLY output the rewritten standalone question.`;

        const response = await this.openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `Conversation History:\n${history.join('\n')}\n\nLatest Question: ${question}` }
            ],
            temperature: 0
        });

        return response.choices[0].message.content?.trim() || question;
    }

    /**
     * Main entry point for processing a user's question.
     * Integrates RAG (PDFs) and Text-to-SQL workflows.
     * Checks SaaS subscription status before processing.
     * 
     * @param tenantId The Slack workspace ID or generic tenant identifier
     * @param question The raw question asked by the user
     * @param conversationHistory Array of recent messages
     * @returns A JSON structure containing the final text, optional chart URL, and error state
     */
    public async processQuestion(tenantId: string, question: string, conversationHistory: string[] = []): Promise<{ text: string; chartUrl: string | null; isError: boolean }> {
        logger.info(`Analyzing original question: "${question}" for tenant: ${tenantId}`);
        
        // --- 0. SaaS Authentication & Billing Check ---
        const status = await this.workspaceService.getWorkspaceStatus(tenantId);
        if (status === 'inactive' || status === 'canceled') {
            logger.warn(`Tenant ${tenantId} is inactive. Blocking request.`);
            return {
                text: "Your DataBot subscription is currently inactive. Please visit the dashboard to reactivate it.",
                chartUrl: null,
                isError: true
            };
        }
        // ----------------------------------------------
        
        // 0. Contextualize the question based on conversational memory
        const standaloneQuestion = await this.contextualizeQuestion(question, conversationHistory);
        if (standaloneQuestion !== question) {
            logger.info(`Rewritten as standalone question: "${standaloneQuestion}"`);
        }
        
        // 1. Try to find relevant document chunks via vector search using the standalone question
        let documentContext = "";
        try {
            const embeddingResponse = await this.openai.embeddings.create({
                model: "text-embedding-3-small",
                input: standaloneQuestion,
            });
            const questionVector = `[${embeddingResponse.data[0].embedding.join(',')}]`;
            
            // Search pgvector using cosine distance (<=>) filtering by tenant
            const vectorQuery = `
                SELECT file_name, content, 1 - (embedding <=> $1) as similarity 
                FROM document_chunks 
                WHERE tenant_id = $2
                ORDER BY similarity DESC 
                LIMIT 3;
            `;
            const relevantChunks = await this.dbService.query(vectorQuery, [questionVector, tenantId]);
            
            if (relevantChunks && relevantChunks.length > 0) {
                documentContext = relevantChunks.map((chunk: any) => 
                    `Source: ${chunk.file_name}\nContent: ${chunk.content}`
                ).join('\n\n');
                logger.info(`Found ${relevantChunks.length} relevant document chunks.`);
            }
        } catch (error) {
            logger.warn({ err: error }, 'Vector search failed or skipped (e.g., pgvector not ready)');
        }

        // 2. Generate and execute SQL for structured data using the standalone question
        const sqlQuery = await this.generateSQL(standaloneQuestion, tenantId);
        let sqlResults = null;
        
        if (sqlQuery && sqlQuery !== "INVALID_QUESTION") {
            logger.info(`Generated SQL: ${sqlQuery}`);
            if (!this.isSafeQuery(sqlQuery)) {
                return { text: "🚨 ALERTĂ: Interogarea a fost blocată de sistemul de securitate.", chartUrl: null, isError: true };
            }
            try {
                sqlResults = await this.dbService.query(sqlQuery);
            } catch (err) {
                logger.error({ err }, "SQL Execution failed");
            }
        }

        const historyText = conversationHistory.length > 0 
            ? `\nIstoric conversație (ultimele mesaje):\n${conversationHistory.join('\n')}\n` 
            : "";

        const combinedPrompt = `You are a friendly, highly competent human-like data analyst colleague on Slack. Speak naturally and warmly. Use natural conversational transitions (e.g., 'Sure thing, let me pull those numbers for you...', 'Here's what I found...', 'Hmm, it looks like...'). CRITICAL: NEVER use robotic phrases like 'As an AI', 'Based on the provided SQL data', 'The JSON shows', or 'I am programmed to'. Present the data as if you just looked it up in your own files.

You have access to two data sources:
1. SQL Database Data (obtained via query: ${sqlQuery || 'N/A'}): ${JSON.stringify(sqlResults)}
2. PDF Document Context (if any): ${documentContext}
${historyText ? `\nConversation History:\n${historyText}\n` : ''}

CRITICAL RULES:
1. You must output ONLY a valid JSON object with three keys: "text" (your formatted response in the user's language), "chartUrl" (a string, or null), and "isError" (boolean).
2. If the user explicitly asks for a graph, chart, pie chart, or visual representation of the SQL data, construct a valid QuickChart.io URL (e.g., 'https://quickchart.io/chart?c={type:"bar",data:{labels:[...],datasets:[{label:"...",data:[...]}]}}') and put it in "chartUrl". Make sure to properly URL-encode the JSON configuration inside the URL if necessary, though raw JSON string is often accepted by QuickChart. If no chart is requested, set "chartUrl" to null.
3. LANGUAGE ENFORCEMENT: The "text" field MUST be in the EXACT same language as the user's question. This is non-negotiable.
4. If the data is empty, missing, or the user's query is ambiguous, do NOT say 'error' or 'not found'. Instead, gracefully ask a clarifying question in the user's language inside the "text" field.
5. Format your "text" beautifully using STRICT Slack mrkdwn. CRITICAL: For bold text in Slack, you MUST use a single asterisk (*bold*), NOT double asterisks (**bold**). Do NOT use any emojis in your response.`;

        try {
            const response = await this.openai.chat.completions.create({ 
                model: 'gpt-4o-mini', 
                messages: [
                    { role: 'system', content: combinedPrompt }, 
                    { role: 'user', content: question }
                ],
                response_format: { type: "json_object" },
                temperature: 0.2 
            });

            const rawContent = response.choices[0].message.content || "{}";
            const parsed = JSON.parse(rawContent);

            let finalText = parsed.text || "Nu am putut formula un răspuns.";
            
            // Programmatic fallback to fix LLM's stubborn markdown habits:
            // Convert standard bold (**text**) to Slack bold (*text*)
            finalText = finalText.replace(/\*\*/g, '*');

            return { 
                text: finalText,
                chartUrl: parsed.chartUrl || null,
                isError: parsed.isError || false
            };
        } catch (error) {
            logger.error({ err: error }, "LLM Response Generation failed");
            return { text: "Internal processing error during AI response generation.", chartUrl: null, isError: true };
        }
    }
}
