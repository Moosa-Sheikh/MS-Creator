import { ReactNode, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useLogout, useGetAuthStatus } from "@workspace/api-client-react";
import { LayoutDashboard, Settings, LogOut, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sidebar, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarProvider, SidebarFooter } from "@/components/ui/sidebar";

export function AppLayout({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const { data: auth, isLoading } = useGetAuthStatus();
  const logout = useLogout();

  useEffect(() => {
    if (!isLoading && auth && !auth.authenticated) {
      setLocation("/login");
    }
  }, [isLoading, auth, setLocation]);

  if (isLoading || !auth?.authenticated) {
    return <div className="h-screen w-full flex items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-muted-foreground" /></div>;
  }

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full bg-background overflow-hidden">
        <Sidebar variant="inset" className="border-r border-sidebar-border bg-sidebar">
          <SidebarHeader className="p-4">
            <h2 className="text-lg font-bold text-sidebar-foreground flex items-center gap-2">
              <span className="w-6 h-6 rounded bg-sidebar-primary flex items-center justify-center text-sidebar-primary-foreground text-xs">M</span>
              Mockup Studio
            </h2>
          </SidebarHeader>
          <SidebarContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/" || location.startsWith("/products") || location.startsWith("/session")}>
                  <Link href="/">
                    <LayoutDashboard className="h-4 w-4" />
                    <span>Picture Analysis</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/settings"}>
                  <Link href="/settings">
                    <Settings className="h-4 w-4" />
                    <span>Settings</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarContent>
          <SidebarFooter className="p-4">
            <Button 
              variant="ghost" 
              className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" 
              onClick={() => logout.mutate(undefined, { onSuccess: () => setLocation("/login") })}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Log out
            </Button>
          </SidebarFooter>
        </Sidebar>
        <main className="flex-1 h-full overflow-y-auto relative">
          <div className="absolute inset-0 pointer-events-none opacity-5" style={{ backgroundImage: "url('data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E')" }}></div>
          <div className="relative z-10 h-full p-8 max-w-6xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
