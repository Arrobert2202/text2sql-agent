"use client";

import * as React from "react";
import { Activity, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";

export default function UsagePage() {
  const currentQueries = 42;
  const includedQueries = 200;
  const percentage = Math.round((currentQueries / includedQueries) * 100);

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Activity className="h-6 w-6 text-primary" />
          Usage & Metered Billing
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Monitor real-time query volume, included monthly thresholds, and Stripe metered overage charges.
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
              {includedQueries - currentQueries} queries remaining in base allocation
            </div>
            <div className="mt-3 h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${percentage}%` }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Metric 2 */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Semantic Cache Savings</CardDescription>
            <CardTitle className="text-3xl font-extrabold text-emerald-600">83.4%</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xs text-muted-foreground">
              Bypassed OpenAI API calls via 24h vector similarity match
            </div>
          </CardContent>
        </Card>

        {/* Metric 3 */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Current Overage Charge</CardDescription>
            <CardTitle className="text-3xl font-extrabold">$0.00</CardTitle>
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
            Managed via Lemon Squeezy Merchant of Record & Stripe Billing Meters.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">RevOps Pro Plan</span>
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-600">
                  Active
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Next billing renewal on the 1st of next month. Current period queries reset to 0 automatically.
              </p>
            </div>

            <Link
              href="https://databot.lemonsqueezy.com/billing"
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
