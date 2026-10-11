"use client";

import * as React from "react";
import { Plus, Search, Trash2, Copy, Check, Calculator, Sparkles } from "lucide-react";
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

export interface MetricDefinition {
  id: string;
  name: string;
  alias: string;
  category: "Sales" | "Pipeline" | "Finance" | "Inventory";
  description: string;
  sqlFormula: string;
  verified: boolean;
}

const initialMetrics: MetricDefinition[] = [
  {
    id: "m-1",
    name: "Win Rate",
    alias: "win_rate",
    category: "Sales",
    description: "Percentage of closed-won opportunities over all closed deals.",
    sqlFormula: "(COUNT(CASE WHEN stage = 'Closed Won' THEN 1 END)::float / NULLIF(COUNT(CASE WHEN stage IN ('Closed Won', 'Closed Lost') THEN 1 END), 0)) * 100",
    verified: true,
  },
  {
    id: "m-2",
    name: "Pipeline Velocity",
    alias: "pipeline_velocity",
    category: "Pipeline",
    description: "Speed at which qualified leads convert into recognized revenue.",
    sqlFormula: "(COUNT(id) * AVG(amount) * (win_rate / 100)) / NULLIF(AVG(sales_cycle_days), 0)",
    verified: true,
  },
  {
    id: "m-3",
    name: "Average Deal Size",
    alias: "avg_deal_size",
    category: "Sales",
    description: "Average ARR/ACV value across all closed-won contracts.",
    sqlFormula: "AVG(amount) FILTER (WHERE stage = 'Closed Won')",
    verified: true,
  },
  {
    id: "m-4",
    name: "Gross Churn Rate",
    alias: "gross_churn",
    category: "Finance",
    description: "Total lost recurring revenue as a proportion of beginning MRR.",
    sqlFormula: "(SUM(churned_mrr) / NULLIF(SUM(starting_mrr), 0)) * 100",
    verified: true,
  },
  {
    id: "m-5",
    name: "Low Stock Alert Threshold",
    alias: "stock_critical",
    category: "Inventory",
    description: "Items currently below reserve operating threshold.",
    sqlFormula: "COUNT(*) FILTER (WHERE stock < 15)",
    verified: true,
  },
];

export default function MetricsPage() {
  const [metrics, setMetrics] = React.useState<MetricDefinition[]>(initialMetrics);
  const [search, setSearch] = React.useState("");
  const [isOpen, setIsOpen] = React.useState(false);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  // Form State
  const [name, setName] = React.useState("");
  const [alias, setAlias] = React.useState("");
  const [category, setCategory] = React.useState<"Sales" | "Pipeline" | "Finance" | "Inventory">("Sales");
  const [description, setDescription] = React.useState("");
  const [sqlFormula, setSqlFormula] = React.useState("");

  const filteredMetrics = metrics.filter(
    (m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.sqlFormula.toLowerCase().includes(search.toLowerCase()) ||
      m.category.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !sqlFormula) {
      toast.error("Please fill in both the Metric Name and SQL Formula.");
      return;
    }

    const newMetric: MetricDefinition = {
      id: `m-${Date.now()}`,
      name,
      alias: alias || name.toLowerCase().replace(/\s+/g, "_"),
      category,
      description: description || "Custom user-defined canonical metric.",
      sqlFormula,
      verified: true,
    };

    setMetrics([newMetric, ...metrics]);
    setIsOpen(false);

    // Reset Form
    setName("");
    setAlias("");
    setDescription("");
    setSqlFormula("");

    toast.success(`Metric "${newMetric.name}" created and synced with DataBot AI!`);
  };

  const handleDelete = (id: string, metricName: string) => {
    setMetrics(metrics.filter((m) => m.id !== id));
    toast.info(`Deleted metric "${metricName}".`);
  };

  const handleCopy = (id: string, formula: string) => {
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
                <div className="grid grid-cols-2 gap-4">
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
                    <label className="text-xs font-semibold text-foreground">Key / Alias</label>
                    <Input
                      placeholder="e.g. nrr"
                      value={alias}
                      onChange={(e) => setAlias(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Category</label>
                  <select
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    value={category}
                    onChange={(e) => setCategory(e.target.value as MetricDefinition["category"])}
                  >
                    <option value="Sales">Sales Performance</option>
                    <option value="Pipeline">Pipeline & Opportunities</option>
                    <option value="Finance">Finance & Revenue</option>
                    <option value="Inventory">Inventory & Supply Chain</option>
                  </select>
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
                    placeholder="e.g. ((Ending MRR - Churn) / Starting MRR) * 100"
                    value={sqlFormula}
                    onChange={(e) => setSqlFormula(e.target.value)}
                    required
                  />
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Save Metric</Button>
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
                {metrics.length} metrics registered. Active across all tagged Slack threads.
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
                  <TableHead className="w-[180px]">Metric Name</TableHead>
                  <TableHead className="w-[100px]">Category</TableHead>
                  <TableHead className="min-w-[280px]">Deterministic SQL Formula</TableHead>
                  <TableHead className="hidden md:table-cell">Description</TableHead>
                  <TableHead className="w-[100px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {filteredMetrics.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center text-sm text-muted-foreground">
                      No metrics found matching &quot;{search}&quot;.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredMetrics.map((metric) => (
                    <TableRow key={metric.id}>
                      <TableCell className="font-medium">
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-foreground">{metric.name}</span>
                          <span className="font-mono text-[11px] text-muted-foreground">@{metric.alias}</span>
                        </div>
                      </TableCell>

                      <TableCell>
                        <span className="inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                          {metric.category}
                        </span>
                      </TableCell>

                      <TableCell>
                        <div className="group relative rounded bg-muted/60 p-2 font-mono text-xs text-foreground/90 border">
                          <span className="break-all">{metric.sqlFormula}</span>
                          <button
                            onClick={() => handleCopy(metric.id, metric.sqlFormula)}
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
                        {metric.description}
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
