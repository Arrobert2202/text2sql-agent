/**
 * API client utility for communicating with the Express backend
 */

export interface DbConfigPayload {
  host: string;
  port: number;
  database: string;
  user: string;
  password?: string;
  ssl?: boolean;
}

export interface AskQuestionResponse {
  answer?: {
    text: string;
    chartUrl?: string | null;
    isError?: boolean;
  };
  sql?: string;
  cached?: boolean;
}

export interface GovernedMetric {
  id: number;
  tenant_id: string;
  name: string;
  description: string | null;
  sql_formula: string;
  created_at: string;
}

export interface CreateMetricPayload {
  name: string;
  description?: string;
  sql_formula: string;
}

export interface WorkspaceOverview {
  tenant_id: string;
  subscription_status: string;
  current_period_queries: number;
  quota_limit: number;
  db_connected: boolean;
  active_reports: number;
}

export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000").replace(/\/$/, "");

export class ApiClient {
  private static async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers = {
      "Content-Type": "application/json",
      ...options.headers,
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || `Request failed with status ${response.status}`);
      }

      return (await response.json()) as T;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Network request failed. Is the Express server running?";
      throw new Error(msg);
    }
  }

  /**
   * Executes a natural language inquiry via Text-to-SQL API.
   */
  public static async askQuestion(
    question: string,
    tenantId: string = "default_tenant"
  ): Promise<AskQuestionResponse> {
    return this.request<AskQuestionResponse>("/api/ask", {
      method: "POST",
      body: JSON.stringify({ question, tenantId }),
    });
  }

  // ---------------------------------------------------------------------------
  // Workspace Overview
  // ---------------------------------------------------------------------------

  /**
   * Returns workspace subscription status, query usage, DB status, and active reports.
   */
  public static async getOverview(tenantId: string = "default_tenant"): Promise<WorkspaceOverview> {
    return this.request<WorkspaceOverview>(`/api/workspaces/${encodeURIComponent(tenantId)}/overview`);
  }

  // ---------------------------------------------------------------------------
  // Governed Metrics (Context Hub)
  // ---------------------------------------------------------------------------

  /**
   * Returns all governed metrics for a tenant.
   */
  public static async getMetrics(tenantId: string = "default_tenant"): Promise<GovernedMetric[]> {
    return this.request<GovernedMetric[]>(`/api/workspaces/${encodeURIComponent(tenantId)}/metrics`);
  }

  /**
   * Creates a new governed metric for a tenant.
   */
  public static async createMetric(
    tenantId: string = "default_tenant",
    payload: CreateMetricPayload
  ): Promise<GovernedMetric> {
    return this.request<GovernedMetric>(`/api/workspaces/${encodeURIComponent(tenantId)}/metrics`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  /**
   * Deletes a governed metric by ID (tenant-scoped).
   */
  public static async deleteMetric(
    tenantId: string = "default_tenant",
    metricId: number
  ): Promise<{ success: boolean; deleted: string }> {
    return this.request<{ success: boolean; deleted: string }>(
      `/api/workspaces/${encodeURIComponent(tenantId)}/metrics/${metricId}`,
      { method: "DELETE" }
    );
  }

  // ---------------------------------------------------------------------------
  // Database Configuration
  // ---------------------------------------------------------------------------

  /**
   * Retrieves the current external database configuration for a tenant.
   */
  public static async getDbConfig(tenantId: string = "default_tenant"): Promise<DbConfigPayload | null> {
    return this.request<DbConfigPayload | null>(`/api/workspaces/db-config?tenantId=${encodeURIComponent(tenantId)}`);
  }

  /**
   * Saves updated external database configuration (password encrypted with AES-256-GCM on backend).
   */
  public static async updateDbConfig(
    tenantId: string = "default_tenant",
    config: DbConfigPayload
  ): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>("/api/workspaces/db-config", {
      method: "PUT",
      body: JSON.stringify({ tenantId, ...config }),
    });
  }

  /**
   * Tests read-only connectivity and permission verification against external database.
   */
  public static async testDbConnection(
    config: DbConfigPayload
  ): Promise<{ success: boolean; message: string; tableCount?: number }> {
    return this.request<{ success: boolean; message: string; tableCount?: number }>(
      "/api/workspaces/test-connection",
      {
        method: "POST",
        body: JSON.stringify(config),
      }
    );
  }
}
