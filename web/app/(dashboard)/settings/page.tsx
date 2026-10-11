"use client";

import * as React from "react";
import { Database, ShieldCheck, KeyRound, Loader2, CheckCircle2, AlertCircle, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ApiClient, type DbConfigPayload } from "@/lib/api-client";

export default function SettingsPage() {
  const [formData, setFormData] = React.useState<DbConfigPayload>({
    host: "",
    port: 5432,
    database: "",
    user: "",
    password: "",
    ssl: true,
  });

  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isTesting, setIsTesting] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const [testResult, setTestResult] = React.useState<{ success: boolean; message: string } | null>(null);

  // Load existing configuration on mount
  React.useEffect(() => {
    async function loadConfig() {
      try {
        const config = await ApiClient.getDbConfig("default_tenant");
        if (config) {
          setFormData({
            host: config.host || "",
            port: config.port || 5432,
            database: config.database || "",
            user: config.user || "",
            password: config.password || "",
            ssl: config.ssl ?? true,
          });
        }
      } catch {
        // Fallback for initial load if server is starting
      } finally {
        setIsLoading(false);
      }
    }
    loadConfig();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : name === "port" ? Number(value) : value,
    }));
  };

  const handleTestConnection = async () => {
    if (!formData.host || !formData.database || !formData.user) {
      toast.error("Please fill in Host, Database, and User before testing.");
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const res = await ApiClient.testDbConnection(formData);
      setTestResult({ success: true, message: res.message });
      toast.success(res.message);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Connection test failed.";
      setTestResult({ success: false, message });
      toast.error(message);
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.host || !formData.database || !formData.user) {
      toast.error("Host, Database name, and User are required.");
      return;
    }

    setIsSaving(true);
    try {
      const res = await ApiClient.updateDbConfig("default_tenant", formData);
      toast.success(res.message);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save configuration.";
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Database className="h-6 w-6 text-primary" />
          External RevOps Database Connection
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Connect your synced warehouse or transactional PostgreSQL database (HubSpot, Salesforce, Stripe, ERP).
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Connection Form */}
        <div className="md:col-span-2">
          <Card>
            <form onSubmit={handleSave}>
              <CardHeader>
                <CardTitle className="text-base font-semibold">PostgreSQL Credentials</CardTitle>
                <CardDescription className="text-xs">
                  Passwords are encrypted at rest using AES-256-GCM. We enforce read-only transactions at the socket layer.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">Host / Endpoint</label>
                    <Input
                      name="host"
                      placeholder="e.g. aws-0-eu-central-1.pooler.supabase.com"
                      value={formData.host}
                      onChange={handleChange}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">Port</label>
                    <Input
                      name="port"
                      type="number"
                      placeholder="5432"
                      value={formData.port}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Database Name</label>
                  <Input
                    name="database"
                    placeholder="e.g. postgres or revops_prod"
                    value={formData.database}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">Database User</label>
                    <Input
                      name="user"
                      placeholder="e.g. databot_readonly"
                      value={formData.user}
                      onChange={handleChange}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">Password</label>
                    <div className="relative">
                      <Input
                        name="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••••••"
                        value={formData.password}
                        onChange={handleChange}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="ssl"
                    name="ssl"
                    checked={formData.ssl}
                    onChange={handleChange}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <label htmlFor="ssl" className="text-xs font-medium text-foreground cursor-pointer">
                    Enable SSL / TLS Connection (Recommended for cloud databases)
                  </label>
                </div>

                {/* Connection Test Banner */}
                {testResult && (
                  <div
                    className={`mt-4 rounded-lg p-3 text-xs flex items-start gap-2.5 border ${
                      testResult.success
                        ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-500/20"
                        : "bg-destructive/10 text-destructive border-destructive/20"
                    }`}
                  >
                    {testResult.success ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    )}
                    <p className="leading-relaxed">{testResult.message}</p>
                  </div>
                )}
              </CardContent>

              <CardFooter className="flex items-center justify-between border-t bg-muted/20 px-6 py-4">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isTesting}
                  onClick={handleTestConnection}
                >
                  {isTesting && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                  Test Connection
                </Button>

                <Button type="submit" size="sm" disabled={isSaving}>
                  {isSaving && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                  Save Credentials
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>

        {/* Security Overview Sidebar */}
        <div className="space-y-4">
          <Card className="bg-primary/5 border-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-primary">
                <ShieldCheck className="h-4 w-4" />
                Read-Only Enforcement
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground space-y-2 leading-relaxed">
              <p>
                When DataBot connects to this database, it establishes sessions with <code className="bg-background px-1 py-0.5 rounded font-mono text-[10px]">SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY;</code>.
              </p>
              <p>
                Even if the user account has write privileges, PostgreSQL will unconditionally reject any mutating statements.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-amber-600" />
                Encryption Standard
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground space-y-2 leading-relaxed">
              <p>
                Credentials stored in the <code className="bg-muted px-1 rounded text-[10px]">workspaces</code> table are protected with authenticated AES-256-GCM ciphers.
              </p>
              <p>
                Authentication tags prevent ciphertext tampering and integrity attacks.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

