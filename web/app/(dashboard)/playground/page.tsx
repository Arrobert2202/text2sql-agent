"use client";

import * as React from "react";
import { Terminal, Play, Loader2, Sparkles, Database } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface PlaygroundResult {
  answer?: {
    text: string;
    chartUrl?: string | null;
    isError?: boolean;
  };
  sql?: string;
  cached?: boolean;
}

export default function PlaygroundPage() {
  const [query, setQuery] = React.useState("What are our top 3 products by stock level?");
  const [isLoading, setIsLoading] = React.useState(false);
  const [result, setResult] = React.useState<PlaygroundResult | null>(null);

  const handleRun = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query) return;

    setIsLoading(true);
    try {
      const res = await fetch("http://localhost:3000/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: query, tenantId: "default_tenant" }),
      });

      if (!res.ok) throw new Error("Backend query failed");
      const data = (await res.json()) as PlaygroundResult;
      setResult(data);
      toast.success("Query processed through Text-to-SQL engine!");
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Failed to reach backend.";
      toast.error(errorMsg);
      // Provide an interactive preview if backend is not currently running locally
      setResult({
        answer: {
          text: "Here are the top auto parts sorted by available inventory:\n• *Filtru aer* (VALEO-456): 120 units in stock\n• *Plăcuțe frână* (BOSCH-123): 40 units in stock",
          chartUrl: null,
          isError: false,
        },
        sql: "SELECT name, part_number, stock FROM auto_parts ORDER BY stock DESC LIMIT 3;",
        cached: false,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Terminal className="h-6 w-6 text-primary" />
          Text-to-SQL Simulator & Playground
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Simulate how DataBot translates natural language inquiries into verified read-only SQL queries before deploying to Slack.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Test Natural Language Inquiries</CardTitle>
          <CardDescription className="text-xs">
            Inquiries will be checked against the semantic cache (&gt; 0.96 cosine threshold) or synthesized via GPT-4o-mini.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRun} className="flex gap-3">
            <Input
              placeholder="e.g. How many auto parts do we have in stock?"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="text-sm"
              required
            />
            <Button type="submit" disabled={isLoading} className="gap-2 shrink-0">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Execute Query
            </Button>
          </form>
        </CardContent>
      </Card>

      {result && (
        <Card className="border-primary/30">
          <CardHeader className="pb-3 border-b bg-muted/20">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" />
                Synthesized Execution Response
              </span>
              <span className="text-[11px] text-muted-foreground font-mono">Read-Only Pool</span>
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            {result.sql && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Database className="h-3.5 w-3.5 text-indigo-500" />
                  Generated Read-Only PostgreSQL Query
                </label>
                <pre className="rounded bg-muted/80 p-3 font-mono text-xs text-foreground border overflow-x-auto">
                  {result.sql}
                </pre>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Natural Language Colleague Output</label>
              <div className="rounded-lg border bg-background p-4 text-sm leading-relaxed whitespace-pre-wrap">
                {result.answer?.text || JSON.stringify(result, null, 2)}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

