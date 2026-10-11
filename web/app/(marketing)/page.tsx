import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ShieldCheck,
  Lock,
  Zap,
  ArrowRight,
  CheckCircle2,
  FileSpreadsheet,
  Sparkles,
  Layers,
} from "lucide-react";

export default function MarketingPage() {
  return (
    <div className="flex flex-col gap-24 pb-20">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-20 md:pt-28 lg:pt-32">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-semibold text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Next-Gen RevOps AI Assistant for Slack</span>
            </div>

            <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl text-foreground">
              Instant Pipeline Answers in Slack.{" "}
              <span className="bg-gradient-to-r from-primary via-indigo-600 to-sky-600 bg-clip-text text-transparent">
                Zero SQL Required.
              </span>
            </h1>

            <p className="text-lg text-muted-foreground sm:text-xl leading-relaxed">
              Empower sales reps, executives, and finance to query revenue data, deal velocity, and ERP stock in natural language. Powered by deterministic Text-to-SQL, verified formulas, and automated PDF delivery.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <Link
                href="https://databot.lemonsqueezy.com/checkout/buy/sample-plan"
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants({
                  size: "lg",
                  className: "w-full sm:w-auto h-12 px-8 text-base shadow-lg shadow-primary/20",
                })}
              >
                Get DataBot on Lemon Squeezy
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
              <Link
                href="/metrics"
                className={buttonVariants({
                  size: "lg",
                  variant: "outline",
                  className: "w-full sm:w-auto h-12 px-8 text-base",
                })}
              >
                Explore Metric Builder
              </Link>
            </div>

            <div className="flex items-center justify-center gap-6 pt-6 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" /> 100% Read-Only Protected
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Bounded by Canonical Metrics
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Automated Weekly PDFs
              </span>
            </div>
          </div>

          {/* Interactive Slack Mockup */}
          <div className="mx-auto mt-16 max-w-4xl rounded-xl border bg-card p-4 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-4 mb-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-rose-500" />
                <div className="h-3 w-3 rounded-full bg-amber-500" />
                <div className="h-3 w-3 rounded-full bg-emerald-500" />
                <span className="ml-2 font-mono font-medium text-foreground">#revops-insights (Slack)</span>
              </div>
              <span className="rounded bg-muted px-2 py-0.5 font-mono text-[10px]">DataBot v2.4</span>
            </div>

            {/* Simulated Slack Thread */}
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-xs font-bold text-white">
                  VP
                </div>
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="font-semibold text-sm">Elena Rostova (VP Sales)</span>
                    <span className="text-[11px] text-muted-foreground">10:14 AM</span>
                  </div>
                  <p className="mt-1 text-sm bg-muted/40 p-2.5 rounded-lg border">
                    <span className="font-semibold text-primary">@DataBot</span> Can you pull our Q3 Win Rate by Rep and attach an executive PDF report?
                  </p>
                </div>
              </div>

              {/* Bot Response */}
              <div className="ml-4 flex items-start gap-3 border-l-2 border-primary/40 pl-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
                  DB
                </div>
                <div className="w-full space-y-2">
                  <div className="flex items-baseline gap-2">
                    <span className="font-semibold text-sm">DataBot</span>
                    <span className="rounded bg-primary/10 px-1.5 py-0.2 text-[10px] font-semibold text-primary">APP</span>
                    <span className="text-[11px] text-muted-foreground">10:14 AM</span>
                  </div>
                  <div className="rounded-lg border bg-background p-4 shadow-sm space-y-3">
                    <div className="font-semibold text-sm border-b pb-2 flex items-center justify-between">
                      <span>DataBot Insights</span>
                      <span className="text-xs text-emerald-600 font-mono">⚡ Semantic Cache Hit (0.42s)</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Sure thing, here is how our reps performed in Q3 based on the canonical Win Rate metric:
                    </p>
                    <ul className="text-xs space-y-1 text-foreground font-medium">
                      <li>• *Sarah Jenkins:* 42.8% (18 won / 42 total)</li>
                      <li>• *Michael Chang:* 38.1% (16 won / 42 total)</li>
                      <li>• *Alex Morales:* 31.4% (11 won / 35 total)</li>
                    </ul>
                    <div className="flex items-center gap-3 pt-2">
                      <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2 text-xs">
                        <FileSpreadsheet className="h-4 w-4 text-primary" />
                        <div>
                          <p className="font-medium">DataBot_RevOps_Report_Q3.pdf</p>
                          <p className="text-[10px] text-muted-foreground">Downloadable Executive Report (A4)</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Security Section */}
      <section id="security" className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center space-y-4 mb-12">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl text-foreground">
            Enterprise Security Architecture
          </h2>
          <p className="text-muted-foreground text-sm sm:text-base">
            Engineered from day one for strict compliance and Zero-Trust database isolation.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="border-border/60 hover:border-primary/50 transition-colors">
            <CardHeader>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 mb-2">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <CardTitle className="text-base">Strictly Read-Only</CardTitle>
              <CardDescription className="text-xs">
                Enforced at the PostgreSQL connection level via <code className="bg-muted px-1 rounded text-[11px]">default_transaction_read_only=on</code>. Zero write or drop capability.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              Guarantees that no natural language query or hallucinated SQL can ever mutate or drop corporate records.
            </CardContent>
          </Card>

          <Card className="border-border/60 hover:border-primary/50 transition-colors">
            <CardHeader>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 mb-2">
                <Layers className="h-5 w-5" />
              </div>
              <CardTitle className="text-base">Workspace Isolation</CardTitle>
              <CardDescription className="text-xs">
                Multi-tenant data partitioning. Every single RAG vector chunk and query cache row is partitioned by Slack Workspace ID.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              Zero possibility of cross-tenant data leaks. Workspaces never share execution pools or conversational context.
            </CardContent>
          </Card>

          <Card className="border-border/60 hover:border-primary/50 transition-colors">
            <CardHeader>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 mb-2">
                <Lock className="h-5 w-5" />
              </div>
              <CardTitle className="text-base">AES-256-GCM Encryption</CardTitle>
              <CardDescription className="text-xs">
                External RevOps credentials (HubSpot/Salesforce database syncs) are encrypted with authenticated GCM tags.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              Credentials are only decrypted in-memory during ephemeral query execution, preventing storage leaks.
            </CardContent>
          </Card>

          <Card className="border-border/60 hover:border-primary/50 transition-colors">
            <CardHeader>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600 mb-2">
                <Zap className="h-5 w-5" />
              </div>
              <CardTitle className="text-base">Semantic Caching</CardTitle>
              <CardDescription className="text-xs">
                Cosine similarity matching (&gt; 0.96) over 24-hour periods protects your OpenAI API margins.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              Frequent questions return instant sub-second answers without hitting third-party LLM providers.
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Pricing / Lemon Squeezy Section */}
      <section id="pricing" className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center space-y-4 mb-12">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl text-foreground">
            Simple, Transparent RevOps Pricing
          </h2>
          <p className="text-muted-foreground text-sm sm:text-base">
            Start with our base plan and scale as your Slack workspace grows.
          </p>
        </div>

        <div className="mx-auto max-w-lg">
          <Card className="border-2 border-primary shadow-xl">
            <CardHeader className="text-center pb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-primary">RevOps Pro Plan</span>
              <div className="mt-4 flex items-baseline justify-center gap-1">
                <span className="text-5xl font-extrabold tracking-tight">$99</span>
                <span className="text-sm font-medium text-muted-foreground">/ month</span>
              </div>
              <CardDescription className="mt-2 text-xs">
                Includes 200 high-speed verified queries per month
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4 pt-4">
              <ul className="space-y-3 text-sm">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span>Slack Bot with Block Kit & Real-Time Charts</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span>Metric Builder & Context Hub</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span>Automated PDF Export & Slack Thread Delivery</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span>Recurring CRON Report Scheduling</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span>Overage: $10 per 100 extra queries (metered)</span>
                </li>
              </ul>

              <Link
                href="https://databot.lemonsqueezy.com/checkout/buy/sample-plan"
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants({
                  size: "lg",
                  className: "w-full mt-6",
                })}
              >
                Buy License via Lemon Squeezy
              </Link>
              <p className="text-center text-[11px] text-muted-foreground">
                Instant delivery. 14-day money-back guarantee.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
