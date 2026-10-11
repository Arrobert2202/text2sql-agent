import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "cn";
import { Database, ShieldCheck, Zap } from "lucide-react";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Top Marketing Navigation */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md">
        <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2 font-bold tracking-tight text-foreground hover:opacity-90">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
                <Database className="h-5 w-5" />
              </div>
              <span className="text-xl">DataBot</span>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                RevOps
              </span>
            </Link>
            <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
              <Link href="#features" className="hover:text-foreground transition-colors">
                Features
              </Link>
              <Link href="#security" className="hover:text-foreground transition-colors">
                Security Architecture
              </Link>
              <Link href="#pricing" className="hover:text-foreground transition-colors">
                Pricing
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/metrics"
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              Dashboard
            </Link>
            <Link
              href="https://databot.lemonsqueezy.com/checkout/buy/sample-plan"
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                buttonVariants({ size: "sm" }),
                "bg-primary text-primary-foreground hover:bg-primary/90"
              )}
            >
              Get DataBot
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">{children}</main>

      {/* Global Footer */}
      <footer className="border-t bg-muted/40 py-12 text-sm text-muted-foreground">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2 font-bold text-foreground">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
                  <Database className="h-4 w-4" />
                </div>
                <span>DataBot</span>
              </div>
              <p className="text-xs leading-relaxed">
                Enterprise AI Text-to-SQL colleague for Slack. Built strictly for RevOps teams who require zero hallucination and zero write permissions.
              </p>
            </div>

            <div>
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-foreground">Product</h4>
              <ul className="space-y-2 text-xs">
                <li><Link href="/metrics" className="hover:text-foreground">Metric Builder</Link></li>
                <li><Link href="/settings" className="hover:text-foreground">RevOps DB Settings</Link></li>
                <li><Link href="#pricing" className="hover:text-foreground">Metered Pricing</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-foreground">Trust & Security</h4>
              <ul className="space-y-2 text-xs">
                <li className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Read-Only Enforcement</li>
                <li className="flex items-center gap-1.5"><Zap className="h-3.5 w-3.5 text-indigo-600" /> AES-256-GCM Encrypted</li>
                <li><Link href="#security" className="hover:text-foreground">Security Overview</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-foreground">Legal & Compliance</h4>
              <ul className="space-y-2 text-xs">
                <li><Link href="/terms-of-service" className="hover:text-foreground">Terms of Service</Link></li>
                <li><Link href="/privacy-policy" className="hover:text-foreground">Privacy Policy</Link></li>
                <li><span className="text-[11px] text-muted-foreground/80">Payments securely processed by Lemon Squeezy</span></li>
              </ul>
            </div>
          </div>

          <div className="mt-8 border-t pt-6 text-center text-xs text-muted-foreground">
            &copy; 2026 DataBot Inc. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
