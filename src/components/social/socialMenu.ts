import { LayoutDashboard, PenSquare, Calendar, Database, BarChart3, Workflow, Megaphone, Users, Star, Send, Inbox, CalendarClock } from 'lucide-react';

// Menu do Social Publisher — fonte única usada pela barra lateral do /social e
// pelo menu em botões do Copilot.
export type SocialMenuItem = { title: string; url: string; icon: React.ElementType; end?: boolean };

export const socialMenuItems: SocialMenuItem[] = [
  { title: 'Dashboard',     url: '/social',             icon: LayoutDashboard, end: true },
  { title: 'Conversas',     url: '/social/conversas',   icon: Inbox },
  { title: 'Criar Post',    url: '/social/novo',        icon: PenSquare },
  { title: 'Agendar em massa', url: '/social/agendamento-massa', icon: CalendarClock },
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
