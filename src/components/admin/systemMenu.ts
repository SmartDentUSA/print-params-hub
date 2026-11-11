import {
  Database, ShoppingCart, FolderOpen, FileText, UserCircle,
  Wrench, BarChart3, Users, Settings,
  Zap, LayoutDashboard, Contact, UsersRound, Bot, MessageSquare,
  ClipboardList, Heart, Cpu, Coins, BrainCircuit, LineChart,
  Video, GraduationCap, Map, Megaphone, Printer, CreditCard, Headset,
  CalendarDays, Tag, Truck, Network, BookOpen,
} from "lucide-react";

// Menu lateral do painel administrativo — fonte única usada pela barra lateral
// e pelo menu em botões do Copilot.
export interface SidebarItem {
  id: string;
  title: string;
  icon: React.ElementType;
}

export interface SidebarGroupDef {
  label: string;
  icon: React.ElementType;
  items: SidebarItem[];
  adminOnly?: boolean;
  supportOnly?: boolean;
  defaultOpen?: boolean;
}

export const sidebarGroups: SidebarGroupDef[] = [
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
      { id: "knowledge-hub", title: "Knowledge Hub", icon: BookOpen },
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
      { id: "so-ai-routing", title: "AI Routing", icon: Network },
      { id: "so-intelligence", title: "Intelligence", icon: BrainCircuit },
      { id: "so-roi", title: "ROI", icon: LineChart },
      { id: "so-mapeamento", title: "Mapeamento 7×3", icon: Map },
      { id: "so-campanhas", title: "Campanhas", icon: Megaphone },
      { id: "so-distribuicao", title: "Distribuição", icon: Truck },
      { id: "so-reativacao", title: "Reativação & Fluxos", icon: Bot },
      { id: "so-eventos", title: "Eventos", icon: CalendarDays },
      { id: "so-usados", title: "Equipamentos Usados", icon: Tag },
      { id: "so-copilot", title: "🤖 Copilot", icon: Cpu },
      { id: "so-rayshape", title: "Rayshape", icon: Printer },
      { id: "so-stripe", title: "Stripe / Pagamentos", icon: CreditCard },
      { id: "so-cursos", title: "Cursos", icon: GraduationCap },
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
    label: "Suporte Técnico",
    icon: Headset,
    supportOnly: true,
    defaultOpen: true,
    items: [
      { id: "suporte-tecnico", title: "Atendimento & Tickets", icon: Headset },
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
