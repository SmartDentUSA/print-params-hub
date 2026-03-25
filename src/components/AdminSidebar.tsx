import { Link } from "react-router-dom";
import {
  Database, ShoppingCart, FolderOpen, FileText, UserCircle,
  Wrench, BarChart3, Users, Settings, LogOut, ArrowLeft,
  Zap, LayoutDashboard, Contact, UsersRound, Bot, MessageSquare,
  ClipboardList, Heart, Cpu, Coins, BrainCircuit, LineChart,
  Video, ChevronDown, GraduationCap
} from "lucide-react";
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

interface AdminSidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
  isAdmin: boolean;
  isAuthor: boolean;
  userEmail: string;
  onLogout: () => void;
}

interface SidebarItem {
  id: string;
  title: string;
  icon: React.ElementType;
}

interface SidebarGroupDef {
  label: string;
  icon: React.ElementType;
  items: SidebarItem[];
  adminOnly?: boolean;
  defaultOpen?: boolean;
}

const sidebarGroups: SidebarGroupDef[] = [
  {
    label: "Catálogo",
    icon: ShoppingCart,
    adminOnly: true,
    defaultOpen: true,
    items: [
      { id: "models", title: "Modelos", icon: Database },
      { id: "catalog", title: "Produtos", icon: ShoppingCart },
      { id: "documents", title: "Docs Sistema", icon: FolderOpen },
    ],
  },
  {
    label: "Conteúdo",
    icon: FileText,
    defaultOpen: false,
    items: [
      { id: "knowledge", title: "Artigos", icon: FileText },
      { id: "authors", title: "Autores", icon: UserCircle },
    ],
  },
  {
    label: "Smart Ops",
    icon: Zap,
    adminOnly: true,
    defaultOpen: false,
    items: [
      { id: "so-bowtie", title: "Bowtie", icon: LayoutDashboard },
      { id: "so-kanban", title: "Público / Lista", icon: Contact },
      { id: "so-equipe", title: "Equipe", icon: UsersRound },
      { id: "so-reguas", title: "Automações", icon: Bot },
      { id: "so-logs", title: "Logs", icon: ClipboardList },
      { id: "so-reports", title: "Relatórios", icon: LineChart },
      { id: "so-conteudo", title: "Conteúdo", icon: FileText },
      { id: "so-saude", title: "Saúde do Sistema", icon: Heart },
      { id: "so-whatsapp", title: "WhatsApp", icon: MessageSquare },
      { id: "so-formularios", title: "Formulários", icon: ClipboardList },
      { id: "so-treinamentos", title: "Treinamentos", icon: GraduationCap },
      { id: "so-tokens-ia", title: "Tokens IA", icon: Coins },
      { id: "so-intelligence", title: "Intelligence", icon: BrainCircuit },
      { id: "so-roi", title: "ROI", icon: LineChart },
      { id: "so-copilot", title: "🤖 Copilot", icon: Cpu },
    ],
  },
  {
    label: "Ferramentas",
    icon: Wrench,
    adminOnly: true,
    defaultOpen: false,
    items: [
      { id: "tools", title: "Ferramentas", icon: Wrench },
      { id: "pandavideo-test", title: "PandaVideo", icon: Video },
    ],
  },
  {
    label: "Sistema",
    icon: Settings,
    adminOnly: true,
    defaultOpen: false,
    items: [
      { id: "stats", title: "Estatísticas", icon: BarChart3 },
      { id: "users", title: "Usuários", icon: Users },
      { id: "settings", title: "Configurações", icon: Settings },
    ],
  },
];

export function AdminSidebar({ activeSection, onSectionChange, isAdmin, isAuthor, userEmail, onLogout }: AdminSidebarProps) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  const visibleGroups = sidebarGroups.filter(g => !g.adminOnly || isAdmin);

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
