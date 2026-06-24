import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, PenSquare, Calendar, Database, BarChart3, Workflow, Megaphone, Users, ArrowLeft, Star, Send } from 'lucide-react';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const items = [
  { title: 'Dashboard',     url: '/social',             icon: LayoutDashboard, end: true },
  { title: 'Criar Post',    url: '/social/novo',        icon: PenSquare },
  { title: 'Calendário',    url: '/social/calendario',  icon: Calendar },
  { title: 'Banco de Posts',url: '/social/banco',       icon: Database },
  { title: 'Analytics',     url: '/social/analytics',   icon: BarChart3 },
  { title: 'Flows IG DM',   url: '/social/flows',       icon: Workflow },
  { title: 'Broadcasts',    url: '/social/broadcasts',  icon: Megaphone },
  { title: 'Sequências',    url: '/social/sequencias',  icon: Workflow },
  { title: 'Contatos',      url: '/social/contatos',    icon: Users },
  { title: 'Avaliações',    url: '/social/avaliacoes',  icon: Star },
  { title: 'Post Grupos',   url: '/social/post-grupos', icon: Send },
];

export function SocialSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const { pathname } = useLocation();

  return (
    <Sidebar collapsible="icon" className="border-r border-border">
      <SidebarHeader className="p-4 border-b border-border">
        {!collapsed ? (
          <div className="flex items-center gap-2">
            <span className="text-lg">📱</span>
            <span className="font-bold text-sm">Social Publisher</span>
          </div>
        ) : <span className="mx-auto text-lg">📱</span>}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navegação</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const active = item.end ? pathname === item.url : pathname.startsWith(item.url);
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.title}
                      className={cn(active && 'bg-primary/10 text-primary font-medium')}>
                      <NavLink to={item.url} end={item.end}>
                        <item.icon className="w-4 h-4 shrink-0" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-border">
        <NavLink to="/admin">
          <Button variant="outline" size="sm" className="w-full">
            <ArrowLeft className="w-3.5 h-3.5" />
            {!collapsed && <span className="ml-1.5">Admin</span>}
          </Button>
        </NavLink>
      </SidebarFooter>
    </Sidebar>
  );
}