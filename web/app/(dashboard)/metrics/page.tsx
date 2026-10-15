"use client";

import * as React from "react";
import { Plus, Search, Trash2, Copy, Check, Calculator, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ApiClient, GovernedMetric } from "@/lib/api-client";

const TENANT_ID = process.env.NEXT_PUBLIC_TENANT_ID || "default_tenant";

export default function MetricsPage() {
  const [metrics, setMetrics] = React.useState<GovernedMetric[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [isOpen, setIsOpen] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [copiedId, setCopiedId] = React.useState<number | null>(null);

  // Form State
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [sqlFormula, setSqlFormula] = React.useState("");

  // Fetch metrics from live backend on mount
  React.useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    ApiClient.getMetrics(TENANT_ID)
      .then((data) => {
        if (!cancelled) setMetrics(data);
      })
      .catch((err: Error) => {
        if (!cancelled) toast.error(`Failed to load metrics: ${err.message}`);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const filteredMetrics = metrics.filter(
    (m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.sql_formula.toLowerCase().includes(search.toLowerCase()) ||
      (m.description ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !sqlFormula) {
      toast.error("Please fill in both the Metric Name and SQL Formula.");
      return;
    }

    setIsSaving(true);
    try {
      const created = await ApiClient.createMetric(TENANT_ID, {
        name,
        description: description || undefined,
        sql_formula: sqlFormula,
      });
      // Optimistic prepend
      setMetrics((prev) => [created, ...prev]);
      setIsOpen(false);
      setName("");
      setDescription("");
      setSqlFormula("");
      toast.success(`Metric "${created.name}" created and injected into DataBot AI!`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast.error(`Failed to create metric: ${msg}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number, metricName: string) => {
    // Optimistic UI update
    setMetrics((prev) => prev.filter((m) => m.id !== id));
    try {
      await ApiClient.deleteMetric(TENANT_ID, id);
      toast.info(`Deleted metric "${metricName}".`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast.error(`Failed to delete metric: ${msg}`);
      // Re-fetch on failure to restore correct state
      ApiClient.getMetrics(TENANT_ID)
        .then(setMetrics)
        .catch(() => {});
    }
  };

  const handleCopy = (id: number, formula: string) => {
    navigator.clipboard.writeText(formula);
    setCopiedId(id);
    toast.success("SQL Formula copied to clipboard!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Calculator className="h-6 w-6 text-primary" />
            Canonical Metric Builder
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Authoritative RevOps formulas injected directly into DataBot&apos;s schema prompt to eliminate AI hallucination.
          </p>
        </div>

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger
            render={
              <Button className="shrink-0 gap-2">
                <Plus className="h-4 w-4" />
                Create Metric
              </Button>
            }
          />

          <DialogContent className="sm:max-w-[550px]">
            <form onSubmit={handleCreate}>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Define Canonical Metric
                </DialogTitle>
                <DialogDescription>
                  When users in Slack ask for this metric, DataBot will strictly compute it using this SQL formula.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Metric Name</label>
                  <Input
                    placeholder="e.g. Net Revenue Retention"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Description</label>
                  <Input
                    placeholder="Short description of what this metric calculates"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Deterministic SQL Expression / Formula
                  </label>
                  <textarea
                    className="w-full min-h-[90px] rounded-md border bg-muted/40 p-2.5 font-mono text-xs shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="e.g. SELECT AVG(deal_value) FROM deals WHERE status = 'closed_won'"
                    value={sqlFormula}
                    onChange={(e) => setSqlFormula(e.target.value)}
                    required
                  />
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)} disabled={isSaving}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : "Save Metric"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Metrics Card & Table */}
      <Card>
        <CardHeader className="p-4 sm:p-6 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-base font-semibold">Configured Enterprise Metrics</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                {isLoading ? "Loading..." : `${metrics.length} metrics registered. Active across all tagged Slack threads.`}
              </CardDescription>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search formulas or names..."
                className="pl-8 text-xs h-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="w-[200px]">Metric Name</TableHead>
                  <TableHead className="min-w-[280px]">Deterministic SQL Formula</TableHead>
                  <TableHead className="hidden md:table-cell">Description</TableHead>
                  <TableHead className="w-[100px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-32 text-center text-sm text-muted-foreground">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading metrics from backend...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredMetrics.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-32 text-center text-sm text-muted-foreground">
                      {search ? `No metrics found matching "${search}".` : "No metrics defined yet. Click \"Create Metric\" to add your first canonical formula."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredMetrics.map((metric) => (
                    <TableRow key={metric.id}>
                      <TableCell className="font-medium">
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-foreground">{metric.name}</span>
                          <span className="font-mono text-[11px] text-muted-foreground">
                            {new Date(metric.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="group relative rounded bg-muted/60 p-2 font-mono text-xs text-foreground/90 border">
                          <span className="break-all">{metric.sql_formula}</span>
                          <button
                            onClick={() => handleCopy(metric.id, metric.sql_formula)}
                            className="absolute right-1.5 top-1.5 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded bg-background hover:bg-muted"
                            title="Copy Formula"
                          >
                            {copiedId === metric.id ? (
                              <Check className="h-3 w-3 text-emerald-600" />
                            ) : (
                              <Copy className="h-3 w-3 text-muted-foreground" />
                            )}
                          </button>
                        </div>
                      </TableCell>

                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                        {metric.description ?? "—"}
                      </TableCell>

                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:bg-destructive/10"
                          onClick={() => handleDelete(metric.id, metric.name)}
                          title="Delete metric"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
