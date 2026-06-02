export type FlowNodeType =
  | "msg" | "wait" | "ai"
  | "image" | "video" | "audio" | "document"
  | "link"
  | "button" | "list" | "carousel"
  | "post_ig" | "post_yt";

export interface FlowNodeBase {
  id: string;
  type: FlowNodeType;
}

export interface MsgNode extends FlowNodeBase {
  type: "msg";
  text: string;
  mention_all?: boolean;
}

export interface WaitNode extends FlowNodeBase {
  type: "wait";
  days: number;
  hours?: number;
  minutes?: number;
  time: string; // "HH:MM"
  weekdays_only?: boolean;
}

export interface AiNode extends FlowNodeBase {
  type: "ai";
  ai_source_type: "article" | "product" | "video";
  ai_source_id: string;
  ai_source_title: string;
  ai_prompt_override?: string;
}

export interface MediaNode extends FlowNodeBase {
  type: "image" | "video" | "audio" | "document";
  media_url: string;
  caption?: string;
  file_name?: string;
  mime_type?: string;
}

export interface LinkNode extends FlowNodeBase {
  type: "link";
  title: string;
  description?: string;
  url: string;
}

export type ButtonItemType = "reply" | "cta_url" | "cta_copy" | "cta_call" | "pix";

export interface ButtonItem {
  type: ButtonItemType;
  id: string;
  title: string;
  url?: string;
  copyCode?: string;
  phoneNumber?: string;
  pixKey?: string;
  pixAmount?: number;
}

export interface ButtonNode extends FlowNodeBase {
  type: "button";
  body: string;
  footer?: string;
  buttons: ButtonItem[];
}

export interface ListRow {
  id: string;
  title: string;
  description?: string;
}

export interface ListSection {
  title: string;
  rows: ListRow[];
}

export interface ListNode extends FlowNodeBase {
  type: "list";
  title?: string;
  body: string;
  footer?: string;
  buttonText: string;
  sections: ListSection[];
}

export interface CarouselCardButton {
  type: "reply" | "cta_url";
  id: string;
  title: string;
  url?: string;
}

export interface CarouselCard {
  body: string;
  image?: string;
  buttons: CarouselCardButton[];
}

export interface CarouselNode extends FlowNodeBase {
  type: "carousel";
  cards: CarouselCard[];
}

export interface SocialPostNode extends FlowNodeBase {
  type: "post_ig" | "post_yt";
  social_post_id?: string;
  post_url: string;
  caption?: string;
  thumbnail_url?: string;
  titulo?: string;
}

export type FlowNode =
  | MsgNode | WaitNode | AiNode | MediaNode | LinkNode
  | ButtonNode | ListNode | CarouselNode | SocialPostNode;

export interface WaGroupSummary {
  group_id: string;
  group_jid: string;
  group_name: string | null;
  description: string | null;
  member_count: number | null;
  is_admin: boolean;
  enabled: boolean;
  instance_name: string | null;
  active_campaign_id: string | null;
  synced_at: string | null;
  campaign_id: string | null;
  campaign_name: string | null;
  campaign_status: "draft" | "active" | "paused" | "finished" | "error" | null;
  campaign_type: "flow" | "blast" | null;
  current_node_index: number | null;
  next_send_at: string | null;
  started_at: string | null;
  total_nodes: number | null;
  msgs_sent: number | null;
  msgs_pending: number | null;
  msgs_failed: number | null;
  in_shared_campaign: boolean;
  session_health?: "ok" | "session_broken" | string | null;
  consecutive_send_errors?: number | null;
  last_send_error?: string | null;
  last_send_error_at?: string | null;
  group_key_auto_fallback?: boolean | null;
}

export interface WaInstanceInfo {
  instanceName: string;
  connectionStatus: "open" | "close" | "connecting" | string;
  owner?: string;
  profileName?: string;
}

export interface WaCombinedCampaignGroup {
  group_id: string;
  group_jid: string;
  group_name: string | null;
  member_count: number | null;
  is_admin: boolean;
  enabled: boolean;
  instance_name: string | null;
}

export interface WaCombinedCampaign {
  campaign_id: string;
  campaign_name: string;
  campaign_status: "draft" | "active" | "paused" | "finished" | "error";
  campaign_type: "flow" | "blast";
  current_node_index: number | null;
  next_send_at: string | null;
  started_at: string | null;
  total_nodes: number;
  group_count: number;
  total_members: number;
  groups: WaCombinedCampaignGroup[];
  msgs_sent: number;
  msgs_pending: number;
  msgs_failed: number;
}

export interface WaCampaignRow {
  id: string;
  group_id: string;
  name: string;
  flow_json: FlowNode[];
  status: "draft" | "active" | "paused" | "finished" | "error";
  delay_seconds: number;
  daily_limit: number;
  current_node_index: number;
  next_send_at: string | null;
  started_at: string | null;
  finished_at: string | null;
}

export interface WaQueueRow {
  id: string;
  campaign_id: string;
  node_index: number;
  node_type: string;
  status: "pending" | "sending" | "sent" | "failed" | "skipped";
  scheduled_at: string;
  sent_at: string | null;
  error_message: string | null;
}