import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | DataBot AI",
  description: "Privacy Policy and data processing terms for DataBot AI.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="space-y-8">
        <header className="border-b pb-6">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Privacy Policy</h1>
          <p className="mt-2 text-sm text-muted-foreground">Last Updated: October 11, 2026</p>
        </header>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">1. Introduction</h2>
          <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
            Welcome to DataBot AI (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;). We are committed to protecting your privacy. This Privacy Policy explains how we collect, use, and share information when you use our Slack integration and web dashboard (the &quot;Service&quot;).
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">2. Data Processor vs. Merchant of Record</h2>
          <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
            For the purposes of the General Data Protection Regulation (GDPR), we act as a Data Processor for the data transmitted through our Service.
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
            Our order process is conducted by our online reseller, Lemon Squeezy. Lemon Squeezy is the Merchant of Record for all our orders. They handle your payment information, billing, and EU VAT collection. We do not store or process your credit card details. Please refer to Lemon Squeezy’s Privacy Policy for how they handle your payment data.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">3. Information We Collect and Process</h2>
          <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
            To provide our Text-to-SQL AI Service, we collect and process the following:
          </p>
          <ul className="list-disc space-y-2 pl-6 text-sm leading-relaxed text-muted-foreground sm:text-base">
            <li>
              <strong className="text-foreground">Account Metadata:</strong> Your Slack Team ID, User ID, and email address for account provisioning.
            </li>
            <li>
              <strong className="text-foreground">Database Schemas:</strong> We extract and temporarily cache your database schema (table names, column names, and data types) to enable the AI to write accurate SQL queries.
            </li>
            <li>
              <strong className="text-foreground">Transient Queries:</strong> The natural language questions you type into Slack.
            </li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">4. What We DO NOT Store (Zero Data Persistence)</h2>
          <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
            We employ a strictly &quot;pass-through&quot; architecture. We do not read, extract, or store the row-level data inside your database (e.g., your customer names, private records, or financial data). When a query is executed, the results are formatted into a temporary PDF report and immediately discarded from our servers once delivered to your Slack channel.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">5. Third-Party Sub-Processors</h2>
          <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
            We share necessary metadata with the following trusted sub-processors to run the Service:
          </p>
          <ul className="list-disc space-y-2 pl-6 text-sm leading-relaxed text-muted-foreground sm:text-base">
            <li>
              <strong className="text-foreground">OpenAI, LLC:</strong> We send your database schema and natural language questions to OpenAI via their enterprise API to generate SQL. OpenAI does not use API data to train their public models.
            </li>
            <li>
              <strong className="text-foreground">Lemon Squeezy:</strong> For subscription management and invoicing.
            </li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">6. Contact Us</h2>
          <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
            If you have questions about how your data is handled or wish to request data deletion under GDPR, please contact us at:{" "}
            <a
              href="mailto:support@databot.ai"
              className="font-medium text-primary underline underline-offset-4 hover:text-primary/80"
            >
              support@databot.ai
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
