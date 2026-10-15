"use client";

import * as React from "react";
import { Activity, ArrowUpRight, Loader2, ServerCrash } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { ApiClient, WorkspaceOverview } from "@/lib/api-client";

const TENANT_ID = process.env.NEXT_PUBLIC_TENANT_ID || "default_tenant";

export default function UsagePage() {
  const [overview, setOverview] = React.useState<WorkspaceOverview | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    ApiClient.getOverview(TENANT_ID)
      .then((data) => {
        if (!cancelled) setOverview(data);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const currentQueries = overview?.current_period_queries ?? 0;
  const includedQueries = overview?.quota_limit ?? 200;
  const percentage = Math.min(Math.round((currentQueries / includedQueries) * 100), 100);
  const overageQueries = Math.max(0, currentQueries - includedQueries);
  const overageCharge = (Math.ceil(overageQueries / 100) * 10).toFixed(2);

  const subscriptionStatusLabel = (status: string) => {
    switch (status) {
      case "active": return { label: "Active", color: "text-emerald-600", bg: "bg-emerald-500/10" };
      case "free_trial": return { label: "Free Trial", color: "text-blue-600", bg: "bg-blue-500/10" };
      case "past_due": return { label: "Past Due", color: "text-amber-600", bg: "bg-amber-500/10" };
      case "canceled": return { label: "Canceled", color: "text-red-600", bg: "bg-red-500/10" };
      case "inactive": return { label: "Inactive", color: "text-slate-500", bg: "bg-slate-500/10" };
      default: return { label: status, color: "text-slate-500", bg: "bg-slate-500/10" };
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
        <ServerCrash className="h-10 w-10 text-destructive" />
        <p className="text-sm font-medium">Failed to load usage data</p>
        <p className="text-xs">{error}</p>
      </div>
    );
  }

  const statusInfo = subscriptionStatusLabel(overview?.subscription_status ?? "free_trial");

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Activity className="h-6 w-6 text-primary" />
          Usage &amp; Metered Billing
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Real-time query volume, included monthly thresholds, and Lemon Squeezy metered overage charges.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Metric 1 */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Current Period Inquiries</CardDescription>
            <CardTitle className="text-3xl font-extrabold">{currentQueries}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">
              {includedQueries - currentQueries > 0
                ? `${includedQueries - currentQueries} queries remaining in base allocation`
                : `${overageQueries} overage queries billed at $10/100`}
            </div>
            <div className="mt-3 h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${currentQueries > includedQueries ? "bg-destructive" : "bg-primary"}`}
                style={{ width: `${percentage}%` }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Metric 2 */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Active Scheduled Reports</CardDescription>
            <CardTitle className="text-3xl font-extrabold text-primary">{overview?.active_reports ?? 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">
              Automated Slack reports running on cron schedule
            </div>
          </CardContent>
        </Card>

        {/* Metric 3 */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Current Overage Charge</CardDescription>
            <CardTitle className="text-3xl font-extrabold">${overageCharge}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">
              Tier: $10 per 100 queries beyond {includedQueries} base queries
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Subscription Status</CardTitle>
          <CardDescription className="text-xs">
            Managed via Lemon Squeezy Merchant of Record.{" "}
            {overview?.db_connected ? "✓ External database connected." : "⚠ No external database configured."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">RevOps Pro Plan</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusInfo.bg} ${statusInfo.color}`}>
                  {statusInfo.label}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {overview?.subscription_status === "free_trial"
                  ? "You are on the free trial. Upgrade to unlock full capacity."
                  : "Next billing renewal on the 1st of next month. Current period queries reset to 0 automatically."}
              </p>
            </div>

            <Link
              href={process.env.NEXT_PUBLIC_LEMON_SQUEEZY_CHECKOUT_URL ?? "https://databot.lemonsqueezy.com/billing"}
              target="_blank"
              className={buttonVariants({
                variant: "outline",
                size: "sm",
                className: "gap-1.5",
              })}
            >
              Manage Subscription
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
