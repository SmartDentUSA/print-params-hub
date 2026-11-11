import { Link } from "react-router-dom";
import {
  Database, ShoppingCart, FolderOpen, FileText, UserCircle,
  Wrench, BarChart3, Users, Settings, LogOut, ArrowLeft,
  Zap, LayoutDashboard, Contact, UsersRound, Bot, MessageSquare,
  ClipboardList, Heart, Cpu, Coins, BrainCircuit, LineChart,
  Video, ChevronDown, GraduationCap, Map, Megaphone, Printer, CreditCard, Headset
} from "lucide-react";
import { CalendarDays, Tag } from "lucide-react";
import { Truck } from "lucide-react";
import { Network } from "lucide-react";
import { BookOpen } from "lucide-react";
import { Share2 } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { sidebarGroups } from "@/components/admin/systemMenu";

interface AdminSidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
  isAdmin: boolean;
  isAuthor: boolean;
  isDistribuidor?: boolean;
  isSupport?: boolean;
  userEmail: string;
  onLogout: () => void;
}

export function AdminSidebar({ activeSection, onSectionChange, isAdmin, isAuthor, isDistribuidor, isSupport, userEmail, onLogout }: AdminSidebarProps) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  let visibleGroups = sidebarGroups.filter(g =>
    (g.adminOnly ? isAdmin : true) && (g.supportOnly ? (isAdmin || isSupport) : true)
  );
  if (isDistribuidor && !isAdmin) {
    visibleGroups = [{
      label: "Smart Ops",
      icon: Zap,
      defaultOpen: true,
      items: [{ id: "so-distribuicao", title: "Distribuição", icon: Truck }],
    }];
  }

  return (
    <Sidebar collapsible="icon" className="border-r border-border">
      <SidebarHeader className="p-4 border-b border-border">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            <span className="font-bold text-sm text-foreground">Admin Panel</span>
          </div>
        )}
        {collapsed && <Zap className="w-5 h-5 text-primary mx-auto" />}
      </SidebarHeader>

      <SidebarContent>
        {visibleGroups.map((group) => {
          const groupActive = group.items.some(i => i.id === activeSection);

          return (
            <Collapsible key={group.label} defaultOpen={group.defaultOpen || groupActive}>
              <SidebarGroup>
                <CollapsibleTrigger asChild>
                  <SidebarGroupLabel className="cursor-pointer hover:bg-accent/10 rounded-md px-2 flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <group.icon className="w-3.5 h-3.5" />
                      {!collapsed && group.label}
                    </span>
                    {!collapsed && <ChevronDown className="w-3 h-3 transition-transform group-data-[state=open]:rotate-180" />}
                  </SidebarGroupLabel>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {group.items.map((item) => (
                        <SidebarMenuItem key={item.id}>
                          <SidebarMenuButton
                            onClick={() => onSectionChange(item.id)}
                            className={cn(
                              "w-full cursor-pointer",
                              activeSection === item.id && "bg-primary/10 text-primary font-medium"
                            )}
                            tooltip={item.title}
                          >
                            <item.icon className="w-4 h-4 shrink-0" />
                            {!collapsed && <span>{item.title}</span>}
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>
          );
        })}
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-border space-y-2">
        {!collapsed && (
          <p className="text-xs text-muted-foreground truncate px-2">{userEmail}</p>
        )}
        <Link to="/social" className="block">
          <Button variant="outline" size="sm" className="w-full">
            <Share2 className="w-3.5 h-3.5" />
            {!collapsed && <span className="ml-1.5">Social Publisher</span>}
          </Button>
        </Link>
        <div className={cn("flex gap-2", collapsed ? "flex-col items-center" : "")}>
          <Link to="/" className="flex-1">
            <Button variant="outline" size="sm" className="w-full">
              <ArrowLeft className="w-3.5 h-3.5" />
              {!collapsed && <span className="ml-1.5">Site</span>}
            </Button>
          </Link>
          <Button variant="ghost" size="sm" onClick={onLogout}>
            <LogOut className="w-3.5 h-3.5" />
            {!collapsed && <span className="ml-1.5">Sair</span>}
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
