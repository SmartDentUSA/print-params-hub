export type FlowNodeType = "msg" | "wait" | "ai" | "image" | "video" | "link";

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
  type: "image" | "video";
  media_url: string;
  caption?: string;
}

export interface LinkNode extends FlowNodeBase {
  type: "link";
  title: string;
  description?: string;
  url: string;
}

export type FlowNode = MsgNode | WaitNode | AiNode | MediaNode | LinkNode;

export interface WaGroupSummary {
  group_id: string;
  group_jid: string;
  group_name: string | null;
  description: string | null;
  member_count: number | null;
  is_admin: boolean;
  instance_name: string | null;
  active_campaign_id: string | null;
  synced_at: string | null;
  campaign_id: string | null;
  campaign_name: string | null;
  campaign_status: "draft" | "active" | "paused" | "finished" | "error" | null;
  current_node_index: number | null;
  next_send_at: string | null;
  started_at: string | null;
  total_nodes: number | null;
  msgs_sent: number | null;
  msgs_pending: number | null;
  msgs_failed: number | null;
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