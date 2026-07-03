import { defineMcp } from "@lovable.dev/mcp-js";
import queryLeads from "./tools/query-leads";
import searchKnowledge from "./tools/search-knowledge";

export default defineMcp({
  name: "smartdent-revenue-os-mcp",
  title: "SmartDent Revenue OS",
  version: "0.1.0",
  instructions:
    "Tools de leitura sobre o CDP SmartDent. Use `query_leads` para consultar leads canônicos e `search_knowledge` para achar artigos publicados.",
  tools: [queryLeads, searchKnowledge],
});