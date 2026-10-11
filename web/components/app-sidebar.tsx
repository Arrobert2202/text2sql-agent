"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Calculator,
  Database,
  Terminal,
  Activity,
  Bot,
  ExternalLink,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";

const navItems = [
  {
    title: "Metric Builder",
    url: "/metrics",
    icon: Calculator,
  },
  {
    title: "Playground",
    url: "/playground",
    icon: Terminal,
  },
  {
    title: "DB Settings",
    url: "/settings",
    icon: Database,
  },
  {
    title: "Usage & Billing",
    url: "/usage",
    icon: Activity,
  },
];

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="border-b px-4 py-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={<Link href="/metrics" className="flex items-center gap-3" />}
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Bot className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">DataBot Context Hub</span>
                <span className="truncate text-xs text-muted-foreground">RevOps Workspace</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>RevOps Administration</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = pathname === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      isActive={isActive}
                      tooltip={item.title}
                      render={<Link href={item.url} className="flex items-center gap-3 py-2" />}
                    >
                      <item.icon className="size-4 shrink-0" />
                      <span className="font-medium">{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-auto">
          <SidebarGroupLabel>Quick Actions</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  size="sm"
                  render={
                    <Link
                      href="/"
                      target="_blank"
                      className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-2"
                    />
                  }
                >
                  <ExternalLink className="size-3" />
                  <span>Public Landing Page</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t p-3">
        <div className="flex items-center gap-3 rounded-md bg-muted/50 p-2 text-xs">
          <div className="size-2 rounded-full bg-emerald-500 animate-pulse" />
          <div className="flex flex-col truncate">
            <span className="font-medium text-foreground">Slack Gateway Online</span>
            <span className="text-[10px] text-muted-foreground">Tenant: default_tenant</span>
          </div>
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}

