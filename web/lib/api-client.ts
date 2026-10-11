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

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

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

