"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Icons } from "@/components/icons";
import Link from "next/link";

export default function MainSidebar() {
  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarTrigger />
        <SidebarContent>
          <SidebarHeader>
            diariodigital
          </SidebarHeader>
          <SidebarGroup>
            <SidebarMenu>
              <SidebarMenuItem>
                <Link href="/">
                  <SidebarMenuButton>
                    <Icons.home className="mr-2 h-4 w-4" />
                    <span>Home</span>
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <Link href="/journal">
                  <SidebarMenuButton>
                    <Icons.book className="mr-2 h-4 w-4" />
                    <span>Journal</span>
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <Link href="/attendance">
                  <SidebarMenuButton>
                    <Icons.calendar className="mr-2 h-4 w-4" />
                    <span>Attendance</span>
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <Link href="/grades">
                  <SidebarMenuButton>
                    <Icons.barChart className="mr-2 h-4 w-4" />
                    <span>Grades</span>
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <Link href="/ai-insights">
                  <SidebarMenuButton>
                    <Icons.brain className="mr-2 h-4 w-4" />
                    <span>AI Insights</span>
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
          <SidebarFooter>
            <p className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} diariodigital
            </p>
          </SidebarFooter>
        </SidebarContent>
      </Sidebar>
    </SidebarProvider>
  );
}

