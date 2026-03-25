export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      agent_embeddings: {
        Row: {
          chunk_text: string
          content_id: string | null
          created_at: string | null
          embedding: string | null
          embedding_model: string | null
          embedding_updated_at: string | null
          id: string
          metadata: Json | null
          source_type: string
          vector_v2: string | null
        }
        Insert: {
          chunk_text: string
          content_id?: string | null
          created_at?: string | null
          embedding?: string | null
          embedding_model?: string | null
          embedding_updated_at?: string | null
          id?: string
          metadata?: Json | null
          source_type: string
          vector_v2?: string | null
        }
        Update: {
          chunk_text?: string
          content_id?: string | null
          created_at?: string | null
          embedding?: string | null
          embedding_model?: string | null
          embedding_updated_at?: string | null
          id?: string
          metadata?: Json | null
          source_type?: string
          vector_v2?: string | null
        }
        Relationships: []
      }
      agent_interactions: {
        Row: {
          agent_response: string | null
          context_raw: string | null
          context_sources: Json | null
          created_at: string | null
          feedback: string | null
          feedback_comment: string | null
          human_reviewed: boolean | null
          id: string
          judge_evaluated_at: string | null
          judge_reason: string | null
          judge_reason_ds: string | null
          judge_score: number | null
          judge_score_ds: number | null
          judge_verdict: string | null
          judge_verdict_ds: string | null
          lang: string | null
          lead_id: string | null
          session_id: string
          top_similarity: number | null
          unanswered: boolean | null
          user_message: string
        }
        Insert: {
          agent_response?: string | null
          context_raw?: string | null
          context_sources?: Json | null
          created_at?: string | null
          feedback?: string | null
          feedback_comment?: string | null
          human_reviewed?: boolean | null
          id?: string
          judge_evaluated_at?: string | null
          judge_reason?: string | null
          judge_reason_ds?: string | null
          judge_score?: number | null
          judge_score_ds?: number | null
          judge_verdict?: string | null
          judge_verdict_ds?: string | null
          lang?: string | null
          lead_id?: string | null
          session_id: string
          top_similarity?: number | null
          unanswered?: boolean | null
          user_message: string
        }
        Update: {
          agent_response?: string | null
          context_raw?: string | null
          context_sources?: Json | null
          created_at?: string | null
          feedback?: string | null
          feedback_comment?: string | null
          human_reviewed?: boolean | null
          id?: string
          judge_evaluated_at?: string | null
          judge_reason?: string | null
          judge_reason_ds?: string | null
          judge_score?: number | null
          judge_score_ds?: number | null
          judge_verdict?: string | null
          judge_verdict_ds?: string | null
          lang?: string | null
          lead_id?: string | null
          session_id?: string
          top_similarity?: number | null
          unanswered?: boolean | null
          user_message?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_interactions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_internal_lookups: {
        Row: {
          created_at: string | null
          hit_count: number | null
          id: string
          last_hit_at: string | null
          lead_id: string | null
          query_normalized: string
          query_original: string
          result_types: string[] | null
          results_count: number
          results_json: Json
          session_id: string | null
          source_function: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          hit_count?: number | null
          id?: string
          last_hit_at?: string | null
          lead_id?: string | null
          query_normalized: string
          query_original: string
          result_types?: string[] | null
          results_count?: number
          results_json?: Json
          session_id?: string | null
          source_function?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          hit_count?: number | null
          id?: string
          last_hit_at?: string | null
          lead_id?: string | null
          query_normalized?: string
          query_original?: string
          result_types?: string[] | null
          results_count?: number
          results_json?: Json
          session_id?: string | null
          source_function?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      agent_knowledge_gaps: {
        Row: {
          created_at: string | null
          frequency: number | null
          id: string
          lang: string | null
          question: string
          resolution_note: string | null
          rota: string | null
          status: string | null
          tema: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          frequency?: number | null
          id?: string
          lang?: string | null
          question: string
          resolution_note?: string | null
          rota?: string | null
          status?: string | null
          tema?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          frequency?: number | null
          id?: string
          lang?: string | null
          question?: string
          resolution_note?: string | null
          rota?: string | null
          status?: string | null
          tema?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      agent_sessions: {
        Row: {
          created_at: string | null
          current_state: string
          extracted_entities: Json | null
          id: string
          last_activity_at: string | null
          lead_id: string | null
          session_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          current_state?: string
          extracted_entities?: Json | null
          id?: string
          last_activity_at?: string | null
          lead_id?: string | null
          session_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          current_state?: string
          extracted_entities?: Json | null
          id?: string
          last_activity_at?: string | null
          lead_id?: string | null
          session_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_sessions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "lead_model_routing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_sessions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "lia_attendances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_sessions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_academy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_sessions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_cognitive"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_sessions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_commercial"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_sessions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_ecommerce"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_sessions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_leads_correto"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "agent_sessions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_opportunity_engine"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "agent_sessions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_timing_alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_sessions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_workflow_portfolio"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "agent_sessions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_workflow_timeline"
            referencedColumns: ["lead_id"]
          },
        ]
      }
      ai_token_usage: {
        Row: {
          action_label: string
          completion_tokens: number | null
          created_at: string
          estimated_cost_usd: number | null
          function_name: string
          id: string
          metadata: Json | null
          model: string | null
          prompt_tokens: number | null
          provider: string
          total_tokens: number | null
        }
        Insert: {
          action_label: string
          completion_tokens?: number | null
          created_at?: string
          estimated_cost_usd?: number | null
          function_name: string
          id?: string
          metadata?: Json | null
          model?: string | null
          prompt_tokens?: number | null
          provider?: string
          total_tokens?: number | null
        }
        Update: {
          action_label?: string
          completion_tokens?: number | null
          created_at?: string
          estimated_cost_usd?: number | null
          function_name?: string
          id?: string
          metadata?: Json | null
          model?: string | null
          prompt_tokens?: number | null
          provider?: string
          total_tokens?: number | null
        }
        Relationships: []
      }
      authors: {
        Row: {
          active: boolean
          created_at: string
          facebook_url: string | null
          full_bio: string | null
          id: string
          instagram_url: string | null
          lattes_url: string | null
          linkedin_url: string | null
          mini_bio: string | null
          name: string
          order_index: number
          photo_alt: string | null
          photo_url: string | null
          specialty: string | null
          tiktok_url: string | null
          twitter_url: string | null
          updated_at: string
          website_url: string | null
          youtube_url: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          facebook_url?: string | null
          full_bio?: string | null
          id?: string
          instagram_url?: string | null
          lattes_url?: string | null
          linkedin_url?: string | null
          mini_bio?: string | null
          name: string
          order_index?: number
          photo_alt?: string | null
          photo_url?: string | null
          specialty?: string | null
          tiktok_url?: string | null
          twitter_url?: string | null
          updated_at?: string
          website_url?: string | null
          youtube_url?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          facebook_url?: string | null
          full_bio?: string | null
          id?: string
          instagram_url?: string | null
          lattes_url?: string | null
          linkedin_url?: string | null
          mini_bio?: string | null
          name?: string
          order_index?: number
          photo_alt?: string | null
          photo_url?: string | null
          specialty?: string | null
          tiktok_url?: string | null
          twitter_url?: string | null
          updated_at?: string
          website_url?: string | null
          youtube_url?: string | null
        }
        Relationships: []
      }
      backfill_log: {
        Row: {
          batch_number: number
          error_count: number | null
          finished_at: string | null
          id: string
          processed_count: number | null
          started_at: string | null
          success_count: number | null
        }
        Insert: {
          batch_number: number
          error_count?: number | null
          finished_at?: string | null
          id?: string
          processed_count?: number | null
          started_at?: string | null
          success_count?: number | null
        }
        Update: {
          batch_number?: number
          error_count?: number | null
          finished_at?: string | null
          id?: string
          processed_count?: number | null
          started_at?: string | null
          success_count?: number | null
        }
        Relationships: []
      }
      brands: {
        Row: {
          active: boolean
          created_at: string
          id: string
          logo_url: string | null
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      catalog_documents: {
        Row: {
          active: boolean | null
          created_at: string | null
          document_category: string | null
          document_description: string | null
          document_name: string
          document_subcategory: string | null
          document_type: string | null
          extracted_at: string | null
          extracted_text: string | null
          extraction_error: string | null
          extraction_method: string | null
          extraction_status: string | null
          extraction_tokens: number | null
          file_hash: string | null
          file_name: string
          file_size: number | null
          file_url: string
          id: string
          language: string | null
          order_index: number | null
          product_id: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          document_category?: string | null
          document_description?: string | null
          document_name: string
          document_subcategory?: string | null
          document_type?: string | null
          extracted_at?: string | null
          extracted_text?: string | null
          extraction_error?: string | null
          extraction_method?: string | null
          extraction_status?: string | null
          extraction_tokens?: number | null
          file_hash?: string | null
          file_name: string
          file_size?: number | null
          file_url: string
          id?: string
          language?: string | null
          order_index?: number | null
          product_id: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          document_category?: string | null
          document_description?: string | null
          document_name?: string
          document_subcategory?: string | null
          document_type?: string | null
          extracted_at?: string | null
          extracted_text?: string | null
          extraction_error?: string | null
          extraction_method?: string | null
          extraction_status?: string | null
          extraction_tokens?: number | null
          file_hash?: string | null
          file_name?: string
          file_size?: number | null
          file_url?: string
          id?: string
          language?: string | null
          order_index?: number | null
          product_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "catalog_documents_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "system_a_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          annual_revenue: number | null
          cidade: string | null
          cnae: string | null
          cnpj: string | null
          created_at: string | null
          domain: string | null
          employee_count: number | null
          endereco: Json | null
          facebook: string | null
          id: string
          ie: string | null
          is_active: boolean | null
          linkedin: string | null
          merged_into: string | null
          nome: string | null
          piperun_company_id: number | null
          porte: string | null
          primary_person_id: string | null
          razao_social: string | null
          segmento: string | null
          situacao: string | null
          tags: string[] | null
          touch_model: string | null
          type: string
          uf: string | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          annual_revenue?: number | null
          cidade?: string | null
          cnae?: string | null
          cnpj?: string | null
          created_at?: string | null
          domain?: string | null
          employee_count?: number | null
          endereco?: Json | null
          facebook?: string | null
          id?: string
          ie?: string | null
          is_active?: boolean | null
          linkedin?: string | null
          merged_into?: string | null
          nome?: string | null
          piperun_company_id?: number | null
          porte?: string | null
          primary_person_id?: string | null
          razao_social?: string | null
          segmento?: string | null
          situacao?: string | null
          tags?: string[] | null
          touch_model?: string | null
          type?: string
          uf?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          annual_revenue?: number | null
          cidade?: string | null
          cnae?: string | null
          cnpj?: string | null
          created_at?: string | null
          domain?: string | null
          employee_count?: number | null
          endereco?: Json | null
          facebook?: string | null
          id?: string
          ie?: string | null
          is_active?: boolean | null
          linkedin?: string | null
          merged_into?: string | null
          nome?: string | null
          piperun_company_id?: number | null
          porte?: string | null
          primary_person_id?: string | null
          razao_social?: string | null
          segmento?: string | null
          situacao?: string | null
          tags?: string[] | null
          touch_model?: string | null
          type?: string
          uf?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_merged_into_fkey"
            columns: ["merged_into"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "companies_merged_into_fkey"
            columns: ["merged_into"]
            isOneToOne: false
            referencedRelation: "v_customer_graph"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "companies_merged_into_fkey"
            columns: ["merged_into"]
            isOneToOne: false
            referencedRelation: "v_person_company_graph"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "companies_primary_person_id_fkey"
            columns: ["primary_person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "companies_primary_person_id_fkey"
            columns: ["primary_person_id"]
            isOneToOne: false
            referencedRelation: "v_customer_graph"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "companies_primary_person_id_fkey"
            columns: ["primary_person_id"]
            isOneToOne: false
            referencedRelation: "v_person_company_graph"
            referencedColumns: ["person_id"]
          },
        ]
      }
      company_kb_texts: {
        Row: {
          active: boolean | null
          category: string
          chunks_count: number | null
          content: string
          created_at: string | null
          id: string
          indexed_at: string | null
          source_label: string | null
          title: string
        }
        Insert: {
          active?: boolean | null
          category: string
          chunks_count?: number | null
          content: string
          created_at?: string | null
          id?: string
          indexed_at?: string | null
          source_label?: string | null
          title: string
        }
        Update: {
          active?: boolean | null
          category?: string
          chunks_count?: number | null
          content?: string
          created_at?: string | null
          id?: string
          indexed_at?: string | null
          source_label?: string | null
          title?: string
        }
        Relationships: []
      }
      content_requests: {
        Row: {
          created_at: string | null
          frequency: number | null
          id: string
          pendencia_original: string
          prioridade: number | null
          produto_relacionado: string | null
          published_content_id: string | null
          resolution_note: string | null
          source_leads: string[] | null
          source_sessions: string[] | null
          status: string | null
          tema: string
          tipo_conteudo: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          frequency?: number | null
          id?: string
          pendencia_original: string
          prioridade?: number | null
          produto_relacionado?: string | null
          published_content_id?: string | null
          resolution_note?: string | null
          source_leads?: string[] | null
          source_sessions?: string[] | null
          status?: string | null
          tema: string
          tipo_conteudo?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          frequency?: number | null
          id?: string
          pendencia_original?: string
          prioridade?: number | null
          produto_relacionado?: string | null
          published_content_id?: string | null
          resolution_note?: string | null
          source_leads?: string[] | null
          source_sessions?: string[] | null
          status?: string | null
          tema?: string
          tipo_conteudo?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      cron_state: {
        Row: {
          key: string
          meta: Json | null
          updated_at: string | null
          value: string
        }
        Insert: {
          key: string
          meta?: Json | null
          updated_at?: string | null
          value?: string
        }
        Update: {
          key?: string
          meta?: Json | null
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      cs_automation_rules: {
        Row: {
          ativo: boolean
          created_at: string
          delay_days: number | null
          id: string
          manychat_ativo: boolean | null
          mensagem_waleads: string | null
          produto_interesse: string | null
          team_member_id: string | null
          template_manychat: string | null
          tipo: string | null
          trigger_event: string | null
          waleads_ativo: boolean | null
          waleads_media_caption: string | null
          waleads_media_url: string | null
          waleads_tipo: string | null
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          delay_days?: number | null
          id?: string
          manychat_ativo?: boolean | null
          mensagem_waleads?: string | null
          produto_interesse?: string | null
          team_member_id?: string | null
          template_manychat?: string | null
          tipo?: string | null
          trigger_event?: string | null
          waleads_ativo?: boolean | null
          waleads_media_caption?: string | null
          waleads_media_url?: string | null
          waleads_tipo?: string | null
        }
        Update: {
          ativo?: boolean
          created_at?: string
          delay_days?: number | null
          id?: string
          manychat_ativo?: boolean | null
          mensagem_waleads?: string | null
          produto_interesse?: string | null
          team_member_id?: string | null
          template_manychat?: string | null
          tipo?: string | null
          trigger_event?: string | null
          waleads_ativo?: boolean | null
          waleads_media_caption?: string | null
          waleads_media_url?: string | null
          waleads_tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cs_automation_rules_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_items: {
        Row: {
          cod_produto: string | null
          data_proposta: string | null
          deal_date: string | null
          deal_id: string | null
          freight_type: string | null
          freight_value: number | null
          id: string
          installments: number | null
          lead_id: string | null
          metodo_pagamento: string | null
          nome_produto: string | null
          num_parcelas: number | null
          payment_method: string | null
          product_code: string | null
          product_name: string | null
          proposal_id: string
          proposta_raw: Json | null
          quantidade: number | null
          quantity: number | null
          synced_at: string | null
          tipo_frete: string | null
          total_value: number | null
          unit_value: number | null
          valor_frete: number | null
          valor_total: number | null
          valor_unitario: number | null
          vendor_name: string | null
        }
        Insert: {
          cod_produto?: string | null
          data_proposta?: string | null
          deal_date?: string | null
          deal_id?: string | null
          freight_type?: string | null
          freight_value?: number | null
          id?: string
          installments?: number | null
          lead_id?: string | null
          metodo_pagamento?: string | null
          nome_produto?: string | null
          num_parcelas?: number | null
          payment_method?: string | null
          product_code?: string | null
          product_name?: string | null
          proposal_id: string
          proposta_raw?: Json | null
          quantidade?: number | null
          quantity?: number | null
          synced_at?: string | null
          tipo_frete?: string | null
          total_value?: number | null
          unit_value?: number | null
          valor_frete?: number | null
          valor_total?: number | null
          valor_unitario?: number | null
          vendor_name?: string | null
        }
        Update: {
          cod_produto?: string | null
          data_proposta?: string | null
          deal_date?: string | null
          deal_id?: string | null
          freight_type?: string | null
          freight_value?: number | null
          id?: string
          installments?: number | null
          lead_id?: string | null
          metodo_pagamento?: string | null
          nome_produto?: string | null
          num_parcelas?: number | null
          payment_method?: string | null
          product_code?: string | null
          product_name?: string | null
          proposal_id?: string
          proposta_raw?: Json | null
          quantidade?: number | null
          quantity?: number | null
          synced_at?: string | null
          tipo_frete?: string | null
          total_value?: number | null
          unit_value?: number | null
          valor_frete?: number | null
          valor_total?: number | null
          valor_unitario?: number | null
          vendor_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deal_items_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "lead_model_routing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_items_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "lia_attendances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_items_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_academy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_items_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_cognitive"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_items_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_commercial"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_items_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_ecommerce"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_items_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_leads_correto"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "deal_items_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_opportunity_engine"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "deal_items_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_timing_alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_items_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_workflow_portfolio"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "deal_items_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_workflow_timeline"
            referencedColumns: ["lead_id"]
          },
        ]
      }
      deals: {
        Row: {
          billing_entity: string | null
          closed_at: string | null
          company_id: string | null
          created_at: string | null
          currency: string | null
          deal_hash: string | null
          deal_source: string | null
          freight_type: string | null
          id: string
          is_deleted: boolean | null
          items_text: string | null
          lead_id: string | null
          loss_comment: string | null
          loss_reason: string | null
          origin_name: string | null
          owner_id: number | null
          owner_name: string | null
          payment_installments: number | null
          payment_method: string | null
          person_id: string | null
          pipeline_id: number | null
          pipeline_name: string | null
          piperun_created_at: string | null
          piperun_deal_id: string | null
          product: string | null
          product_category: string | null
          proposals: Json | null
          stage_id: number | null
          stage_name: string | null
          status: string | null
          updated_at: string | null
          value: number | null
          value_freight: number | null
          value_products: number | null
        }
        Insert: {
          billing_entity?: string | null
          closed_at?: string | null
          company_id?: string | null
          created_at?: string | null
          currency?: string | null
          deal_hash?: string | null
          deal_source?: string | null
          freight_type?: string | null
          id?: string
          is_deleted?: boolean | null
          items_text?: string | null
          lead_id?: string | null
          loss_comment?: string | null
          loss_reason?: string | null
          origin_name?: string | null
          owner_id?: number | null
          owner_name?: string | null
          payment_installments?: number | null
          payment_method?: string | null
          person_id?: string | null
          pipeline_id?: number | null
          pipeline_name?: string | null
          piperun_created_at?: string | null
          piperun_deal_id?: string | null
          product?: string | null
          product_category?: string | null
          proposals?: Json | null
          stage_id?: number | null
          stage_name?: string | null
          status?: string | null
          updated_at?: string | null
          value?: number | null
          value_freight?: number | null
          value_products?: number | null
        }
        Update: {
          billing_entity?: string | null
          closed_at?: string | null
          company_id?: string | null
          created_at?: string | null
          currency?: string | null
          deal_hash?: string | null
          deal_source?: string | null
          freight_type?: string | null
          id?: string
          is_deleted?: boolean | null
          items_text?: string | null
          lead_id?: string | null
          loss_comment?: string | null
          loss_reason?: string | null
          origin_name?: string | null
          owner_id?: number | null
          owner_name?: string | null
          payment_installments?: number | null
          payment_method?: string | null
          person_id?: string | null
          pipeline_id?: number | null
          pipeline_name?: string | null
          piperun_created_at?: string | null
          piperun_deal_id?: string | null
          product?: string | null
          product_category?: string | null
          proposals?: Json | null
          stage_id?: number | null
          stage_name?: string | null
          status?: string | null
          updated_at?: string | null
          value?: number | null
          value_freight?: number | null
          value_products?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "deals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_customer_graph"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "deals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_person_company_graph"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "deals_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "lead_model_routing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "lia_attendances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_academy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_cognitive"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_commercial"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_ecommerce"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_leads_correto"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "deals_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_opportunity_engine"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "deals_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_timing_alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_workflow_portfolio"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "deals_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_workflow_timeline"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "deals_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "v_customer_graph"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "deals_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "v_person_company_graph"
            referencedColumns: ["person_id"]
          },
        ]
      }
      drive_kb_sync_log: {
        Row: {
          category: string
          created_at: string | null
          drive_file_id: string
          error_msg: string | null
          file_name: string
          folder_name: string | null
          id: string
          kb_text_id: string | null
          mime_type: string | null
          modified_time: string | null
          processed_at: string | null
          source_label: string | null
          status: string
        }
        Insert: {
          category?: string
          created_at?: string | null
          drive_file_id: string
          error_msg?: string | null
          file_name: string
          folder_name?: string | null
          id?: string
          kb_text_id?: string | null
          mime_type?: string | null
          modified_time?: string | null
          processed_at?: string | null
          source_label?: string | null
          status?: string
        }
        Update: {
          category?: string
          created_at?: string | null
          drive_file_id?: string
          error_msg?: string | null
          file_name?: string
          folder_name?: string | null
          id?: string
          kb_text_id?: string | null
          mime_type?: string | null
          modified_time?: string | null
          processed_at?: string | null
          source_label?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "drive_kb_sync_log_kb_text_id_fkey"
            columns: ["kb_text_id"]
            isOneToOne: false
            referencedRelation: "company_kb_texts"
            referencedColumns: ["id"]
          },
        ]
      }
      external_links: {
        Row: {
          ai_generated: boolean | null
          approved: boolean | null
          category: string | null
          competition_level: string | null
          cpc_estimate: number | null
          created_at: string | null
          description: string | null
          id: string
          keyword_type: string | null
          last_used_at: string | null
          monthly_searches: number | null
          name: string
          related_keywords: string[] | null
          relevance_score: number | null
          search_intent: string | null
          source_products: string[] | null
          subcategory: string | null
          updated_at: string | null
          url: string
          usage_count: number | null
        }
        Insert: {
          ai_generated?: boolean | null
          approved?: boolean | null
          category?: string | null
          competition_level?: string | null
          cpc_estimate?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          keyword_type?: string | null
          last_used_at?: string | null
          monthly_searches?: number | null
          name: string
          related_keywords?: string[] | null
          relevance_score?: number | null
          search_intent?: string | null
          source_products?: string[] | null
          subcategory?: string | null
          updated_at?: string | null
          url: string
          usage_count?: number | null
        }
        Update: {
          ai_generated?: boolean | null
          approved?: boolean | null
          category?: string | null
          competition_level?: string | null
          cpc_estimate?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          keyword_type?: string | null
          last_used_at?: string | null
          monthly_searches?: number | null
          name?: string
          related_keywords?: string[] | null
          relevance_score?: number | null
          search_intent?: string | null
          source_products?: string[] | null
          subcategory?: string | null
          updated_at?: string | null
          url?: string
          usage_count?: number | null
        }
        Relationships: []
      }
      identity_keys: {
        Row: {
          confidence: string
          created_at: string | null
          id: string
          is_primary: boolean | null
          person_id: string
          source: string | null
          type: string
          updated_at: string | null
          value: string
          verified_at: string | null
        }
        Insert: {
          confidence?: string
          created_at?: string | null
          id?: string
          is_primary?: boolean | null
          person_id: string
          source?: string | null
          type: string
          updated_at?: string | null
          value: string
          verified_at?: string | null
        }
        Update: {
          confidence?: string
          created_at?: string | null
          id?: string
          is_primary?: boolean | null
          person_id?: string
          source?: string | null
          type?: string
          updated_at?: string | null
          value?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "identity_keys_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "identity_keys_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "v_customer_graph"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "identity_keys_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "v_person_company_graph"
            referencedColumns: ["person_id"]
          },
        ]
      }
      image_embedding_cache: {
        Row: {
          created_at: string | null
          embedding: string | null
          hit_count: number | null
          image_hash: string
        }
        Insert: {
          created_at?: string | null
          embedding?: string | null
          hit_count?: number | null
          image_hash: string
        }
        Update: {
          created_at?: string | null
          embedding?: string | null
          hit_count?: number | null
          image_hash?: string
        }
        Relationships: []
      }
      image_query_logs: {
        Row: {
          cache_hit: boolean | null
          created_at: string | null
          embedding_time_ms: number | null
          failure_detected: string | null
          gatekeeper_result: string | null
          id: string
          image_hash: string | null
          image_size_kb: number | null
          session_id: string | null
          top_match_score: number | null
          vector_results_count: number | null
        }
        Insert: {
          cache_hit?: boolean | null
          created_at?: string | null
          embedding_time_ms?: number | null
          failure_detected?: string | null
          gatekeeper_result?: string | null
          id?: string
          image_hash?: string | null
          image_size_kb?: number | null
          session_id?: string | null
          top_match_score?: number | null
          vector_results_count?: number | null
        }
        Update: {
          cache_hit?: boolean | null
          created_at?: string | null
          embedding_time_ms?: number | null
          failure_detected?: string | null
          gatekeeper_result?: string | null
          id?: string
          image_hash?: string | null
          image_size_kb?: number | null
          session_id?: string | null
          top_match_score?: number | null
          vector_results_count?: number | null
        }
        Relationships: []
      }
      intelligence_score_config: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          thresholds: Json
          version: number
          weights: Json
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          thresholds: Json
          version: number
          weights: Json
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          thresholds?: Json
          version?: number
          weights?: Json
        }
        Relationships: []
      }
      interactions: {
        Row: {
          body: string | null
          channel_ref: string | null
          company_id: string | null
          created_at: string | null
          direction: string | null
          external_id: string | null
          handled_by: string | null
          id: string
          intent: string | null
          lead_id: string | null
          occurred_at: string
          payload: Json | null
          person_id: string | null
          resolved: boolean | null
          score: number | null
          sentiment: string | null
          source: string
          subject: string | null
          type: string
        }
        Insert: {
          body?: string | null
          channel_ref?: string | null
          company_id?: string | null
          created_at?: string | null
          direction?: string | null
          external_id?: string | null
          handled_by?: string | null
          id?: string
          intent?: string | null
          lead_id?: string | null
          occurred_at?: string
          payload?: Json | null
          person_id?: string | null
          resolved?: boolean | null
          score?: number | null
          sentiment?: string | null
          source: string
          subject?: string | null
          type: string
        }
        Update: {
          body?: string | null
          channel_ref?: string | null
          company_id?: string | null
          created_at?: string | null
          direction?: string | null
          external_id?: string | null
          handled_by?: string | null
          id?: string
          intent?: string | null
          lead_id?: string | null
          occurred_at?: string
          payload?: Json | null
          person_id?: string | null
          resolved?: boolean | null
          score?: number | null
          sentiment?: string | null
          source?: string
          subject?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "interactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_customer_graph"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "interactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_person_company_graph"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "interactions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "lead_model_routing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interactions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "lia_attendances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interactions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_academy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interactions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_cognitive"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interactions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_commercial"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interactions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_ecommerce"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interactions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_leads_correto"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "interactions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_opportunity_engine"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "interactions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_timing_alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interactions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_workflow_portfolio"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "interactions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_workflow_timeline"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "interactions_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interactions_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "v_customer_graph"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "interactions_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "v_person_company_graph"
            referencedColumns: ["person_id"]
          },
        ]
      }
      knowledge_categories: {
        Row: {
          created_at: string | null
          enabled: boolean | null
          id: string
          letter: string
          name: string
          order_index: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          letter: string
          name: string
          order_index: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          letter?: string
          name?: string
          order_index?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      knowledge_contents: {
        Row: {
          active: boolean | null
          ai_context: string | null
          ai_context_en: string | null
          ai_context_es: string | null
          ai_prompt_template: string | null
          author_id: string | null
          canva_template_url: string | null
          category_id: string | null
          content_html: string | null
          content_html_en: string | null
          content_html_es: string | null
          content_image_alt: string | null
          content_image_url: string | null
          created_at: string | null
          excerpt: string
          excerpt_en: string | null
          excerpt_es: string | null
          faqs: Json | null
          faqs_en: Json | null
          faqs_es: Json | null
          file_name: string | null
          file_url: string | null
          icon_color: string | null
          id: string
          keyword_ids: string[] | null
          keywords: string[] | null
          meta_description: string | null
          og_image_alt: string | null
          og_image_url: string | null
          order_index: number
          recommended_products: string[] | null
          recommended_resins: string[] | null
          selected_pdf_ids_en: string[] | null
          selected_pdf_ids_es: string[] | null
          selected_pdf_ids_pt: string[] | null
          slug: string
          title: string
          title_en: string | null
          title_es: string | null
          updated_at: string | null
          veredict_data: Json | null
        }
        Insert: {
          active?: boolean | null
          ai_context?: string | null
          ai_context_en?: string | null
          ai_context_es?: string | null
          ai_prompt_template?: string | null
          author_id?: string | null
          canva_template_url?: string | null
          category_id?: string | null
          content_html?: string | null
          content_html_en?: string | null
          content_html_es?: string | null
          content_image_alt?: string | null
          content_image_url?: string | null
          created_at?: string | null
          excerpt: string
          excerpt_en?: string | null
          excerpt_es?: string | null
          faqs?: Json | null
          faqs_en?: Json | null
          faqs_es?: Json | null
          file_name?: string | null
          file_url?: string | null
          icon_color?: string | null
          id?: string
          keyword_ids?: string[] | null
          keywords?: string[] | null
          meta_description?: string | null
          og_image_alt?: string | null
          og_image_url?: string | null
          order_index: number
          recommended_products?: string[] | null
          recommended_resins?: string[] | null
          selected_pdf_ids_en?: string[] | null
          selected_pdf_ids_es?: string[] | null
          selected_pdf_ids_pt?: string[] | null
          slug: string
          title: string
          title_en?: string | null
          title_es?: string | null
          updated_at?: string | null
          veredict_data?: Json | null
        }
        Update: {
          active?: boolean | null
          ai_context?: string | null
          ai_context_en?: string | null
          ai_context_es?: string | null
          ai_prompt_template?: string | null
          author_id?: string | null
          canva_template_url?: string | null
          category_id?: string | null
          content_html?: string | null
          content_html_en?: string | null
          content_html_es?: string | null
          content_image_alt?: string | null
          content_image_url?: string | null
          created_at?: string | null
          excerpt?: string
          excerpt_en?: string | null
          excerpt_es?: string | null
          faqs?: Json | null
          faqs_en?: Json | null
          faqs_es?: Json | null
          file_name?: string | null
          file_url?: string | null
          icon_color?: string | null
          id?: string
          keyword_ids?: string[] | null
          keywords?: string[] | null
          meta_description?: string | null
          og_image_alt?: string | null
          og_image_url?: string | null
          order_index?: number
          recommended_products?: string[] | null
          recommended_resins?: string[] | null
          selected_pdf_ids_en?: string[] | null
          selected_pdf_ids_es?: string[] | null
          selected_pdf_ids_pt?: string[] | null
          slug?: string
          title?: string
          title_en?: string | null
          title_es?: string | null
          updated_at?: string | null
          veredict_data?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_contents_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "authors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_contents_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "knowledge_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_gap_drafts: {
        Row: {
          ai_model_used: string | null
          cluster_questions: string[]
          created_at: string | null
          draft_excerpt: string
          draft_excerpt_ds: string | null
          draft_faq: Json | null
          draft_faq_ds: Json | null
          draft_keywords: string[] | null
          draft_title: string
          draft_title_ds: string | null
          gap_ids: string[]
          id: string
          published_content_id: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          ai_model_used?: string | null
          cluster_questions: string[]
          created_at?: string | null
          draft_excerpt: string
          draft_excerpt_ds?: string | null
          draft_faq?: Json | null
          draft_faq_ds?: Json | null
          draft_keywords?: string[] | null
          draft_title: string
          draft_title_ds?: string | null
          gap_ids: string[]
          id?: string
          published_content_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          ai_model_used?: string | null
          cluster_questions?: string[]
          created_at?: string | null
          draft_excerpt?: string
          draft_excerpt_ds?: string | null
          draft_faq?: Json | null
          draft_faq_ds?: Json | null
          draft_keywords?: string[] | null
          draft_title?: string
          draft_title_ds?: string | null
          gap_ids?: string[]
          id?: string
          published_content_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Relationships: []
      }
      knowledge_video_metrics_log: {
        Row: {
          avg_retention: number | null
          created_at: string | null
          id: string
          knowledge_video_id: string | null
          pandavideo_id: string | null
          play_rate: number | null
          plays: number | null
          relevance_score: number | null
          unique_plays: number | null
          unique_views: number | null
          views: number | null
        }
        Insert: {
          avg_retention?: number | null
          created_at?: string | null
          id?: string
          knowledge_video_id?: string | null
          pandavideo_id?: string | null
          play_rate?: number | null
          plays?: number | null
          relevance_score?: number | null
          unique_plays?: number | null
          unique_views?: number | null
          views?: number | null
        }
        Update: {
          avg_retention?: number | null
          created_at?: string | null
          id?: string
          knowledge_video_id?: string | null
          pandavideo_id?: string | null
          play_rate?: number | null
          plays?: number | null
          relevance_score?: number | null
          unique_plays?: number | null
          unique_views?: number | null
          views?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_video_metrics_log_knowledge_video_id_fkey"
            columns: ["knowledge_video_id"]
            isOneToOne: false
            referencedRelation: "knowledge_videos"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_videos: {
        Row: {
          analytics: Json | null
          analytics_avg_retention: number | null
          analytics_last_sync: string | null
          analytics_play_rate: number | null
          analytics_plays: number | null
          analytics_unique_plays: number | null
          analytics_unique_views: number | null
          analytics_views: number | null
          content_id: string | null
          content_type: string | null
          created_at: string | null
          description: string | null
          embed_url: string | null
          folder_id: string | null
          hls_url: string | null
          id: string
          is_premium: boolean | null
          last_product_sync_at: string | null
          order_index: number
          panda_config: Json | null
          panda_custom_fields: Json | null
          panda_tags: string[] | null
          pandavideo_external_id: string | null
          pandavideo_id: string | null
          preview_url: string | null
          product_category: string | null
          product_external_id: string | null
          product_id: string | null
          product_match_status: string | null
          product_subcategory: string | null
          relevance_score: number | null
          resin_id: string | null
          search_vector: unknown
          thumbnail_url: string | null
          title: string
          updated_at: string | null
          url: string | null
          video_duration_seconds: number | null
          video_transcript: string | null
          video_type: string
        }
        Insert: {
          analytics?: Json | null
          analytics_avg_retention?: number | null
          analytics_last_sync?: string | null
          analytics_play_rate?: number | null
          analytics_plays?: number | null
          analytics_unique_plays?: number | null
          analytics_unique_views?: number | null
          analytics_views?: number | null
          content_id?: string | null
          content_type?: string | null
          created_at?: string | null
          description?: string | null
          embed_url?: string | null
          folder_id?: string | null
          hls_url?: string | null
          id?: string
          is_premium?: boolean | null
          last_product_sync_at?: string | null
          order_index: number
          panda_config?: Json | null
          panda_custom_fields?: Json | null
          panda_tags?: string[] | null
          pandavideo_external_id?: string | null
          pandavideo_id?: string | null
          preview_url?: string | null
          product_category?: string | null
          product_external_id?: string | null
          product_id?: string | null
          product_match_status?: string | null
          product_subcategory?: string | null
          relevance_score?: number | null
          resin_id?: string | null
          search_vector?: unknown
          thumbnail_url?: string | null
          title: string
          updated_at?: string | null
          url?: string | null
          video_duration_seconds?: number | null
          video_transcript?: string | null
          video_type?: string
        }
        Update: {
          analytics?: Json | null
          analytics_avg_retention?: number | null
          analytics_last_sync?: string | null
          analytics_play_rate?: number | null
          analytics_plays?: number | null
          analytics_unique_plays?: number | null
          analytics_unique_views?: number | null
          analytics_views?: number | null
          content_id?: string | null
          content_type?: string | null
          created_at?: string | null
          description?: string | null
          embed_url?: string | null
          folder_id?: string | null
          hls_url?: string | null
          id?: string
          is_premium?: boolean | null
          last_product_sync_at?: string | null
          order_index?: number
          panda_config?: Json | null
          panda_custom_fields?: Json | null
          panda_tags?: string[] | null
          pandavideo_external_id?: string | null
          pandavideo_id?: string | null
          preview_url?: string | null
          product_category?: string | null
          product_external_id?: string | null
          product_id?: string | null
          product_match_status?: string | null
          product_subcategory?: string | null
          relevance_score?: number | null
          resin_id?: string | null
          search_vector?: unknown
          thumbnail_url?: string | null
          title?: string
          updated_at?: string | null
          url?: string | null
          video_duration_seconds?: number | null
          video_transcript?: string | null
          video_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_videos_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "knowledge_contents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_videos_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "system_a_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_videos_resin_id_fkey"
            columns: ["resin_id"]
            isOneToOne: false
            referencedRelation: "resins"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_activity_log: {
        Row: {
          company_id: string | null
          created_at: string | null
          duration_seconds: number | null
          entity_id: string | null
          entity_name: string | null
          entity_type: string | null
          event_data: Json
          event_timestamp: string
          event_type: string
          id: string
          ip_address: string | null
          lead_id: string
          person_id: string | null
          source_channel: string | null
          updated_at: string | null
          user_agent: string | null
          value_numeric: number | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          entity_id?: string | null
          entity_name?: string | null
          entity_type?: string | null
          event_data?: Json
          event_timestamp?: string
          event_type: string
          id?: string
          ip_address?: string | null
          lead_id: string
          person_id?: string | null
          source_channel?: string | null
          updated_at?: string | null
          user_agent?: string | null
          value_numeric?: number | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          entity_id?: string | null
          entity_name?: string | null
          entity_type?: string | null
          event_data?: Json
          event_timestamp?: string
          event_type?: string
          id?: string
          ip_address?: string | null
          lead_id?: string
          person_id?: string | null
          source_channel?: string | null
          updated_at?: string | null
          user_agent?: string | null
          value_numeric?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_activity_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_activity_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_customer_graph"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "lead_activity_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_person_company_graph"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "lead_activity_log_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "lead_model_routing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_activity_log_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "lia_attendances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_activity_log_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_academy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_activity_log_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_cognitive"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_activity_log_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_commercial"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_activity_log_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_ecommerce"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_activity_log_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_leads_correto"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "lead_activity_log_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_opportunity_engine"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "lead_activity_log_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_timing_alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_activity_log_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_workflow_portfolio"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "lead_activity_log_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_workflow_timeline"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "lead_activity_log_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_activity_log_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "v_customer_graph"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "lead_activity_log_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "v_person_company_graph"
            referencedColumns: ["person_id"]
          },
        ]
      }
      lead_cart_history: {
        Row: {
          abandoned_at: string | null
          abandoned_reason: string | null
          cart_id: string
          converted_at: string | null
          created_at: string
          id: string
          items: Json
          last_updated_at: string | null
          lead_id: string
          person_id: string | null
          recovered_at: string | null
          recovery_email_sent_at: string | null
          status: string | null
          total_value: number
          updated_at: string | null
        }
        Insert: {
          abandoned_at?: string | null
          abandoned_reason?: string | null
          cart_id: string
          converted_at?: string | null
          created_at?: string
          id?: string
          items?: Json
          last_updated_at?: string | null
          lead_id: string
          person_id?: string | null
          recovered_at?: string | null
          recovery_email_sent_at?: string | null
          status?: string | null
          total_value: number
          updated_at?: string | null
        }
        Update: {
          abandoned_at?: string | null
          abandoned_reason?: string | null
          cart_id?: string
          converted_at?: string | null
          created_at?: string
          id?: string
          items?: Json
          last_updated_at?: string | null
          lead_id?: string
          person_id?: string | null
          recovered_at?: string | null
          recovery_email_sent_at?: string | null
          status?: string | null
          total_value?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_cart_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "lead_model_routing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_cart_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "lia_attendances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_cart_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_academy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_cart_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_cognitive"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_cart_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_commercial"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_cart_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_ecommerce"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_cart_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_leads_correto"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "lead_cart_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_opportunity_engine"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "lead_cart_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_timing_alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_cart_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_workflow_portfolio"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "lead_cart_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_workflow_timeline"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "lead_cart_history_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_cart_history_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "v_customer_graph"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "lead_cart_history_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "v_person_company_graph"
            referencedColumns: ["person_id"]
          },
        ]
      }
      lead_conversion_history: {
        Row: {
          company_id: string | null
          conversion_date: string
          conversion_type: string
          created_at: string | null
          details: Json | null
          id: string
          lead_id: string
          person_id: string | null
          updated_at: string | null
        }
        Insert: {
          company_id?: string | null
          conversion_date: string
          conversion_type?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          lead_id: string
          person_id?: string | null
          updated_at?: string | null
        }
        Update: {
          company_id?: string | null
          conversion_date?: string
          conversion_type?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          lead_id?: string
          person_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_conversion_history_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_conversion_history_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_customer_graph"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "lead_conversion_history_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_person_company_graph"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "lead_conversion_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "lead_model_routing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_conversion_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "lia_attendances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_conversion_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_academy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_conversion_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_cognitive"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_conversion_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_commercial"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_conversion_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_ecommerce"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_conversion_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_leads_correto"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "lead_conversion_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_opportunity_engine"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "lead_conversion_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_timing_alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_conversion_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_workflow_portfolio"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "lead_conversion_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_workflow_timeline"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "lead_conversion_history_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_conversion_history_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "v_customer_graph"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "lead_conversion_history_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "v_person_company_graph"
            referencedColumns: ["person_id"]
          },
        ]
      }
      lead_course_progress: {
        Row: {
          completed_at: string | null
          course_category: string | null
          course_id: string
          course_name: string
          created_at: string | null
          id: string
          last_accessed_at: string | null
          lead_id: string
          lessons_completed: number | null
          lessons_total: number | null
          person_id: string | null
          progress_pct: number | null
          related_products: Json | null
          started_at: string | null
          status: string | null
          time_spent_seconds: number | null
          updated_at: string | null
        }
        Insert: {
          completed_at?: string | null
          course_category?: string | null
          course_id: string
          course_name: string
          created_at?: string | null
          id?: string
          last_accessed_at?: string | null
          lead_id: string
          lessons_completed?: number | null
          lessons_total?: number | null
          person_id?: string | null
          progress_pct?: number | null
          related_products?: Json | null
          started_at?: string | null
          status?: string | null
          time_spent_seconds?: number | null
          updated_at?: string | null
        }
        Update: {
          completed_at?: string | null
          course_category?: string | null
          course_id?: string
          course_name?: string
          created_at?: string | null
          id?: string
          last_accessed_at?: string | null
          lead_id?: string
          lessons_completed?: number | null
          lessons_total?: number | null
          person_id?: string | null
          progress_pct?: number | null
          related_products?: Json | null
          started_at?: string | null
          status?: string | null
          time_spent_seconds?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_course_progress_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "lead_model_routing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_course_progress_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "lia_attendances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_course_progress_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_academy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_course_progress_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_cognitive"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_course_progress_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_commercial"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_course_progress_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_ecommerce"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_course_progress_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_leads_correto"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "lead_course_progress_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_opportunity_engine"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "lead_course_progress_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_timing_alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_course_progress_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_workflow_portfolio"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "lead_course_progress_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_workflow_timeline"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "lead_course_progress_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_course_progress_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "v_customer_graph"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "lead_course_progress_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "v_person_company_graph"
            referencedColumns: ["person_id"]
          },
        ]
      }
      lead_enrichment_audit: {
        Row: {
          fields_updated: string[]
          id: string
          lead_id: string
          new_values: Json | null
          previous_values: Json | null
          source: string
          source_priority: number | null
          timestamp: string
        }
        Insert: {
          fields_updated?: string[]
          id?: string
          lead_id: string
          new_values?: Json | null
          previous_values?: Json | null
          source: string
          source_priority?: number | null
          timestamp?: string
        }
        Update: {
          fields_updated?: string[]
          id?: string
          lead_id?: string
          new_values?: Json | null
          previous_values?: Json | null
          source?: string
          source_priority?: number | null
          timestamp?: string
        }
        Relationships: []
      }
      lead_form_submissions: {
        Row: {
          assigned_to_sdr: string | null
          company_mentioned: string | null
          created_at: string | null
          equipment_mentioned: string | null
          form_data: Json
          form_id: string | null
          form_type: string
          id: string
          lead_id: string
          message: string | null
          person_id: string | null
          phone: string | null
          processed_at: string | null
          product_mentioned: string | null
          status: string | null
          submitted_at: string
          updated_at: string | null
        }
        Insert: {
          assigned_to_sdr?: string | null
          company_mentioned?: string | null
          created_at?: string | null
          equipment_mentioned?: string | null
          form_data?: Json
          form_id?: string | null
          form_type: string
          id?: string
          lead_id: string
          message?: string | null
          person_id?: string | null
          phone?: string | null
          processed_at?: string | null
          product_mentioned?: string | null
          status?: string | null
          submitted_at?: string
          updated_at?: string | null
        }
        Update: {
          assigned_to_sdr?: string | null
          company_mentioned?: string | null
          created_at?: string | null
          equipment_mentioned?: string | null
          form_data?: Json
          form_id?: string | null
          form_type?: string
          id?: string
          lead_id?: string
          message?: string | null
          person_id?: string | null
          phone?: string | null
          processed_at?: string | null
          product_mentioned?: string | null
          status?: string | null
          submitted_at?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_form_submissions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "lead_model_routing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_form_submissions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "lia_attendances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_form_submissions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_academy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_form_submissions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_cognitive"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_form_submissions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_commercial"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_form_submissions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_ecommerce"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_form_submissions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_leads_correto"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "lead_form_submissions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_opportunity_engine"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "lead_form_submissions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_timing_alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_form_submissions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_workflow_portfolio"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "lead_form_submissions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_workflow_timeline"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "lead_form_submissions_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_form_submissions_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "v_customer_graph"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "lead_form_submissions_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "v_person_company_graph"
            referencedColumns: ["person_id"]
          },
        ]
      }
      lead_opportunities: {
        Row: {
          competitor_product: string | null
          computed_at: string | null
          converted_deal_id: string | null
          id: string
          lead_id: string
          opportunity_type: string
          priority: string | null
          product_key: string | null
          product_name: string | null
          recommended_action: string | null
          recommended_message: string | null
          score: number
          signal_detail: string | null
          signal_source: string | null
          status: string | null
          updated_at: string | null
          value_est_brl: number | null
          workflow_stage: string
        }
        Insert: {
          competitor_product?: string | null
          computed_at?: string | null
          converted_deal_id?: string | null
          id?: string
          lead_id: string
          opportunity_type: string
          priority?: string | null
          product_key?: string | null
          product_name?: string | null
          recommended_action?: string | null
          recommended_message?: string | null
          score?: number
          signal_detail?: string | null
          signal_source?: string | null
          status?: string | null
          updated_at?: string | null
          value_est_brl?: number | null
          workflow_stage: string
        }
        Update: {
          competitor_product?: string | null
          computed_at?: string | null
          converted_deal_id?: string | null
          id?: string
          lead_id?: string
          opportunity_type?: string
          priority?: string | null
          product_key?: string | null
          product_name?: string | null
          recommended_action?: string | null
          recommended_message?: string | null
          score?: number
          signal_detail?: string | null
          signal_source?: string | null
          status?: string | null
          updated_at?: string | null
          value_est_brl?: number | null
          workflow_stage?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_opportunities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "lead_model_routing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_opportunities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "lia_attendances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_opportunities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_academy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_opportunities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_cognitive"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_opportunities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_commercial"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_opportunities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_ecommerce"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_opportunities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_leads_correto"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "lead_opportunities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_opportunity_engine"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "lead_opportunities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_timing_alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_opportunities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_workflow_portfolio"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "lead_opportunities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_workflow_timeline"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "lead_opportunities_product_key_fkey"
            columns: ["product_key"]
            isOneToOne: false
            referencedRelation: "product_taxonomy"
            referencedColumns: ["product_key"]
          },
        ]
      }
      lead_product_history: {
        Row: {
          added_to_cart_at: string | null
          avg_days_between_purchases: number | null
          cart_count: number | null
          company_id: string | null
          created_at: string | null
          days_since_last_purchase: number | null
          first_viewed_at: string | null
          id: string
          last_interaction_at: string | null
          last_interaction_type: string | null
          last_viewed_at: string | null
          lead_id: string
          person_id: string | null
          product_category: string | null
          product_id: string
          product_name: string
          purchase_count: number | null
          purchased_at: string | null
          total_purchased_qty: number | null
          total_purchased_value: number | null
          updated_at: string | null
          view_count: number | null
        }
        Insert: {
          added_to_cart_at?: string | null
          avg_days_between_purchases?: number | null
          cart_count?: number | null
          company_id?: string | null
          created_at?: string | null
          days_since_last_purchase?: number | null
          first_viewed_at?: string | null
          id?: string
          last_interaction_at?: string | null
          last_interaction_type?: string | null
          last_viewed_at?: string | null
          lead_id: string
          person_id?: string | null
          product_category?: string | null
          product_id: string
          product_name: string
          purchase_count?: number | null
          purchased_at?: string | null
          total_purchased_qty?: number | null
          total_purchased_value?: number | null
          updated_at?: string | null
          view_count?: number | null
        }
        Update: {
          added_to_cart_at?: string | null
          avg_days_between_purchases?: number | null
          cart_count?: number | null
          company_id?: string | null
          created_at?: string | null
          days_since_last_purchase?: number | null
          first_viewed_at?: string | null
          id?: string
          last_interaction_at?: string | null
          last_interaction_type?: string | null
          last_viewed_at?: string | null
          lead_id?: string
          person_id?: string | null
          product_category?: string | null
          product_id?: string
          product_name?: string
          purchase_count?: number | null
          purchased_at?: string | null
          total_purchased_qty?: number | null
          total_purchased_value?: number | null
          updated_at?: string | null
          view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_product_history_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_product_history_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_customer_graph"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "lead_product_history_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_person_company_graph"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "lead_product_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "lead_model_routing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_product_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "lia_attendances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_product_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_academy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_product_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_cognitive"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_product_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_commercial"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_product_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_ecommerce"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_product_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_leads_correto"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "lead_product_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_opportunity_engine"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "lead_product_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_timing_alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_product_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_workflow_portfolio"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "lead_product_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_workflow_timeline"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "lead_product_history_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_product_history_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "v_customer_graph"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "lead_product_history_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "v_person_company_graph"
            referencedColumns: ["person_id"]
          },
        ]
      }
      lead_sdr_interactions: {
        Row: {
          budget_mentioned: number | null
          competitor_mentioned: string[] | null
          contacted_at: string
          created_at: string | null
          deal_created: boolean | null
          deal_id: string | null
          equipment_mentioned: string[] | null
          follow_up_date: string | null
          follow_up_needed: boolean | null
          follow_up_notes: string | null
          id: string
          interaction_type: string | null
          lead_id: string
          notes: string | null
          outcome: string | null
          person_id: string | null
          product_interest: string[] | null
          sdr_email: string | null
          sdr_id: string | null
          sdr_name: string | null
          timeline_mentioned: string | null
          updated_at: string | null
        }
        Insert: {
          budget_mentioned?: number | null
          competitor_mentioned?: string[] | null
          contacted_at?: string
          created_at?: string | null
          deal_created?: boolean | null
          deal_id?: string | null
          equipment_mentioned?: string[] | null
          follow_up_date?: string | null
          follow_up_needed?: boolean | null
          follow_up_notes?: string | null
          id?: string
          interaction_type?: string | null
          lead_id: string
          notes?: string | null
          outcome?: string | null
          person_id?: string | null
          product_interest?: string[] | null
          sdr_email?: string | null
          sdr_id?: string | null
          sdr_name?: string | null
          timeline_mentioned?: string | null
          updated_at?: string | null
        }
        Update: {
          budget_mentioned?: number | null
          competitor_mentioned?: string[] | null
          contacted_at?: string
          created_at?: string | null
          deal_created?: boolean | null
          deal_id?: string | null
          equipment_mentioned?: string[] | null
          follow_up_date?: string | null
          follow_up_needed?: boolean | null
          follow_up_notes?: string | null
          id?: string
          interaction_type?: string | null
          lead_id?: string
          notes?: string | null
          outcome?: string | null
          person_id?: string | null
          product_interest?: string[] | null
          sdr_email?: string | null
          sdr_id?: string | null
          sdr_name?: string | null
          timeline_mentioned?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_sdr_interactions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "lead_model_routing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_sdr_interactions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "lia_attendances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_sdr_interactions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_academy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_sdr_interactions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_cognitive"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_sdr_interactions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_commercial"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_sdr_interactions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_ecommerce"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_sdr_interactions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_leads_correto"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "lead_sdr_interactions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_opportunity_engine"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "lead_sdr_interactions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_timing_alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_sdr_interactions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_workflow_portfolio"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "lead_sdr_interactions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_workflow_timeline"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "lead_sdr_interactions_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_sdr_interactions_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "v_customer_graph"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "lead_sdr_interactions_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "v_person_company_graph"
            referencedColumns: ["person_id"]
          },
        ]
      }
      lead_state_events: {
        Row: {
          changed_at: string
          cognitive_stage: string | null
          id: string
          intelligence_score: Json | null
          is_regression: boolean
          lead_id: string
          new_stage: string | null
          old_stage: string | null
          owner_id: string | null
          regression_gap_days: number | null
          source: string
        }
        Insert: {
          changed_at?: string
          cognitive_stage?: string | null
          id?: string
          intelligence_score?: Json | null
          is_regression?: boolean
          lead_id: string
          new_stage?: string | null
          old_stage?: string | null
          owner_id?: string | null
          regression_gap_days?: number | null
          source?: string
        }
        Update: {
          changed_at?: string
          cognitive_stage?: string | null
          id?: string
          intelligence_score?: Json | null
          is_regression?: boolean
          lead_id?: string
          new_stage?: string | null
          old_stage?: string | null
          owner_id?: string | null
          regression_gap_days?: number | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_state_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "lead_model_routing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_state_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "lia_attendances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_state_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_academy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_state_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_cognitive"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_state_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_commercial"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_state_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_ecommerce"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_state_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_leads_correto"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "lead_state_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_opportunity_engine"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "lead_state_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_timing_alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_state_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_workflow_portfolio"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "lead_state_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_workflow_timeline"
            referencedColumns: ["lead_id"]
          },
        ]
      }
      leads: {
        Row: {
          created_at: string | null
          email: string
          equipment_status: string | null
          id: string
          name: string
          pain_point: string | null
          phone: string | null
          source: string | null
          specialty: string | null
          spin_completed: boolean | null
          updated_at: string | null
          workflow_interest: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          equipment_status?: string | null
          id?: string
          name: string
          pain_point?: string | null
          phone?: string | null
          source?: string | null
          specialty?: string | null
          spin_completed?: boolean | null
          updated_at?: string | null
          workflow_interest?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          equipment_status?: string | null
          id?: string
          name?: string
          pain_point?: string | null
          phone?: string | null
          source?: string | null
          specialty?: string | null
          spin_completed?: boolean | null
          updated_at?: string | null
          workflow_interest?: string | null
        }
        Relationships: []
      }
      lia_attendances: {
        Row: {
          academy_curso_concluido: string[] | null
          academy_progresso_pct: number | null
          academy_ultimo_modulo_acessado: string | null
          anchor_product: string | null
          area_atuacao: string | null
          astron_courses_access: Json | null
          astron_courses_completed: number | null
          astron_courses_total: number | null
          astron_created_at: string | null
          astron_email: string | null
          astron_last_login_at: string | null
          astron_login_url: string | null
          astron_nome: string | null
          astron_phone: string | null
          astron_plans_active: string[] | null
          astron_plans_data: Json | null
          astron_status: string | null
          astron_synced_at: string | null
          astron_user_id: number | null
          ativo_cad: boolean | null
          ativo_cad_ia: boolean | null
          ativo_cura: boolean | null
          ativo_insumos: boolean | null
          ativo_notebook: boolean | null
          ativo_print: boolean | null
          ativo_scan: boolean | null
          ativo_smart_slice: boolean | null
          automation_cooldown_until: string | null
          avg_ticket: number | null
          buyer_type: string | null
          churn_risk_score: number | null
          cidade: string | null
          codigo_contrato: string | null
          cognitive_analysis: Json | null
          cognitive_analyzed_at: string | null
          cognitive_context_hash: string | null
          cognitive_model_version: string | null
          cognitive_prompt_hash: string | null
          cognitive_updated_at: string | null
          comentario_perda: string | null
          como_digitaliza: string | null
          company_hash: string | null
          company_id: string | null
          confidence_score_analysis: number | null
          created_at: string
          crm_lock_source: string | null
          crm_lock_until: string | null
          cs_treinamento: string | null
          data_contrato: string | null
          data_fechamento_crm: string | null
          data_primeiro_contato: string | null
          data_treinamento: string | null
          data_ultima_compra_cad: string | null
          data_ultima_compra_cad_ia: string | null
          data_ultima_compra_cura: string | null
          data_ultima_compra_insumos: string | null
          data_ultima_compra_notebook: string | null
          data_ultima_compra_print: string | null
          data_ultima_compra_scan: string | null
          data_ultima_compra_smart_slice: string | null
          email: string
          empresa_cidade: string | null
          empresa_cnae: string | null
          empresa_cnaes: Json | null
          empresa_cnpj: string | null
          empresa_custom_fields: Json | null
          empresa_data_abertura: string | null
          empresa_email: string | null
          empresa_email_nf: string | null
          empresa_endereco: Json | null
          empresa_facebook: string | null
          empresa_hash: string | null
          empresa_ie: string | null
          empresa_linkedin: string | null
          empresa_nome: string | null
          empresa_pais: string | null
          empresa_piperun_id: number | null
          empresa_porte: string | null
          empresa_razao_social: string | null
          empresa_segmento: string | null
          empresa_situacao: string | null
          empresa_telefone: string | null
          empresa_touch_model: string | null
          empresa_uf: string | null
          empresa_website: string | null
          entrada_sistema: string
          equip_cad: string | null
          equip_cad_ativacao: string | null
          equip_cad_serial: string | null
          equip_fresadora: string | null
          equip_fresadora_ativacao: string | null
          equip_fresadora_idade_meses: number | null
          equip_fresadora_serial: string | null
          equip_impressora: string | null
          equip_impressora_ativacao: string | null
          equip_impressora_ativacao_estimada: string | null
          equip_impressora_idade_meses: number | null
          equip_impressora_serial: string | null
          equip_notebook: string | null
          equip_notebook_ativacao: string | null
          equip_notebook_serial: string | null
          equip_pos_impressao: string | null
          equip_pos_impressao_ativacao: string | null
          equip_pos_impressao_serial: string | null
          equip_scanner: string | null
          equip_scanner_ativacao: string | null
          equip_scanner_ativacao_estimada: string | null
          equip_scanner_bancada: string | null
          equip_scanner_bancada_ativacao: string | null
          equip_scanner_bancada_serial: string | null
          equip_scanner_idade_meses: number | null
          equip_scanner_serial: string | null
          equip_upgrade_produto: string | null
          equip_upgrade_reasoning: string | null
          equip_upgrade_signal: boolean | null
          equip_upgrade_urgency: string | null
          especialidade: string | null
          form_name: string | null
          funil_entrada_crm: string | null
          historico_resumos: Json | null
          hits_cad: number | null
          hits_e1_acessorios: number | null
          hits_e1_notebook: number | null
          hits_e1_pecas_partes: number | null
          hits_e1_scanner_bancada: number | null
          hits_e1_scanner_intraoral: number | null
          hits_e2_creditos_ia: number | null
          hits_e2_pecas_partes: number | null
          hits_e2_servico: number | null
          hits_e2_software: number | null
          hits_e3_acessorios: number | null
          hits_e3_impressora: number | null
          hits_e3_pecas_partes: number | null
          hits_e3_resina: number | null
          hits_e3_software: number | null
          hits_e4_equipamentos: number | null
          hits_e4_limpeza_acabamento: number | null
          hits_e5_caracterizacao: number | null
          hits_e5_dentistica_orto: number | null
          hits_e5_instalacao: number | null
          hits_e6_online: number | null
          hits_e6_presencial: number | null
          hits_e7_acessorios: number | null
          hits_e7_equipamentos: number | null
          hits_e7_pecas_partes: number | null
          hits_e7_servico: number | null
          hits_e7_software: number | null
          hits_finalizacao: number | null
          hits_fresagem: number | null
          hits_impressao3d: number | null
          hits_insumos_cursos: number | null
          hits_pos_impressao: number | null
          hits_scanner: number | null
          id: string
          id_cliente_smart: string | null
          imersao_concluida: boolean | null
          imersao_data: string | null
          imersao_equipamentos_treinados: string[] | null
          imersao_turma_id: string | null
          impressora_modelo: string | null
          informacao_desejada: string | null
          insumos_adquiridos: string | null
          intelligence_score: Json | null
          intelligence_score_backfilled_at: string | null
          intelligence_score_total: number | null
          intelligence_score_updated_at: string | null
          interest_timeline: string | null
          ip_origem: string | null
          itens_proposta_crm: string | null
          itens_proposta_parsed: Json | null
          last_automated_action_at: string | null
          last_deal_date: string | null
          last_deal_value: number | null
          last_form_cad: string | null
          last_form_date_cad: string | null
          last_form_date_finalizacao: string | null
          last_form_date_fresagem: string | null
          last_form_date_impressao: string | null
          last_form_date_insumos: string | null
          last_form_date_pos_impressao: string | null
          last_form_date_scanner: string | null
          last_form_finalizacao: string | null
          last_form_fresagem: string | null
          last_form_impressao: string | null
          last_form_insumos: string | null
          last_form_pos_impressao: string | null
          last_form_scanner: string | null
          last_sync_at: string | null
          last_sync_source: string | null
          lead_card_published_at: string | null
          lead_card_url: string | null
          lead_stage_detected: string | null
          lead_status: string
          lead_timing_dias: number | null
          lojaintegrada_bairro: string | null
          lojaintegrada_bandeira_cartao: string | null
          lojaintegrada_cep: string | null
          lojaintegrada_cliente_data_criacao: string | null
          lojaintegrada_cliente_id: number | null
          lojaintegrada_cliente_obs: string | null
          lojaintegrada_complemento: string | null
          lojaintegrada_cupom_desconto: string | null
          lojaintegrada_cupom_json: Json | null
          lojaintegrada_data_modificacao: string | null
          lojaintegrada_data_nascimento: string | null
          lojaintegrada_endereco: string | null
          lojaintegrada_forma_envio: string | null
          lojaintegrada_forma_pagamento: string | null
          lojaintegrada_historico_pedidos: Json | null
          lojaintegrada_itens_json: Json | null
          lojaintegrada_ltv: number | null
          lojaintegrada_marketplace: Json | null
          lojaintegrada_numero: string | null
          lojaintegrada_parcelas: number | null
          lojaintegrada_pedido_id: number | null
          lojaintegrada_peso_real: number | null
          lojaintegrada_primeira_compra: string | null
          lojaintegrada_raw_payload: Json | null
          lojaintegrada_referencia: string | null
          lojaintegrada_sexo: string | null
          lojaintegrada_tipo_pessoa: string | null
          lojaintegrada_total_pedidos_pagos: number | null
          lojaintegrada_tracking_code: string | null
          lojaintegrada_ultimo_pedido_data: string | null
          lojaintegrada_ultimo_pedido_numero: number | null
          lojaintegrada_ultimo_pedido_status: string | null
          lojaintegrada_ultimo_pedido_valor: number | null
          lojaintegrada_updated_at: string | null
          lojaintegrada_utm_campaign: string | null
          lojaintegrada_valor_desconto: number | null
          lojaintegrada_valor_envio: number | null
          lojaintegrada_valor_subtotal: number | null
          ltv_projected_12m: number | null
          ltv_projected_24m: number | null
          ltv_total: number | null
          map_fresadora_date: string | null
          map_fresadora_marca: string | null
          map_fresadora_modelo: string | null
          merge_history: Json | null
          merged_at: string | null
          merged_into: string | null
          motivo_perda: string | null
          next_purchase_probability: number | null
          next_purchase_product: string | null
          next_purchase_value: number | null
          next_purchase_window_end: string | null
          next_purchase_window_start: string | null
          next_upsell_date_est: string | null
          next_upsell_product: string | null
          next_upsell_score: number | null
          next_upsell_stage: string | null
          nome: string
          nps_recomendaria: number | null
          nps_respondido_em: string | null
          nps_satisfacao: number | null
          nps_temas_cursos: string[] | null
          objection_risk: string | null
          opportunity_score: number | null
          opportunity_signals: Json | null
          origem_campanha: string | null
          original_date: string | null
          original_id: string | null
          original_source: string | null
          pais_origem: string | null
          person_hash: string | null
          person_id: string | null
          pessoa_cargo: string | null
          pessoa_cpf: string | null
          pessoa_endereco: Json | null
          pessoa_facebook: string | null
          pessoa_genero: string | null
          pessoa_hash: string | null
          pessoa_lgpd: Json | null
          pessoa_linkedin: string | null
          pessoa_manager: Json | null
          pessoa_nascimento: string | null
          pessoa_observation: string | null
          pessoa_piperun_id: number | null
          pessoa_rdstation: string | null
          pessoa_website: string | null
          piperun_action: Json | null
          piperun_activities: Json | null
          piperun_closed_at: string | null
          piperun_created_at: string | null
          piperun_custom_fields: Json | null
          piperun_deal_city: string | null
          piperun_deal_order: number | null
          piperun_deals_history: Json | null
          piperun_deleted: boolean | null
          piperun_description: string | null
          piperun_files: Json | null
          piperun_forms: Json | null
          piperun_frozen: boolean | null
          piperun_frozen_at: string | null
          piperun_hash: string | null
          piperun_id: string | null
          piperun_involved_users: Json | null
          piperun_last_contact_at: string | null
          piperun_lead_time: number | null
          piperun_link: string | null
          piperun_observation: string | null
          piperun_origin_id: number | null
          piperun_origin_name: string | null
          piperun_origin_sub_name: string | null
          piperun_owner_id: number | null
          piperun_pipeline_id: number | null
          piperun_pipeline_name: string | null
          piperun_probability: number | null
          piperun_probably_closed_at: string | null
          piperun_raw_payload: Json | null
          piperun_stage_changed_at: string | null
          piperun_stage_id: number | null
          piperun_stage_name: string | null
          piperun_status: number | null
          piperun_tags_raw: Json | null
          piperun_title: string | null
          piperun_updated_at: string | null
          piperun_value_mrr: number | null
          platform: string | null
          platform_ad_id: string | null
          platform_adgroup_id: string | null
          platform_campaign_id: string | null
          platform_cpl: number | null
          platform_form_id: string | null
          platform_lead_id: string | null
          platform_placement: string | null
          portfolio_json: Json | null
          portfolio_updated_at: string | null
          prediction_accuracy: number | null
          predictions_updated_at: string | null
          primary_motivation: string | null
          principal_aplicacao: string | null
          proactive_count: number | null
          proactive_sent_at: string | null
          produto_interesse: string | null
          produto_interesse_auto: string | null
          proposals_data: Json | null
          proposals_last_status: number | null
          proposals_total_mrr: number | null
          proposals_total_value: number | null
          proprietario_lead_crm: string | null
          psychological_profile: string | null
          raw_payload: Json | null
          recommended_approach: string | null
          recompra_alert: boolean | null
          recompra_days_overdue: number | null
          recompra_stage: string | null
          resina_consumo_mensal_estimado: number | null
          resina_interesse: string | null
          resumo_historico_ia: string | null
          reuniao_agendada: boolean | null
          rota_inicial_lia: string | null
          score: number | null
          sdr_cad_funcionalidades: string | null
          sdr_cad_licenca: string | null
          sdr_cad_treinamento: string | null
          sdr_caracterizacao_interesse: string | null
          sdr_caracterizacao_produto_atual: string | null
          sdr_cura_modelo: string | null
          sdr_cursos_area: string | null
          sdr_cursos_interesse: string | null
          sdr_cursos_modalidade: string | null
          sdr_dentistica_interesse: string | null
          sdr_fresadora_marca: string | null
          sdr_fresadora_modelo: string | null
          sdr_fresagem_interesse: string | null
          sdr_impressora_interesse: string | null
          sdr_insumos_lab_interesse: string | null
          sdr_insumos_tipo: string | null
          sdr_marca_impressora_param: string | null
          sdr_modelo_impressora_param: string | null
          sdr_pos_impressao_interesse: string | null
          sdr_resina_atual: string | null
          sdr_resina_param: string | null
          sdr_scanner_interesse: string | null
          sdr_scanner_modelo: string | null
          sdr_smartgum_interesse: boolean | null
          sdr_smartmake_interesse: boolean | null
          sdr_software_cad_interesse: string | null
          sdr_solucoes_interesse: string | null
          sdr_suporte_descricao: string | null
          sdr_suporte_equipamento: string | null
          sdr_suporte_tipo: string | null
          sdr_usa_resina_smartdent: boolean | null
          sellflux_custom_fields: Json | null
          sellflux_synced_at: string | null
          software_cad: string | null
          source: string
          source_reference: string | null
          status_atual_lead_crm: string | null
          status_cad: string | null
          status_impressora: string | null
          status_insumos: string | null
          status_oportunidade: string | null
          status_pos_impressao: string | null
          status_scanner: string | null
          suporte_educacional_tickets_total: number | null
          suporte_impressora_tickets_6m: number | null
          suporte_tecnico_tickets_total: number | null
          tags_crm: string[] | null
          telefone_normalized: string | null
          telefone_raw: string | null
          tem_impressora: string | null
          tem_scanner: string | null
          temperatura_lead: string | null
          timeline_cad: Json | null
          timeline_cursos: Json | null
          timeline_finalizacao: Json | null
          timeline_fresagem: Json | null
          timeline_impressao: Json | null
          timeline_pos_impressao: Json | null
          timeline_scanner: Json | null
          total_deals: number | null
          total_messages: number | null
          total_sessions: number | null
          uf: string | null
          ultima_etapa_comercial: string | null
          ultima_sessao_at: string | null
          updated_at: string
          urgency_level: string | null
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          valor_oportunidade: number | null
          volume_mensal_pecas: string | null
          wa_group_origem: string | null
          workflow_portfolio: Json | null
          workflow_score: number | null
          workflow_timeline: Json | null
          workflow_timeline_updated_at: string | null
        }
        Insert: {
          academy_curso_concluido?: string[] | null
          academy_progresso_pct?: number | null
          academy_ultimo_modulo_acessado?: string | null
          anchor_product?: string | null
          area_atuacao?: string | null
          astron_courses_access?: Json | null
          astron_courses_completed?: number | null
          astron_courses_total?: number | null
          astron_created_at?: string | null
          astron_email?: string | null
          astron_last_login_at?: string | null
          astron_login_url?: string | null
          astron_nome?: string | null
          astron_phone?: string | null
          astron_plans_active?: string[] | null
          astron_plans_data?: Json | null
          astron_status?: string | null
          astron_synced_at?: string | null
          astron_user_id?: number | null
          ativo_cad?: boolean | null
          ativo_cad_ia?: boolean | null
          ativo_cura?: boolean | null
          ativo_insumos?: boolean | null
          ativo_notebook?: boolean | null
          ativo_print?: boolean | null
          ativo_scan?: boolean | null
          ativo_smart_slice?: boolean | null
          automation_cooldown_until?: string | null
          avg_ticket?: number | null
          buyer_type?: string | null
          churn_risk_score?: number | null
          cidade?: string | null
          codigo_contrato?: string | null
          cognitive_analysis?: Json | null
          cognitive_analyzed_at?: string | null
          cognitive_context_hash?: string | null
          cognitive_model_version?: string | null
          cognitive_prompt_hash?: string | null
          cognitive_updated_at?: string | null
          comentario_perda?: string | null
          como_digitaliza?: string | null
          company_hash?: string | null
          company_id?: string | null
          confidence_score_analysis?: number | null
          created_at?: string
          crm_lock_source?: string | null
          crm_lock_until?: string | null
          cs_treinamento?: string | null
          data_contrato?: string | null
          data_fechamento_crm?: string | null
          data_primeiro_contato?: string | null
          data_treinamento?: string | null
          data_ultima_compra_cad?: string | null
          data_ultima_compra_cad_ia?: string | null
          data_ultima_compra_cura?: string | null
          data_ultima_compra_insumos?: string | null
          data_ultima_compra_notebook?: string | null
          data_ultima_compra_print?: string | null
          data_ultima_compra_scan?: string | null
          data_ultima_compra_smart_slice?: string | null
          email: string
          empresa_cidade?: string | null
          empresa_cnae?: string | null
          empresa_cnaes?: Json | null
          empresa_cnpj?: string | null
          empresa_custom_fields?: Json | null
          empresa_data_abertura?: string | null
          empresa_email?: string | null
          empresa_email_nf?: string | null
          empresa_endereco?: Json | null
          empresa_facebook?: string | null
          empresa_hash?: string | null
          empresa_ie?: string | null
          empresa_linkedin?: string | null
          empresa_nome?: string | null
          empresa_pais?: string | null
          empresa_piperun_id?: number | null
          empresa_porte?: string | null
          empresa_razao_social?: string | null
          empresa_segmento?: string | null
          empresa_situacao?: string | null
          empresa_telefone?: string | null
          empresa_touch_model?: string | null
          empresa_uf?: string | null
          empresa_website?: string | null
          entrada_sistema?: string
          equip_cad?: string | null
          equip_cad_ativacao?: string | null
          equip_cad_serial?: string | null
          equip_fresadora?: string | null
          equip_fresadora_ativacao?: string | null
          equip_fresadora_idade_meses?: number | null
          equip_fresadora_serial?: string | null
          equip_impressora?: string | null
          equip_impressora_ativacao?: string | null
          equip_impressora_ativacao_estimada?: string | null
          equip_impressora_idade_meses?: number | null
          equip_impressora_serial?: string | null
          equip_notebook?: string | null
          equip_notebook_ativacao?: string | null
          equip_notebook_serial?: string | null
          equip_pos_impressao?: string | null
          equip_pos_impressao_ativacao?: string | null
          equip_pos_impressao_serial?: string | null
          equip_scanner?: string | null
          equip_scanner_ativacao?: string | null
          equip_scanner_ativacao_estimada?: string | null
          equip_scanner_bancada?: string | null
          equip_scanner_bancada_ativacao?: string | null
          equip_scanner_bancada_serial?: string | null
          equip_scanner_idade_meses?: number | null
          equip_scanner_serial?: string | null
          equip_upgrade_produto?: string | null
          equip_upgrade_reasoning?: string | null
          equip_upgrade_signal?: boolean | null
          equip_upgrade_urgency?: string | null
          especialidade?: string | null
          form_name?: string | null
          funil_entrada_crm?: string | null
          historico_resumos?: Json | null
          hits_cad?: number | null
          hits_e1_acessorios?: number | null
          hits_e1_notebook?: number | null
          hits_e1_pecas_partes?: number | null
          hits_e1_scanner_bancada?: number | null
          hits_e1_scanner_intraoral?: number | null
          hits_e2_creditos_ia?: number | null
          hits_e2_pecas_partes?: number | null
          hits_e2_servico?: number | null
          hits_e2_software?: number | null
          hits_e3_acessorios?: number | null
          hits_e3_impressora?: number | null
          hits_e3_pecas_partes?: number | null
          hits_e3_resina?: number | null
          hits_e3_software?: number | null
          hits_e4_equipamentos?: number | null
          hits_e4_limpeza_acabamento?: number | null
          hits_e5_caracterizacao?: number | null
          hits_e5_dentistica_orto?: number | null
          hits_e5_instalacao?: number | null
          hits_e6_online?: number | null
          hits_e6_presencial?: number | null
          hits_e7_acessorios?: number | null
          hits_e7_equipamentos?: number | null
          hits_e7_pecas_partes?: number | null
          hits_e7_servico?: number | null
          hits_e7_software?: number | null
          hits_finalizacao?: number | null
          hits_fresagem?: number | null
          hits_impressao3d?: number | null
          hits_insumos_cursos?: number | null
          hits_pos_impressao?: number | null
          hits_scanner?: number | null
          id?: string
          id_cliente_smart?: string | null
          imersao_concluida?: boolean | null
          imersao_data?: string | null
          imersao_equipamentos_treinados?: string[] | null
          imersao_turma_id?: string | null
          impressora_modelo?: string | null
          informacao_desejada?: string | null
          insumos_adquiridos?: string | null
          intelligence_score?: Json | null
          intelligence_score_backfilled_at?: string | null
          intelligence_score_total?: number | null
          intelligence_score_updated_at?: string | null
          interest_timeline?: string | null
          ip_origem?: string | null
          itens_proposta_crm?: string | null
          itens_proposta_parsed?: Json | null
          last_automated_action_at?: string | null
          last_deal_date?: string | null
          last_deal_value?: number | null
          last_form_cad?: string | null
          last_form_date_cad?: string | null
          last_form_date_finalizacao?: string | null
          last_form_date_fresagem?: string | null
          last_form_date_impressao?: string | null
          last_form_date_insumos?: string | null
          last_form_date_pos_impressao?: string | null
          last_form_date_scanner?: string | null
          last_form_finalizacao?: string | null
          last_form_fresagem?: string | null
          last_form_impressao?: string | null
          last_form_insumos?: string | null
          last_form_pos_impressao?: string | null
          last_form_scanner?: string | null
          last_sync_at?: string | null
          last_sync_source?: string | null
          lead_card_published_at?: string | null
          lead_card_url?: string | null
          lead_stage_detected?: string | null
          lead_status?: string
          lead_timing_dias?: number | null
          lojaintegrada_bairro?: string | null
          lojaintegrada_bandeira_cartao?: string | null
          lojaintegrada_cep?: string | null
          lojaintegrada_cliente_data_criacao?: string | null
          lojaintegrada_cliente_id?: number | null
          lojaintegrada_cliente_obs?: string | null
          lojaintegrada_complemento?: string | null
          lojaintegrada_cupom_desconto?: string | null
          lojaintegrada_cupom_json?: Json | null
          lojaintegrada_data_modificacao?: string | null
          lojaintegrada_data_nascimento?: string | null
          lojaintegrada_endereco?: string | null
          lojaintegrada_forma_envio?: string | null
          lojaintegrada_forma_pagamento?: string | null
          lojaintegrada_historico_pedidos?: Json | null
          lojaintegrada_itens_json?: Json | null
          lojaintegrada_ltv?: number | null
          lojaintegrada_marketplace?: Json | null
          lojaintegrada_numero?: string | null
          lojaintegrada_parcelas?: number | null
          lojaintegrada_pedido_id?: number | null
          lojaintegrada_peso_real?: number | null
          lojaintegrada_primeira_compra?: string | null
          lojaintegrada_raw_payload?: Json | null
          lojaintegrada_referencia?: string | null
          lojaintegrada_sexo?: string | null
          lojaintegrada_tipo_pessoa?: string | null
          lojaintegrada_total_pedidos_pagos?: number | null
          lojaintegrada_tracking_code?: string | null
          lojaintegrada_ultimo_pedido_data?: string | null
          lojaintegrada_ultimo_pedido_numero?: number | null
          lojaintegrada_ultimo_pedido_status?: string | null
          lojaintegrada_ultimo_pedido_valor?: number | null
          lojaintegrada_updated_at?: string | null
          lojaintegrada_utm_campaign?: string | null
          lojaintegrada_valor_desconto?: number | null
          lojaintegrada_valor_envio?: number | null
          lojaintegrada_valor_subtotal?: number | null
          ltv_projected_12m?: number | null
          ltv_projected_24m?: number | null
          ltv_total?: number | null
          map_fresadora_date?: string | null
          map_fresadora_marca?: string | null
          map_fresadora_modelo?: string | null
          merge_history?: Json | null
          merged_at?: string | null
          merged_into?: string | null
          motivo_perda?: string | null
          next_purchase_probability?: number | null
          next_purchase_product?: string | null
          next_purchase_value?: number | null
          next_purchase_window_end?: string | null
          next_purchase_window_start?: string | null
          next_upsell_date_est?: string | null
          next_upsell_product?: string | null
          next_upsell_score?: number | null
          next_upsell_stage?: string | null
          nome: string
          nps_recomendaria?: number | null
          nps_respondido_em?: string | null
          nps_satisfacao?: number | null
          nps_temas_cursos?: string[] | null
          objection_risk?: string | null
          opportunity_score?: number | null
          opportunity_signals?: Json | null
          origem_campanha?: string | null
          original_date?: string | null
          original_id?: string | null
          original_source?: string | null
          pais_origem?: string | null
          person_hash?: string | null
          person_id?: string | null
          pessoa_cargo?: string | null
          pessoa_cpf?: string | null
          pessoa_endereco?: Json | null
          pessoa_facebook?: string | null
          pessoa_genero?: string | null
          pessoa_hash?: string | null
          pessoa_lgpd?: Json | null
          pessoa_linkedin?: string | null
          pessoa_manager?: Json | null
          pessoa_nascimento?: string | null
          pessoa_observation?: string | null
          pessoa_piperun_id?: number | null
          pessoa_rdstation?: string | null
          pessoa_website?: string | null
          piperun_action?: Json | null
          piperun_activities?: Json | null
          piperun_closed_at?: string | null
          piperun_created_at?: string | null
          piperun_custom_fields?: Json | null
          piperun_deal_city?: string | null
          piperun_deal_order?: number | null
          piperun_deals_history?: Json | null
          piperun_deleted?: boolean | null
          piperun_description?: string | null
          piperun_files?: Json | null
          piperun_forms?: Json | null
          piperun_frozen?: boolean | null
          piperun_frozen_at?: string | null
          piperun_hash?: string | null
          piperun_id?: string | null
          piperun_involved_users?: Json | null
          piperun_last_contact_at?: string | null
          piperun_lead_time?: number | null
          piperun_link?: string | null
          piperun_observation?: string | null
          piperun_origin_id?: number | null
          piperun_origin_name?: string | null
          piperun_origin_sub_name?: string | null
          piperun_owner_id?: number | null
          piperun_pipeline_id?: number | null
          piperun_pipeline_name?: string | null
          piperun_probability?: number | null
          piperun_probably_closed_at?: string | null
          piperun_raw_payload?: Json | null
          piperun_stage_changed_at?: string | null
          piperun_stage_id?: number | null
          piperun_stage_name?: string | null
          piperun_status?: number | null
          piperun_tags_raw?: Json | null
          piperun_title?: string | null
          piperun_updated_at?: string | null
          piperun_value_mrr?: number | null
          platform?: string | null
          platform_ad_id?: string | null
          platform_adgroup_id?: string | null
          platform_campaign_id?: string | null
          platform_cpl?: number | null
          platform_form_id?: string | null
          platform_lead_id?: string | null
          platform_placement?: string | null
          portfolio_json?: Json | null
          portfolio_updated_at?: string | null
          prediction_accuracy?: number | null
          predictions_updated_at?: string | null
          primary_motivation?: string | null
          principal_aplicacao?: string | null
          proactive_count?: number | null
          proactive_sent_at?: string | null
          produto_interesse?: string | null
          produto_interesse_auto?: string | null
          proposals_data?: Json | null
          proposals_last_status?: number | null
          proposals_total_mrr?: number | null
          proposals_total_value?: number | null
          proprietario_lead_crm?: string | null
          psychological_profile?: string | null
          raw_payload?: Json | null
          recommended_approach?: string | null
          recompra_alert?: boolean | null
          recompra_days_overdue?: number | null
          recompra_stage?: string | null
          resina_consumo_mensal_estimado?: number | null
          resina_interesse?: string | null
          resumo_historico_ia?: string | null
          reuniao_agendada?: boolean | null
          rota_inicial_lia?: string | null
          score?: number | null
          sdr_cad_funcionalidades?: string | null
          sdr_cad_licenca?: string | null
          sdr_cad_treinamento?: string | null
          sdr_caracterizacao_interesse?: string | null
          sdr_caracterizacao_produto_atual?: string | null
          sdr_cura_modelo?: string | null
          sdr_cursos_area?: string | null
          sdr_cursos_interesse?: string | null
          sdr_cursos_modalidade?: string | null
          sdr_dentistica_interesse?: string | null
          sdr_fresadora_marca?: string | null
          sdr_fresadora_modelo?: string | null
          sdr_fresagem_interesse?: string | null
          sdr_impressora_interesse?: string | null
          sdr_insumos_lab_interesse?: string | null
          sdr_insumos_tipo?: string | null
          sdr_marca_impressora_param?: string | null
          sdr_modelo_impressora_param?: string | null
          sdr_pos_impressao_interesse?: string | null
          sdr_resina_atual?: string | null
          sdr_resina_param?: string | null
          sdr_scanner_interesse?: string | null
          sdr_scanner_modelo?: string | null
          sdr_smartgum_interesse?: boolean | null
          sdr_smartmake_interesse?: boolean | null
          sdr_software_cad_interesse?: string | null
          sdr_solucoes_interesse?: string | null
          sdr_suporte_descricao?: string | null
          sdr_suporte_equipamento?: string | null
          sdr_suporte_tipo?: string | null
          sdr_usa_resina_smartdent?: boolean | null
          sellflux_custom_fields?: Json | null
          sellflux_synced_at?: string | null
          software_cad?: string | null
          source?: string
          source_reference?: string | null
          status_atual_lead_crm?: string | null
          status_cad?: string | null
          status_impressora?: string | null
          status_insumos?: string | null
          status_oportunidade?: string | null
          status_pos_impressao?: string | null
          status_scanner?: string | null
          suporte_educacional_tickets_total?: number | null
          suporte_impressora_tickets_6m?: number | null
          suporte_tecnico_tickets_total?: number | null
          tags_crm?: string[] | null
          telefone_normalized?: string | null
          telefone_raw?: string | null
          tem_impressora?: string | null
          tem_scanner?: string | null
          temperatura_lead?: string | null
          timeline_cad?: Json | null
          timeline_cursos?: Json | null
          timeline_finalizacao?: Json | null
          timeline_fresagem?: Json | null
          timeline_impressao?: Json | null
          timeline_pos_impressao?: Json | null
          timeline_scanner?: Json | null
          total_deals?: number | null
          total_messages?: number | null
          total_sessions?: number | null
          uf?: string | null
          ultima_etapa_comercial?: string | null
          ultima_sessao_at?: string | null
          updated_at?: string
          urgency_level?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          valor_oportunidade?: number | null
          volume_mensal_pecas?: string | null
          wa_group_origem?: string | null
          workflow_portfolio?: Json | null
          workflow_score?: number | null
          workflow_timeline?: Json | null
          workflow_timeline_updated_at?: string | null
        }
        Update: {
          academy_curso_concluido?: string[] | null
          academy_progresso_pct?: number | null
          academy_ultimo_modulo_acessado?: string | null
          anchor_product?: string | null
          area_atuacao?: string | null
          astron_courses_access?: Json | null
          astron_courses_completed?: number | null
          astron_courses_total?: number | null
          astron_created_at?: string | null
          astron_email?: string | null
          astron_last_login_at?: string | null
          astron_login_url?: string | null
          astron_nome?: string | null
          astron_phone?: string | null
          astron_plans_active?: string[] | null
          astron_plans_data?: Json | null
          astron_status?: string | null
          astron_synced_at?: string | null
          astron_user_id?: number | null
          ativo_cad?: boolean | null
          ativo_cad_ia?: boolean | null
          ativo_cura?: boolean | null
          ativo_insumos?: boolean | null
          ativo_notebook?: boolean | null
          ativo_print?: boolean | null
          ativo_scan?: boolean | null
          ativo_smart_slice?: boolean | null
          automation_cooldown_until?: string | null
          avg_ticket?: number | null
          buyer_type?: string | null
          churn_risk_score?: number | null
          cidade?: string | null
          codigo_contrato?: string | null
          cognitive_analysis?: Json | null
          cognitive_analyzed_at?: string | null
          cognitive_context_hash?: string | null
          cognitive_model_version?: string | null
          cognitive_prompt_hash?: string | null
          cognitive_updated_at?: string | null
          comentario_perda?: string | null
          como_digitaliza?: string | null
          company_hash?: string | null
          company_id?: string | null
          confidence_score_analysis?: number | null
          created_at?: string
          crm_lock_source?: string | null
          crm_lock_until?: string | null
          cs_treinamento?: string | null
          data_contrato?: string | null
          data_fechamento_crm?: string | null
          data_primeiro_contato?: string | null
          data_treinamento?: string | null
          data_ultima_compra_cad?: string | null
          data_ultima_compra_cad_ia?: string | null
          data_ultima_compra_cura?: string | null
          data_ultima_compra_insumos?: string | null
          data_ultima_compra_notebook?: string | null
          data_ultima_compra_print?: string | null
          data_ultima_compra_scan?: string | null
          data_ultima_compra_smart_slice?: string | null
          email?: string
          empresa_cidade?: string | null
          empresa_cnae?: string | null
          empresa_cnaes?: Json | null
          empresa_cnpj?: string | null
          empresa_custom_fields?: Json | null
          empresa_data_abertura?: string | null
          empresa_email?: string | null
          empresa_email_nf?: string | null
          empresa_endereco?: Json | null
          empresa_facebook?: string | null
          empresa_hash?: string | null
          empresa_ie?: string | null
          empresa_linkedin?: string | null
          empresa_nome?: string | null
          empresa_pais?: string | null
          empresa_piperun_id?: number | null
          empresa_porte?: string | null
          empresa_razao_social?: string | null
          empresa_segmento?: string | null
          empresa_situacao?: string | null
          empresa_telefone?: string | null
          empresa_touch_model?: string | null
          empresa_uf?: string | null
          empresa_website?: string | null
          entrada_sistema?: string
          equip_cad?: string | null
          equip_cad_ativacao?: string | null
          equip_cad_serial?: string | null
          equip_fresadora?: string | null
          equip_fresadora_ativacao?: string | null
          equip_fresadora_idade_meses?: number | null
          equip_fresadora_serial?: string | null
          equip_impressora?: string | null
          equip_impressora_ativacao?: string | null
          equip_impressora_ativacao_estimada?: string | null
          equip_impressora_idade_meses?: number | null
          equip_impressora_serial?: string | null
          equip_notebook?: string | null
          equip_notebook_ativacao?: string | null
          equip_notebook_serial?: string | null
          equip_pos_impressao?: string | null
          equip_pos_impressao_ativacao?: string | null
          equip_pos_impressao_serial?: string | null
          equip_scanner?: string | null
          equip_scanner_ativacao?: string | null
          equip_scanner_ativacao_estimada?: string | null
          equip_scanner_bancada?: string | null
          equip_scanner_bancada_ativacao?: string | null
          equip_scanner_bancada_serial?: string | null
          equip_scanner_idade_meses?: number | null
          equip_scanner_serial?: string | null
          equip_upgrade_produto?: string | null
          equip_upgrade_reasoning?: string | null
          equip_upgrade_signal?: boolean | null
          equip_upgrade_urgency?: string | null
          especialidade?: string | null
          form_name?: string | null
          funil_entrada_crm?: string | null
          historico_resumos?: Json | null
          hits_cad?: number | null
          hits_e1_acessorios?: number | null
          hits_e1_notebook?: number | null
          hits_e1_pecas_partes?: number | null
          hits_e1_scanner_bancada?: number | null
          hits_e1_scanner_intraoral?: number | null
          hits_e2_creditos_ia?: number | null
          hits_e2_pecas_partes?: number | null
          hits_e2_servico?: number | null
          hits_e2_software?: number | null
          hits_e3_acessorios?: number | null
          hits_e3_impressora?: number | null
          hits_e3_pecas_partes?: number | null
          hits_e3_resina?: number | null
          hits_e3_software?: number | null
          hits_e4_equipamentos?: number | null
          hits_e4_limpeza_acabamento?: number | null
          hits_e5_caracterizacao?: number | null
          hits_e5_dentistica_orto?: number | null
          hits_e5_instalacao?: number | null
          hits_e6_online?: number | null
          hits_e6_presencial?: number | null
          hits_e7_acessorios?: number | null
          hits_e7_equipamentos?: number | null
          hits_e7_pecas_partes?: number | null
          hits_e7_servico?: number | null
          hits_e7_software?: number | null
          hits_finalizacao?: number | null
          hits_fresagem?: number | null
          hits_impressao3d?: number | null
          hits_insumos_cursos?: number | null
          hits_pos_impressao?: number | null
          hits_scanner?: number | null
          id?: string
          id_cliente_smart?: string | null
          imersao_concluida?: boolean | null
          imersao_data?: string | null
          imersao_equipamentos_treinados?: string[] | null
          imersao_turma_id?: string | null
          impressora_modelo?: string | null
          informacao_desejada?: string | null
          insumos_adquiridos?: string | null
          intelligence_score?: Json | null
          intelligence_score_backfilled_at?: string | null
          intelligence_score_total?: number | null
          intelligence_score_updated_at?: string | null
          interest_timeline?: string | null
          ip_origem?: string | null
          itens_proposta_crm?: string | null
          itens_proposta_parsed?: Json | null
          last_automated_action_at?: string | null
          last_deal_date?: string | null
          last_deal_value?: number | null
          last_form_cad?: string | null
          last_form_date_cad?: string | null
          last_form_date_finalizacao?: string | null
          last_form_date_fresagem?: string | null
          last_form_date_impressao?: string | null
          last_form_date_insumos?: string | null
          last_form_date_pos_impressao?: string | null
          last_form_date_scanner?: string | null
          last_form_finalizacao?: string | null
          last_form_fresagem?: string | null
          last_form_impressao?: string | null
          last_form_insumos?: string | null
          last_form_pos_impressao?: string | null
          last_form_scanner?: string | null
          last_sync_at?: string | null
          last_sync_source?: string | null
          lead_card_published_at?: string | null
          lead_card_url?: string | null
          lead_stage_detected?: string | null
          lead_status?: string
          lead_timing_dias?: number | null
          lojaintegrada_bairro?: string | null
          lojaintegrada_bandeira_cartao?: string | null
          lojaintegrada_cep?: string | null
          lojaintegrada_cliente_data_criacao?: string | null
          lojaintegrada_cliente_id?: number | null
          lojaintegrada_cliente_obs?: string | null
          lojaintegrada_complemento?: string | null
          lojaintegrada_cupom_desconto?: string | null
          lojaintegrada_cupom_json?: Json | null
          lojaintegrada_data_modificacao?: string | null
          lojaintegrada_data_nascimento?: string | null
          lojaintegrada_endereco?: string | null
          lojaintegrada_forma_envio?: string | null
          lojaintegrada_forma_pagamento?: string | null
          lojaintegrada_historico_pedidos?: Json | null
          lojaintegrada_itens_json?: Json | null
          lojaintegrada_ltv?: number | null
          lojaintegrada_marketplace?: Json | null
          lojaintegrada_numero?: string | null
          lojaintegrada_parcelas?: number | null
          lojaintegrada_pedido_id?: number | null
          lojaintegrada_peso_real?: number | null
          lojaintegrada_primeira_compra?: string | null
          lojaintegrada_raw_payload?: Json | null
          lojaintegrada_referencia?: string | null
          lojaintegrada_sexo?: string | null
          lojaintegrada_tipo_pessoa?: string | null
          lojaintegrada_total_pedidos_pagos?: number | null
          lojaintegrada_tracking_code?: string | null
          lojaintegrada_ultimo_pedido_data?: string | null
          lojaintegrada_ultimo_pedido_numero?: number | null
          lojaintegrada_ultimo_pedido_status?: string | null
          lojaintegrada_ultimo_pedido_valor?: number | null
          lojaintegrada_updated_at?: string | null
          lojaintegrada_utm_campaign?: string | null
          lojaintegrada_valor_desconto?: number | null
          lojaintegrada_valor_envio?: number | null
          lojaintegrada_valor_subtotal?: number | null
          ltv_projected_12m?: number | null
          ltv_projected_24m?: number | null
          ltv_total?: number | null
          map_fresadora_date?: string | null
          map_fresadora_marca?: string | null
          map_fresadora_modelo?: string | null
          merge_history?: Json | null
          merged_at?: string | null
          merged_into?: string | null
          motivo_perda?: string | null
          next_purchase_probability?: number | null
          next_purchase_product?: string | null
          next_purchase_value?: number | null
          next_purchase_window_end?: string | null
          next_purchase_window_start?: string | null
          next_upsell_date_est?: string | null
          next_upsell_product?: string | null
          next_upsell_score?: number | null
          next_upsell_stage?: string | null
          nome?: string
          nps_recomendaria?: number | null
          nps_respondido_em?: string | null
          nps_satisfacao?: number | null
          nps_temas_cursos?: string[] | null
          objection_risk?: string | null
          opportunity_score?: number | null
          opportunity_signals?: Json | null
          origem_campanha?: string | null
          original_date?: string | null
          original_id?: string | null
          original_source?: string | null
          pais_origem?: string | null
          person_hash?: string | null
          person_id?: string | null
          pessoa_cargo?: string | null
          pessoa_cpf?: string | null
          pessoa_endereco?: Json | null
          pessoa_facebook?: string | null
          pessoa_genero?: string | null
          pessoa_hash?: string | null
          pessoa_lgpd?: Json | null
          pessoa_linkedin?: string | null
          pessoa_manager?: Json | null
          pessoa_nascimento?: string | null
          pessoa_observation?: string | null
          pessoa_piperun_id?: number | null
          pessoa_rdstation?: string | null
          pessoa_website?: string | null
          piperun_action?: Json | null
          piperun_activities?: Json | null
          piperun_closed_at?: string | null
          piperun_created_at?: string | null
          piperun_custom_fields?: Json | null
          piperun_deal_city?: string | null
          piperun_deal_order?: number | null
          piperun_deals_history?: Json | null
          piperun_deleted?: boolean | null
          piperun_description?: string | null
          piperun_files?: Json | null
          piperun_forms?: Json | null
          piperun_frozen?: boolean | null
          piperun_frozen_at?: string | null
          piperun_hash?: string | null
          piperun_id?: string | null
          piperun_involved_users?: Json | null
          piperun_last_contact_at?: string | null
          piperun_lead_time?: number | null
          piperun_link?: string | null
          piperun_observation?: string | null
          piperun_origin_id?: number | null
          piperun_origin_name?: string | null
          piperun_origin_sub_name?: string | null
          piperun_owner_id?: number | null
          piperun_pipeline_id?: number | null
          piperun_pipeline_name?: string | null
          piperun_probability?: number | null
          piperun_probably_closed_at?: string | null
          piperun_raw_payload?: Json | null
          piperun_stage_changed_at?: string | null
          piperun_stage_id?: number | null
          piperun_stage_name?: string | null
          piperun_status?: number | null
          piperun_tags_raw?: Json | null
          piperun_title?: string | null
          piperun_updated_at?: string | null
          piperun_value_mrr?: number | null
          platform?: string | null
          platform_ad_id?: string | null
          platform_adgroup_id?: string | null
          platform_campaign_id?: string | null
          platform_cpl?: number | null
          platform_form_id?: string | null
          platform_lead_id?: string | null
          platform_placement?: string | null
          portfolio_json?: Json | null
          portfolio_updated_at?: string | null
          prediction_accuracy?: number | null
          predictions_updated_at?: string | null
          primary_motivation?: string | null
          principal_aplicacao?: string | null
          proactive_count?: number | null
          proactive_sent_at?: string | null
          produto_interesse?: string | null
          produto_interesse_auto?: string | null
          proposals_data?: Json | null
          proposals_last_status?: number | null
          proposals_total_mrr?: number | null
          proposals_total_value?: number | null
          proprietario_lead_crm?: string | null
          psychological_profile?: string | null
          raw_payload?: Json | null
          recommended_approach?: string | null
          recompra_alert?: boolean | null
          recompra_days_overdue?: number | null
          recompra_stage?: string | null
          resina_consumo_mensal_estimado?: number | null
          resina_interesse?: string | null
          resumo_historico_ia?: string | null
          reuniao_agendada?: boolean | null
          rota_inicial_lia?: string | null
          score?: number | null
          sdr_cad_funcionalidades?: string | null
          sdr_cad_licenca?: string | null
          sdr_cad_treinamento?: string | null
          sdr_caracterizacao_interesse?: string | null
          sdr_caracterizacao_produto_atual?: string | null
          sdr_cura_modelo?: string | null
          sdr_cursos_area?: string | null
          sdr_cursos_interesse?: string | null
          sdr_cursos_modalidade?: string | null
          sdr_dentistica_interesse?: string | null
          sdr_fresadora_marca?: string | null
          sdr_fresadora_modelo?: string | null
          sdr_fresagem_interesse?: string | null
          sdr_impressora_interesse?: string | null
          sdr_insumos_lab_interesse?: string | null
          sdr_insumos_tipo?: string | null
          sdr_marca_impressora_param?: string | null
          sdr_modelo_impressora_param?: string | null
          sdr_pos_impressao_interesse?: string | null
          sdr_resina_atual?: string | null
          sdr_resina_param?: string | null
          sdr_scanner_interesse?: string | null
          sdr_scanner_modelo?: string | null
          sdr_smartgum_interesse?: boolean | null
          sdr_smartmake_interesse?: boolean | null
          sdr_software_cad_interesse?: string | null
          sdr_solucoes_interesse?: string | null
          sdr_suporte_descricao?: string | null
          sdr_suporte_equipamento?: string | null
          sdr_suporte_tipo?: string | null
          sdr_usa_resina_smartdent?: boolean | null
          sellflux_custom_fields?: Json | null
          sellflux_synced_at?: string | null
          software_cad?: string | null
          source?: string
          source_reference?: string | null
          status_atual_lead_crm?: string | null
          status_cad?: string | null
          status_impressora?: string | null
          status_insumos?: string | null
          status_oportunidade?: string | null
          status_pos_impressao?: string | null
          status_scanner?: string | null
          suporte_educacional_tickets_total?: number | null
          suporte_impressora_tickets_6m?: number | null
          suporte_tecnico_tickets_total?: number | null
          tags_crm?: string[] | null
          telefone_normalized?: string | null
          telefone_raw?: string | null
          tem_impressora?: string | null
          tem_scanner?: string | null
          temperatura_lead?: string | null
          timeline_cad?: Json | null
          timeline_cursos?: Json | null
          timeline_finalizacao?: Json | null
          timeline_fresagem?: Json | null
          timeline_impressao?: Json | null
          timeline_pos_impressao?: Json | null
          timeline_scanner?: Json | null
          total_deals?: number | null
          total_messages?: number | null
          total_sessions?: number | null
          uf?: string | null
          ultima_etapa_comercial?: string | null
          ultima_sessao_at?: string | null
          updated_at?: string
          urgency_level?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          valor_oportunidade?: number | null
          volume_mensal_pecas?: string | null
          wa_group_origem?: string | null
          workflow_portfolio?: Json | null
          workflow_score?: number | null
          workflow_timeline?: Json | null
          workflow_timeline_updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lia_attendances_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lia_attendances_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_customer_graph"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "lia_attendances_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_person_company_graph"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "lia_attendances_merged_into_fkey"
            columns: ["merged_into"]
            isOneToOne: false
            referencedRelation: "lead_model_routing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lia_attendances_merged_into_fkey"
            columns: ["merged_into"]
            isOneToOne: false
            referencedRelation: "lia_attendances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lia_attendances_merged_into_fkey"
            columns: ["merged_into"]
            isOneToOne: false
            referencedRelation: "v_lead_academy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lia_attendances_merged_into_fkey"
            columns: ["merged_into"]
            isOneToOne: false
            referencedRelation: "v_lead_cognitive"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lia_attendances_merged_into_fkey"
            columns: ["merged_into"]
            isOneToOne: false
            referencedRelation: "v_lead_commercial"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lia_attendances_merged_into_fkey"
            columns: ["merged_into"]
            isOneToOne: false
            referencedRelation: "v_lead_ecommerce"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lia_attendances_merged_into_fkey"
            columns: ["merged_into"]
            isOneToOne: false
            referencedRelation: "v_leads_correto"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "lia_attendances_merged_into_fkey"
            columns: ["merged_into"]
            isOneToOne: false
            referencedRelation: "v_opportunity_engine"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "lia_attendances_merged_into_fkey"
            columns: ["merged_into"]
            isOneToOne: false
            referencedRelation: "v_timing_alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lia_attendances_merged_into_fkey"
            columns: ["merged_into"]
            isOneToOne: false
            referencedRelation: "v_workflow_portfolio"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "lia_attendances_merged_into_fkey"
            columns: ["merged_into"]
            isOneToOne: false
            referencedRelation: "v_workflow_timeline"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "lia_attendances_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lia_attendances_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "v_customer_graph"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "lia_attendances_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "v_person_company_graph"
            referencedColumns: ["person_id"]
          },
        ]
      }
      lia_attendances_backup_20260314: {
        Row: {
          id: string | null
          ltv_total: number | null
          proposals_total_value: number | null
          proprietario_lead_crm: string | null
          score: number | null
          status_atual_lead_crm: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string | null
          ltv_total?: number | null
          proposals_total_value?: number | null
          proprietario_lead_crm?: string | null
          score?: number | null
          status_atual_lead_crm?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string | null
          ltv_total?: number | null
          proposals_total_value?: number | null
          proprietario_lead_crm?: string | null
          score?: number | null
          status_atual_lead_crm?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      marketing_assets: {
        Row: {
          archived_at: string | null
          asset_type: string
          campaign_id: string | null
          campaign_name: string | null
          content_html: string | null
          content_json: Json | null
          created_at: string
          id: string
          metadata: Json | null
          performance_data: Json | null
          published_at: string | null
          related_lead_segments: string[] | null
          related_product_ids: string[] | null
          slug: string | null
          source_id: string | null
          source_system: string
          status: string
          title: string
          updated_at: string
          url: string | null
        }
        Insert: {
          archived_at?: string | null
          asset_type: string
          campaign_id?: string | null
          campaign_name?: string | null
          content_html?: string | null
          content_json?: Json | null
          created_at?: string
          id?: string
          metadata?: Json | null
          performance_data?: Json | null
          published_at?: string | null
          related_lead_segments?: string[] | null
          related_product_ids?: string[] | null
          slug?: string | null
          source_id?: string | null
          source_system?: string
          status?: string
          title: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          archived_at?: string | null
          asset_type?: string
          campaign_id?: string | null
          campaign_name?: string | null
          content_html?: string | null
          content_json?: Json | null
          created_at?: string
          id?: string
          metadata?: Json | null
          performance_data?: Json | null
          published_at?: string | null
          related_lead_segments?: string[] | null
          related_product_ids?: string[] | null
          slug?: string | null
          source_id?: string | null
          source_system?: string
          status?: string
          title?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: []
      }
      message_logs: {
        Row: {
          created_at: string
          data_envio: string | null
          error_details: string | null
          id: string
          lead_id: string | null
          mensagem_preview: string | null
          status: string
          team_member_id: string | null
          tipo: string | null
          whatsapp_number: string | null
        }
        Insert: {
          created_at?: string
          data_envio?: string | null
          error_details?: string | null
          id?: string
          lead_id?: string | null
          mensagem_preview?: string | null
          status?: string
          team_member_id?: string | null
          tipo?: string | null
          whatsapp_number?: string | null
        }
        Update: {
          created_at?: string
          data_envio?: string | null
          error_details?: string | null
          id?: string
          lead_id?: string | null
          mensagem_preview?: string | null
          status?: string
          team_member_id?: string | null
          tipo?: string | null
          whatsapp_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "message_logs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "lead_model_routing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_logs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "lia_attendances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_logs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_academy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_logs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_cognitive"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_logs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_commercial"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_logs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_ecommerce"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_logs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_leads_correto"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "message_logs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_opportunity_engine"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "message_logs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_timing_alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_logs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_workflow_portfolio"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "message_logs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_workflow_timeline"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "message_logs_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      models: {
        Row: {
          active: boolean
          brand_id: string
          created_at: string
          id: string
          image_url: string | null
          name: string
          notes: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          brand_id: string
          created_at?: string
          id?: string
          image_url?: string | null
          name: string
          notes?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          brand_id?: string
          created_at?: string
          id?: string
          image_url?: string | null
          name?: string
          notes?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "models_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      pandavideo_folders: {
        Row: {
          created_at: string | null
          id: string
          last_sync_at: string | null
          name: string
          pandavideo_id: string
          parent_folder_id: string | null
          updated_at: string | null
          videos_count: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          last_sync_at?: string | null
          name: string
          pandavideo_id: string
          parent_folder_id?: string | null
          updated_at?: string | null
          videos_count?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          last_sync_at?: string | null
          name?: string
          pandavideo_id?: string
          parent_folder_id?: string | null
          updated_at?: string | null
          videos_count?: number | null
        }
        Relationships: []
      }
      parameter_sets: {
        Row: {
          active: boolean
          anti_aliasing: boolean | null
          bottom_cure_time: number | null
          bottom_layers: number | null
          brand_slug: string
          created_at: string
          cure_time: number
          id: string
          layer_height: number
          lift_distance: number | null
          lift_speed: number | null
          light_intensity: number
          model_slug: string
          notes: string | null
          resin_manufacturer: string
          resin_name: string
          retract_speed: number | null
          updated_at: string
          wait_time_after_cure: number | null
          wait_time_after_lift: number | null
          wait_time_before_cure: number | null
          xy_adjustment_x_pct: number | null
          xy_adjustment_y_pct: number | null
          xy_size_compensation: number | null
        }
        Insert: {
          active?: boolean
          anti_aliasing?: boolean | null
          bottom_cure_time?: number | null
          bottom_layers?: number | null
          brand_slug: string
          created_at?: string
          cure_time: number
          id?: string
          layer_height: number
          lift_distance?: number | null
          lift_speed?: number | null
          light_intensity: number
          model_slug: string
          notes?: string | null
          resin_manufacturer: string
          resin_name: string
          retract_speed?: number | null
          updated_at?: string
          wait_time_after_cure?: number | null
          wait_time_after_lift?: number | null
          wait_time_before_cure?: number | null
          xy_adjustment_x_pct?: number | null
          xy_adjustment_y_pct?: number | null
          xy_size_compensation?: number | null
        }
        Update: {
          active?: boolean
          anti_aliasing?: boolean | null
          bottom_cure_time?: number | null
          bottom_layers?: number | null
          brand_slug?: string
          created_at?: string
          cure_time?: number
          id?: string
          layer_height?: number
          lift_distance?: number | null
          lift_speed?: number | null
          light_intensity?: number
          model_slug?: string
          notes?: string | null
          resin_manufacturer?: string
          resin_name?: string
          retract_speed?: number | null
          updated_at?: string
          wait_time_after_cure?: number | null
          wait_time_after_lift?: number | null
          wait_time_before_cure?: number | null
          xy_adjustment_x_pct?: number | null
          xy_adjustment_y_pct?: number | null
          xy_size_compensation?: number | null
        }
        Relationships: []
      }
      people: {
        Row: {
          cargo: string | null
          cpf: string | null
          created_at: string | null
          email: string | null
          genero: string | null
          id: string
          nascimento: string | null
          nome: string | null
          piperun_person_id: number | null
          primary_company_id: string | null
          telefone_normalized: string | null
          updated_at: string | null
        }
        Insert: {
          cargo?: string | null
          cpf?: string | null
          created_at?: string | null
          email?: string | null
          genero?: string | null
          id?: string
          nascimento?: string | null
          nome?: string | null
          piperun_person_id?: number | null
          primary_company_id?: string | null
          telefone_normalized?: string | null
          updated_at?: string | null
        }
        Update: {
          cargo?: string | null
          cpf?: string | null
          created_at?: string | null
          email?: string | null
          genero?: string | null
          id?: string
          nascimento?: string | null
          nome?: string | null
          piperun_person_id?: number | null
          primary_company_id?: string | null
          telefone_normalized?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "people_primary_company_id_fkey"
            columns: ["primary_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_primary_company_id_fkey"
            columns: ["primary_company_id"]
            isOneToOne: false
            referencedRelation: "v_customer_graph"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "people_primary_company_id_fkey"
            columns: ["primary_company_id"]
            isOneToOne: false
            referencedRelation: "v_person_company_graph"
            referencedColumns: ["company_id"]
          },
        ]
      }
      person_company_relationship: {
        Row: {
          company_id: string
          person_id: string
          role: string | null
        }
        Insert: {
          company_id: string
          person_id: string
          role?: string | null
        }
        Update: {
          company_id?: string
          person_id?: string
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "person_company_relationship_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "person_company_relationship_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_customer_graph"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "person_company_relationship_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_person_company_graph"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "person_company_relationship_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "person_company_relationship_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "v_customer_graph"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "person_company_relationship_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "v_person_company_graph"
            referencedColumns: ["person_id"]
          },
        ]
      }
      phone_dedup_log: {
        Row: {
          canonical_id: string
          confidence: string | null
          created_at: string | null
          id: string
          merge_reason: string | null
          merged_ids: string[]
          status: string | null
          telefone: string
        }
        Insert: {
          canonical_id: string
          confidence?: string | null
          created_at?: string | null
          id?: string
          merge_reason?: string | null
          merged_ids: string[]
          status?: string | null
          telefone: string
        }
        Update: {
          canonical_id?: string
          confidence?: string | null
          created_at?: string | null
          id?: string
          merge_reason?: string | null
          merged_ids?: string[]
          status?: string | null
          telefone?: string
        }
        Relationships: []
      }
      piperun_pessoas_staging: {
        Row: {
          area_atuacao: string | null
          cargo: string | null
          cidade: string | null
          cpf: string | null
          data_cadastro_piperun: string | null
          email: string
          empresa_cnpj: string | null
          empresa_nome: string | null
          empresa_porte: string | null
          empresa_razao_social: string | null
          empresa_segmento: string | null
          especialidade: string | null
          genero: string | null
          informacao_desejada: string | null
          nascimento: string | null
          pessoa_piperun_id: number | null
          telefone: string | null
          tem_impressora: string | null
          tem_scanner: string | null
          uf: string | null
        }
        Insert: {
          area_atuacao?: string | null
          cargo?: string | null
          cidade?: string | null
          cpf?: string | null
          data_cadastro_piperun?: string | null
          email: string
          empresa_cnpj?: string | null
          empresa_nome?: string | null
          empresa_porte?: string | null
          empresa_razao_social?: string | null
          empresa_segmento?: string | null
          especialidade?: string | null
          genero?: string | null
          informacao_desejada?: string | null
          nascimento?: string | null
          pessoa_piperun_id?: number | null
          telefone?: string | null
          tem_impressora?: string | null
          tem_scanner?: string | null
          uf?: string | null
        }
        Update: {
          area_atuacao?: string | null
          cargo?: string | null
          cidade?: string | null
          cpf?: string | null
          data_cadastro_piperun?: string | null
          email?: string
          empresa_cnpj?: string | null
          empresa_nome?: string | null
          empresa_porte?: string | null
          empresa_razao_social?: string | null
          empresa_segmento?: string | null
          especialidade?: string | null
          genero?: string | null
          informacao_desejada?: string | null
          nascimento?: string | null
          pessoa_piperun_id?: number | null
          telefone?: string | null
          tem_impressora?: string | null
          tem_scanner?: string | null
          uf?: string | null
        }
        Relationships: []
      }
      piperun_staging: {
        Row: {
          area_atuacao: string | null
          cidade: string | null
          email: string | null
          empresa_cnpj: string | null
          empresa_nome: string | null
          empresa_porte: string | null
          empresa_razao_social: string | null
          empresa_segmento: string | null
          especialidade: string | null
          informacao_desejada: string | null
          pessoa_cargo: string | null
          pessoa_cpf: string | null
          pessoa_genero: string | null
          pessoa_nascimento: string | null
          pessoa_piperun_id: number | null
          telefone_normalized: string | null
          telefone_raw: string | null
          tem_impressora: string | null
          tem_scanner: string | null
          uf: string | null
        }
        Insert: {
          area_atuacao?: string | null
          cidade?: string | null
          email?: string | null
          empresa_cnpj?: string | null
          empresa_nome?: string | null
          empresa_porte?: string | null
          empresa_razao_social?: string | null
          empresa_segmento?: string | null
          especialidade?: string | null
          informacao_desejada?: string | null
          pessoa_cargo?: string | null
          pessoa_cpf?: string | null
          pessoa_genero?: string | null
          pessoa_nascimento?: string | null
          pessoa_piperun_id?: number | null
          telefone_normalized?: string | null
          telefone_raw?: string | null
          tem_impressora?: string | null
          tem_scanner?: string | null
          uf?: string | null
        }
        Update: {
          area_atuacao?: string | null
          cidade?: string | null
          email?: string | null
          empresa_cnpj?: string | null
          empresa_nome?: string | null
          empresa_porte?: string | null
          empresa_razao_social?: string | null
          empresa_segmento?: string | null
          especialidade?: string | null
          informacao_desejada?: string | null
          pessoa_cargo?: string | null
          pessoa_cpf?: string | null
          pessoa_genero?: string | null
          pessoa_nascimento?: string | null
          pessoa_piperun_id?: number | null
          telefone_normalized?: string | null
          telefone_raw?: string | null
          tem_impressora?: string | null
          tem_scanner?: string | null
          uf?: string | null
        }
        Relationships: []
      }
      product_taxonomy: {
        Row: {
          base_value_brl: number | null
          brand: string | null
          created_at: string | null
          display_name: string
          id: string
          is_competitor: boolean | null
          is_smartdent: boolean | null
          match_patterns: string[] | null
          opportunity_type: string | null
          product_key: string
          subcategory: string | null
          workflow_stage: string
        }
        Insert: {
          base_value_brl?: number | null
          brand?: string | null
          created_at?: string | null
          display_name: string
          id?: string
          is_competitor?: boolean | null
          is_smartdent?: boolean | null
          match_patterns?: string[] | null
          opportunity_type?: string | null
          product_key: string
          subcategory?: string | null
          workflow_stage: string
        }
        Update: {
          base_value_brl?: number | null
          brand?: string | null
          created_at?: string | null
          display_name?: string
          id?: string
          is_competitor?: boolean | null
          is_smartdent?: boolean | null
          match_patterns?: string[] | null
          opportunity_type?: string | null
          product_key?: string
          subcategory?: string | null
          workflow_stage?: string
        }
        Relationships: []
      }
      products_catalog: {
        Row: {
          anti_hallucination_rules: Json | null
          category: string | null
          clinical_brain_status: string | null
          forbidden_products: Json | null
          name: string | null
          product_id: string
          required_products: Json | null
          subcategory: string | null
          synced_at: string | null
          whatsapp_messages: Json | null
          whatsapp_sequences: Json | null
          workflow_stages: Json | null
        }
        Insert: {
          anti_hallucination_rules?: Json | null
          category?: string | null
          clinical_brain_status?: string | null
          forbidden_products?: Json | null
          name?: string | null
          product_id: string
          required_products?: Json | null
          subcategory?: string | null
          synced_at?: string | null
          whatsapp_messages?: Json | null
          whatsapp_sequences?: Json | null
          workflow_stages?: Json | null
        }
        Update: {
          anti_hallucination_rules?: Json | null
          category?: string | null
          clinical_brain_status?: string | null
          forbidden_products?: Json | null
          name?: string | null
          product_id?: string
          required_products?: Json | null
          subcategory?: string | null
          synced_at?: string | null
          whatsapp_messages?: Json | null
          whatsapp_sequences?: Json | null
          workflow_stages?: Json | null
        }
        Relationships: []
      }
      resin_documents: {
        Row: {
          active: boolean | null
          created_at: string | null
          document_category: string | null
          document_description: string | null
          document_name: string
          document_subcategory: string | null
          document_type: string | null
          extracted_at: string | null
          extracted_text: string | null
          extraction_error: string | null
          extraction_method: string | null
          extraction_status: string | null
          extraction_tokens: number | null
          file_hash: string | null
          file_name: string
          file_size: number | null
          file_url: string
          id: string
          language: string | null
          order_index: number | null
          resin_id: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          document_category?: string | null
          document_description?: string | null
          document_name: string
          document_subcategory?: string | null
          document_type?: string | null
          extracted_at?: string | null
          extracted_text?: string | null
          extraction_error?: string | null
          extraction_method?: string | null
          extraction_status?: string | null
          extraction_tokens?: number | null
          file_hash?: string | null
          file_name: string
          file_size?: number | null
          file_url: string
          id?: string
          language?: string | null
          order_index?: number | null
          resin_id: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          document_category?: string | null
          document_description?: string | null
          document_name?: string
          document_subcategory?: string | null
          document_type?: string | null
          extracted_at?: string | null
          extracted_text?: string | null
          extraction_error?: string | null
          extraction_method?: string | null
          extraction_status?: string | null
          extraction_tokens?: number | null
          file_hash?: string | null
          file_name?: string
          file_size?: number | null
          file_url?: string
          id?: string
          language?: string | null
          order_index?: number | null
          resin_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "resin_documents_resin_id_fkey"
            columns: ["resin_id"]
            isOneToOne: false
            referencedRelation: "resins"
            referencedColumns: ["id"]
          },
        ]
      }
      resin_presentations: {
        Row: {
          cost_per_print: number | null
          created_at: string | null
          grams_per_print: number | null
          id: string
          label: string
          price: number | null
          price_per_gram: number | null
          print_type: string | null
          prints_per_bottle: number | null
          resin_id: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          cost_per_print?: number | null
          created_at?: string | null
          grams_per_print?: number | null
          id?: string
          label?: string
          price?: number | null
          price_per_gram?: number | null
          print_type?: string | null
          prints_per_bottle?: number | null
          resin_id: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          cost_per_print?: number | null
          created_at?: string | null
          grams_per_print?: number | null
          id?: string
          label?: string
          price?: number | null
          price_per_gram?: number | null
          print_type?: string | null
          prints_per_bottle?: number | null
          resin_id?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "resin_presentations_resin_id_fkey"
            columns: ["resin_id"]
            isOneToOne: false
            referencedRelation: "resins"
            referencedColumns: ["id"]
          },
        ]
      }
      resins: {
        Row: {
          active: boolean
          ai_context: string | null
          canonical_url: string | null
          color: string | null
          created_at: string
          cta_1_description: string | null
          cta_1_enabled: boolean | null
          cta_1_label: string | null
          cta_1_url: string | null
          cta_2_description: string | null
          cta_2_label: string | null
          cta_2_source_id: string | null
          cta_2_source_type: string | null
          cta_2_url: string | null
          cta_3_description: string | null
          cta_3_label: string | null
          cta_3_source_id: string | null
          cta_3_source_type: string | null
          cta_3_url: string | null
          cta_4_description: string | null
          cta_4_label: string | null
          cta_4_source_id: string | null
          cta_4_source_type: string | null
          cta_4_url: string | null
          description: string | null
          external_id: string | null
          id: string
          image_url: string | null
          keyword_ids: string[] | null
          keywords: string[] | null
          manufacturer: string
          meta_description: string | null
          name: string
          og_image_url: string | null
          price: number | null
          processing_instructions: string | null
          seo_title_override: string | null
          slug: string | null
          system_a_product_id: string | null
          system_a_product_url: string | null
          type: Database["public"]["Enums"]["resin_type"] | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          ai_context?: string | null
          canonical_url?: string | null
          color?: string | null
          created_at?: string
          cta_1_description?: string | null
          cta_1_enabled?: boolean | null
          cta_1_label?: string | null
          cta_1_url?: string | null
          cta_2_description?: string | null
          cta_2_label?: string | null
          cta_2_source_id?: string | null
          cta_2_source_type?: string | null
          cta_2_url?: string | null
          cta_3_description?: string | null
          cta_3_label?: string | null
          cta_3_source_id?: string | null
          cta_3_source_type?: string | null
          cta_3_url?: string | null
          cta_4_description?: string | null
          cta_4_label?: string | null
          cta_4_source_id?: string | null
          cta_4_source_type?: string | null
          cta_4_url?: string | null
          description?: string | null
          external_id?: string | null
          id?: string
          image_url?: string | null
          keyword_ids?: string[] | null
          keywords?: string[] | null
          manufacturer: string
          meta_description?: string | null
          name: string
          og_image_url?: string | null
          price?: number | null
          processing_instructions?: string | null
          seo_title_override?: string | null
          slug?: string | null
          system_a_product_id?: string | null
          system_a_product_url?: string | null
          type?: Database["public"]["Enums"]["resin_type"] | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          ai_context?: string | null
          canonical_url?: string | null
          color?: string | null
          created_at?: string
          cta_1_description?: string | null
          cta_1_enabled?: boolean | null
          cta_1_label?: string | null
          cta_1_url?: string | null
          cta_2_description?: string | null
          cta_2_label?: string | null
          cta_2_source_id?: string | null
          cta_2_source_type?: string | null
          cta_2_url?: string | null
          cta_3_description?: string | null
          cta_3_label?: string | null
          cta_3_source_id?: string | null
          cta_3_source_type?: string | null
          cta_3_url?: string | null
          cta_4_description?: string | null
          cta_4_label?: string | null
          cta_4_source_id?: string | null
          cta_4_source_type?: string | null
          cta_4_url?: string | null
          description?: string | null
          external_id?: string | null
          id?: string
          image_url?: string | null
          keyword_ids?: string[] | null
          keywords?: string[] | null
          manufacturer?: string
          meta_description?: string | null
          name?: string
          og_image_url?: string | null
          price?: number | null
          processing_instructions?: string | null
          seo_title_override?: string | null
          slug?: string | null
          system_a_product_id?: string | null
          system_a_product_url?: string | null
          type?: Database["public"]["Enums"]["resin_type"] | null
          updated_at?: string
        }
        Relationships: []
      }
      roi_card_cad_types: {
        Row: {
          cad_ia_cost: number | null
          cad_ia_time: number | null
          cad_manual_cost: number | null
          cad_manual_time: number | null
          cad_mentoria_cost: number | null
          cad_terceirizado_cost: number | null
          cad_terceirizado_time: number | null
          created_at: string | null
          id: string
          procedure_name: string
          roi_card_id: string
          sort_order: number | null
        }
        Insert: {
          cad_ia_cost?: number | null
          cad_ia_time?: number | null
          cad_manual_cost?: number | null
          cad_manual_time?: number | null
          cad_mentoria_cost?: number | null
          cad_terceirizado_cost?: number | null
          cad_terceirizado_time?: number | null
          created_at?: string | null
          id?: string
          procedure_name?: string
          roi_card_id: string
          sort_order?: number | null
        }
        Update: {
          cad_ia_cost?: number | null
          cad_ia_time?: number | null
          cad_manual_cost?: number | null
          cad_manual_time?: number | null
          cad_mentoria_cost?: number | null
          cad_terceirizado_cost?: number | null
          cad_terceirizado_time?: number | null
          created_at?: string | null
          id?: string
          procedure_name?: string
          roi_card_id?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "roi_card_cad_types_roi_card_id_fkey"
            columns: ["roi_card_id"]
            isOneToOne: false
            referencedRelation: "roi_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      roi_card_items: {
        Row: {
          created_at: string | null
          description: string
          economia_imediata: number | null
          id: string
          investimento_com_combo: number | null
          investimento_fora_combo: number | null
          roi_card_id: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string | null
          description?: string
          economia_imediata?: number | null
          id?: string
          investimento_com_combo?: number | null
          investimento_fora_combo?: number | null
          roi_card_id: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string
          economia_imediata?: number | null
          id?: string
          investimento_com_combo?: number | null
          investimento_fora_combo?: number | null
          roi_card_id?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "roi_card_items_roi_card_id_fkey"
            columns: ["roi_card_id"]
            isOneToOne: false
            referencedRelation: "roi_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      roi_cards: {
        Row: {
          active: boolean | null
          asb_cad: boolean | null
          asb_cam: boolean | null
          asb_clean: boolean | null
          asb_cure: boolean | null
          asb_finish: boolean | null
          asb_print: boolean | null
          asb_scan: boolean | null
          cad_cost_manual: number | null
          cad_cost_smart: number | null
          cad_time_manual: number | null
          cad_time_smart: number | null
          cam_operator: string | null
          cam_support_time: number | null
          cam_support_type: string | null
          cam_time_manual: number | null
          cam_time_smart: number | null
          category: string
          clean_time_manual: number | null
          clean_time_smart: number | null
          created_at: string | null
          cure_time_manual: number | null
          cure_time_smart: number | null
          faturamento_kit: number | null
          finish_time_manual: number | null
          finish_time_smart: number | null
          id: string
          image_url: string | null
          investimento_inicial: number | null
          name: string
          preco_combo: number | null
          preco_mercado: number | null
          print_time_manual: number | null
          print_time_smart: number | null
          printer_model_id: string | null
          rendimento_unidades: number | null
          resin_id: string | null
          scan_time_manual: number | null
          scan_time_smart: number | null
          slug: string | null
          status: string | null
          updated_at: string | null
          waste_pct_manual: number | null
          waste_pct_smart: number | null
          workflow_descriptions: Json | null
        }
        Insert: {
          active?: boolean | null
          asb_cad?: boolean | null
          asb_cam?: boolean | null
          asb_clean?: boolean | null
          asb_cure?: boolean | null
          asb_finish?: boolean | null
          asb_print?: boolean | null
          asb_scan?: boolean | null
          cad_cost_manual?: number | null
          cad_cost_smart?: number | null
          cad_time_manual?: number | null
          cad_time_smart?: number | null
          cam_operator?: string | null
          cam_support_time?: number | null
          cam_support_type?: string | null
          cam_time_manual?: number | null
          cam_time_smart?: number | null
          category?: string
          clean_time_manual?: number | null
          clean_time_smart?: number | null
          created_at?: string | null
          cure_time_manual?: number | null
          cure_time_smart?: number | null
          faturamento_kit?: number | null
          finish_time_manual?: number | null
          finish_time_smart?: number | null
          id?: string
          image_url?: string | null
          investimento_inicial?: number | null
          name: string
          preco_combo?: number | null
          preco_mercado?: number | null
          print_time_manual?: number | null
          print_time_smart?: number | null
          printer_model_id?: string | null
          rendimento_unidades?: number | null
          resin_id?: string | null
          scan_time_manual?: number | null
          scan_time_smart?: number | null
          slug?: string | null
          status?: string | null
          updated_at?: string | null
          waste_pct_manual?: number | null
          waste_pct_smart?: number | null
          workflow_descriptions?: Json | null
        }
        Update: {
          active?: boolean | null
          asb_cad?: boolean | null
          asb_cam?: boolean | null
          asb_clean?: boolean | null
          asb_cure?: boolean | null
          asb_finish?: boolean | null
          asb_print?: boolean | null
          asb_scan?: boolean | null
          cad_cost_manual?: number | null
          cad_cost_smart?: number | null
          cad_time_manual?: number | null
          cad_time_smart?: number | null
          cam_operator?: string | null
          cam_support_time?: number | null
          cam_support_type?: string | null
          cam_time_manual?: number | null
          cam_time_smart?: number | null
          category?: string
          clean_time_manual?: number | null
          clean_time_smart?: number | null
          created_at?: string | null
          cure_time_manual?: number | null
          cure_time_smart?: number | null
          faturamento_kit?: number | null
          finish_time_manual?: number | null
          finish_time_smart?: number | null
          id?: string
          image_url?: string | null
          investimento_inicial?: number | null
          name?: string
          preco_combo?: number | null
          preco_mercado?: number | null
          print_time_manual?: number | null
          print_time_smart?: number | null
          printer_model_id?: string | null
          rendimento_unidades?: number | null
          resin_id?: string | null
          scan_time_manual?: number | null
          scan_time_smart?: number | null
          slug?: string | null
          status?: string | null
          updated_at?: string | null
          waste_pct_manual?: number | null
          waste_pct_smart?: number | null
          workflow_descriptions?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "roi_cards_printer_model_id_fkey"
            columns: ["printer_model_id"]
            isOneToOne: false
            referencedRelation: "models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roi_cards_resin_id_fkey"
            columns: ["resin_id"]
            isOneToOne: false
            referencedRelation: "resins"
            referencedColumns: ["id"]
          },
        ]
      }
      site_settings: {
        Row: {
          created_at: string | null
          id: string
          key: string
          updated_at: string | null
          value: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          key: string
          updated_at?: string | null
          value?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          key?: string
          updated_at?: string | null
          value?: string | null
        }
        Relationships: []
      }
      smartops_course_enrollments: {
        Row: {
          area_atuacao: string | null
          course_id: string
          created_at: string | null
          created_by: string | null
          deal_id: string | null
          deal_pipeline_name: string | null
          deal_title: string | null
          deal_value: number | null
          empresa_cidade: string | null
          empresa_cnpj: string | null
          empresa_endereco: string | null
          empresa_estado: string | null
          empresa_pais: string | null
          empresa_telefone: string | null
          enrolled_at: string | null
          equip_writeback_at: string | null
          equip_writeback_error: string | null
          equipment_data: Json | null
          especialidade: string | null
          id: string
          lead_id: string | null
          notes: string | null
          numero_contrato: string | null
          person_name: string | null
          person_piperun_id: string | null
          proposal_items_snapshot: Json | null
          status: string | null
          turma_id: string
          turma_snapshot: Json
          updated_at: string | null
          validated_at: string | null
          wa_error: string | null
          wa_sent_at: string | null
        }
        Insert: {
          area_atuacao?: string | null
          course_id: string
          created_at?: string | null
          created_by?: string | null
          deal_id?: string | null
          deal_pipeline_name?: string | null
          deal_title?: string | null
          deal_value?: number | null
          empresa_cidade?: string | null
          empresa_cnpj?: string | null
          empresa_endereco?: string | null
          empresa_estado?: string | null
          empresa_pais?: string | null
          empresa_telefone?: string | null
          enrolled_at?: string | null
          equip_writeback_at?: string | null
          equip_writeback_error?: string | null
          equipment_data?: Json | null
          especialidade?: string | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          numero_contrato?: string | null
          person_name?: string | null
          person_piperun_id?: string | null
          proposal_items_snapshot?: Json | null
          status?: string | null
          turma_id: string
          turma_snapshot?: Json
          updated_at?: string | null
          validated_at?: string | null
          wa_error?: string | null
          wa_sent_at?: string | null
        }
        Update: {
          area_atuacao?: string | null
          course_id?: string
          created_at?: string | null
          created_by?: string | null
          deal_id?: string | null
          deal_pipeline_name?: string | null
          deal_title?: string | null
          deal_value?: number | null
          empresa_cidade?: string | null
          empresa_cnpj?: string | null
          empresa_endereco?: string | null
          empresa_estado?: string | null
          empresa_pais?: string | null
          empresa_telefone?: string | null
          enrolled_at?: string | null
          equip_writeback_at?: string | null
          equip_writeback_error?: string | null
          equipment_data?: Json | null
          especialidade?: string | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          numero_contrato?: string | null
          person_name?: string | null
          person_piperun_id?: string | null
          proposal_items_snapshot?: Json | null
          status?: string | null
          turma_id?: string
          turma_snapshot?: Json
          updated_at?: string | null
          validated_at?: string | null
          wa_error?: string | null
          wa_sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "smartops_course_enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "smartops_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "smartops_course_enrollments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "lead_model_routing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "smartops_course_enrollments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "lia_attendances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "smartops_course_enrollments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_academy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "smartops_course_enrollments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_cognitive"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "smartops_course_enrollments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_commercial"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "smartops_course_enrollments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_ecommerce"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "smartops_course_enrollments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_leads_correto"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "smartops_course_enrollments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_opportunity_engine"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "smartops_course_enrollments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_timing_alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "smartops_course_enrollments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_workflow_portfolio"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "smartops_course_enrollments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_workflow_timeline"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "smartops_course_enrollments_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "smartops_course_turmas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "smartops_course_enrollments_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "v_turmas_com_vagas"
            referencedColumns: ["id"]
          },
        ]
      }
      smartops_course_turmas: {
        Row: {
          active: boolean
          course_id: string
          created_at: string | null
          enrolled_count: number
          id: string
          label: string
          sellflux_tag: string | null
          slots: number
          sort_order: number
          updated_at: string | null
          whatsapp_group_link: string | null
        }
        Insert: {
          active?: boolean
          course_id: string
          created_at?: string | null
          enrolled_count?: number
          id?: string
          label: string
          sellflux_tag?: string | null
          slots?: number
          sort_order?: number
          updated_at?: string | null
          whatsapp_group_link?: string | null
        }
        Update: {
          active?: boolean
          course_id?: string
          created_at?: string | null
          enrolled_count?: number
          id?: string
          label?: string
          sellflux_tag?: string | null
          slots?: number
          sort_order?: number
          updated_at?: string | null
          whatsapp_group_link?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "smartops_course_turmas_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "smartops_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      smartops_courses: {
        Row: {
          active: boolean | null
          category: string | null
          cover_image_url: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          duration_days: number | null
          duration_hours_per_day: number | null
          id: string
          instructor_name: string | null
          location: string | null
          max_capacity: number | null
          meeting_link: string | null
          modality: string
          pipeline_id_kanban: number
          public_visible: boolean | null
          sellflux_campaign_tag: string | null
          slug: string
          stage_after_enroll: string
          title: string
          updated_at: string | null
          whatsapp_group_link: string | null
          whatsapp_message_template: string | null
        }
        Insert: {
          active?: boolean | null
          category?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          duration_days?: number | null
          duration_hours_per_day?: number | null
          id?: string
          instructor_name?: string | null
          location?: string | null
          max_capacity?: number | null
          meeting_link?: string | null
          modality: string
          pipeline_id_kanban?: number
          public_visible?: boolean | null
          sellflux_campaign_tag?: string | null
          slug: string
          stage_after_enroll?: string
          title: string
          updated_at?: string | null
          whatsapp_group_link?: string | null
          whatsapp_message_template?: string | null
        }
        Update: {
          active?: boolean | null
          category?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          duration_days?: number | null
          duration_hours_per_day?: number | null
          id?: string
          instructor_name?: string | null
          location?: string | null
          max_capacity?: number | null
          meeting_link?: string | null
          modality?: string
          pipeline_id_kanban?: number
          public_visible?: boolean | null
          sellflux_campaign_tag?: string | null
          slug?: string
          stage_after_enroll?: string
          title?: string
          updated_at?: string | null
          whatsapp_group_link?: string | null
          whatsapp_message_template?: string | null
        }
        Relationships: []
      }
      smartops_enrollment_companions: {
        Row: {
          area_atuacao: string | null
          created_at: string | null
          email: string | null
          enrollment_id: string
          especialidade: string | null
          id: string
          name: string
          phone: string | null
        }
        Insert: {
          area_atuacao?: string | null
          created_at?: string | null
          email?: string | null
          enrollment_id: string
          especialidade?: string | null
          id?: string
          name: string
          phone?: string | null
        }
        Update: {
          area_atuacao?: string | null
          created_at?: string | null
          email?: string | null
          enrollment_id?: string
          especialidade?: string | null
          id?: string
          name?: string
          phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "smartops_enrollment_companions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "smartops_course_enrollments"
            referencedColumns: ["id"]
          },
        ]
      }
      smartops_form_field_responses: {
        Row: {
          created_at: string | null
          field_id: string
          form_id: string
          id: string
          lead_id: string
          value: string | null
          workflow_cell_target: string | null
        }
        Insert: {
          created_at?: string | null
          field_id: string
          form_id: string
          id?: string
          lead_id: string
          value?: string | null
          workflow_cell_target?: string | null
        }
        Update: {
          created_at?: string | null
          field_id?: string
          form_id?: string
          id?: string
          lead_id?: string
          value?: string | null
          workflow_cell_target?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "smartops_form_field_responses_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "smartops_form_fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "smartops_form_field_responses_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "smartops_forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "smartops_form_field_responses_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "lead_model_routing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "smartops_form_field_responses_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "lia_attendances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "smartops_form_field_responses_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_academy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "smartops_form_field_responses_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_cognitive"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "smartops_form_field_responses_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_commercial"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "smartops_form_field_responses_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_ecommerce"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "smartops_form_field_responses_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_leads_correto"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "smartops_form_field_responses_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_opportunity_engine"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "smartops_form_field_responses_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_timing_alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "smartops_form_field_responses_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_workflow_portfolio"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "smartops_form_field_responses_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_workflow_timeline"
            referencedColumns: ["lead_id"]
          },
        ]
      }
      smartops_form_fields: {
        Row: {
          created_at: string
          custom_field_name: string | null
          db_column: string | null
          field_type: string
          form_id: string
          id: string
          label: string
          options: Json | null
          order_index: number
          placeholder: string | null
          required: boolean
          roi_config: Json | null
          updated_at: string
          workflow_cell_target: string | null
        }
        Insert: {
          created_at?: string
          custom_field_name?: string | null
          db_column?: string | null
          field_type?: string
          form_id: string
          id?: string
          label: string
          options?: Json | null
          order_index?: number
          placeholder?: string | null
          required?: boolean
          roi_config?: Json | null
          updated_at?: string
          workflow_cell_target?: string | null
        }
        Update: {
          created_at?: string
          custom_field_name?: string | null
          db_column?: string | null
          field_type?: string
          form_id?: string
          id?: string
          label?: string
          options?: Json | null
          order_index?: number
          placeholder?: string | null
          required?: boolean
          roi_config?: Json | null
          updated_at?: string
          workflow_cell_target?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "smartops_form_fields_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "smartops_forms"
            referencedColumns: ["id"]
          },
        ]
      }
      smartops_forms: {
        Row: {
          active: boolean
          badge_text: string | null
          brand_color_h: number | null
          brand_color_l: number | null
          brand_color_s: number | null
          campaign_identifier: string | null
          created_at: string
          cta_text: string | null
          description: string | null
          form_purpose: string
          hero_image_alt: string | null
          hero_image_url: string | null
          id: string
          media_type: string | null
          name: string
          product_catalog_id: string | null
          slug: string
          submissions_count: number
          subtitle: string | null
          success_message: string | null
          success_redirect_url: string | null
          theme_color: string | null
          title: string | null
          trust_text: string | null
          updated_at: string
          video_embed_url: string | null
          video_id: string | null
          video_thumbnail_url: string | null
          workflow_stage_target: string | null
        }
        Insert: {
          active?: boolean
          badge_text?: string | null
          brand_color_h?: number | null
          brand_color_l?: number | null
          brand_color_s?: number | null
          campaign_identifier?: string | null
          created_at?: string
          cta_text?: string | null
          description?: string | null
          form_purpose?: string
          hero_image_alt?: string | null
          hero_image_url?: string | null
          id?: string
          media_type?: string | null
          name: string
          product_catalog_id?: string | null
          slug: string
          submissions_count?: number
          subtitle?: string | null
          success_message?: string | null
          success_redirect_url?: string | null
          theme_color?: string | null
          title?: string | null
          trust_text?: string | null
          updated_at?: string
          video_embed_url?: string | null
          video_id?: string | null
          video_thumbnail_url?: string | null
          workflow_stage_target?: string | null
        }
        Update: {
          active?: boolean
          badge_text?: string | null
          brand_color_h?: number | null
          brand_color_l?: number | null
          brand_color_s?: number | null
          campaign_identifier?: string | null
          created_at?: string
          cta_text?: string | null
          description?: string | null
          form_purpose?: string
          hero_image_alt?: string | null
          hero_image_url?: string | null
          id?: string
          media_type?: string | null
          name?: string
          product_catalog_id?: string | null
          slug?: string
          submissions_count?: number
          subtitle?: string | null
          success_message?: string | null
          success_redirect_url?: string | null
          theme_color?: string | null
          title?: string | null
          trust_text?: string | null
          updated_at?: string
          video_embed_url?: string | null
          video_id?: string | null
          video_thumbnail_url?: string | null
          workflow_stage_target?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "smartops_forms_product_catalog_id_fkey"
            columns: ["product_catalog_id"]
            isOneToOne: false
            referencedRelation: "system_a_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "smartops_forms_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "knowledge_videos"
            referencedColumns: ["id"]
          },
        ]
      }
      smartops_turma_days: {
        Row: {
          created_at: string | null
          date: string
          day_number: number
          end_time: string
          id: string
          start_time: string
          topic: string | null
          turma_id: string
        }
        Insert: {
          created_at?: string | null
          date: string
          day_number: number
          end_time: string
          id?: string
          start_time: string
          topic?: string | null
          turma_id: string
        }
        Update: {
          created_at?: string | null
          date?: string
          day_number?: number
          end_time?: string
          id?: string
          start_time?: string
          topic?: string | null
          turma_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "smartops_turma_days_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "smartops_course_turmas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "smartops_turma_days_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "v_turmas_com_vagas"
            referencedColumns: ["id"]
          },
        ]
      }
      support_cases: {
        Row: {
          author_user_id: string | null
          brand_id: string | null
          causes: Json | null
          confidence: number | null
          created_at: string | null
          failure_type: string
          id: string
          image_urls: string[] | null
          model_id: string | null
          problem_description: string
          resin_id: string | null
          solutions: Json | null
          status: string
          tags: string[] | null
          title: string
          updated_at: string | null
          workflow_cad_softwares: string[] | null
          workflow_characterization: string[] | null
          workflow_cure_equipment: string[] | null
          workflow_dentistry_ortho: string[] | null
          workflow_final_equipment: string[] | null
          workflow_finishing: string[] | null
          workflow_installation: string[] | null
          workflow_lab_supplies: string[] | null
          workflow_notebook: string | null
          workflow_print_accessories: string[] | null
          workflow_print_parts: string[] | null
          workflow_print_software: string[] | null
          workflow_printers: string[] | null
          workflow_resins: string[] | null
          workflow_scanners: string[] | null
        }
        Insert: {
          author_user_id?: string | null
          brand_id?: string | null
          causes?: Json | null
          confidence?: number | null
          created_at?: string | null
          failure_type?: string
          id?: string
          image_urls?: string[] | null
          model_id?: string | null
          problem_description: string
          resin_id?: string | null
          solutions?: Json | null
          status?: string
          tags?: string[] | null
          title: string
          updated_at?: string | null
          workflow_cad_softwares?: string[] | null
          workflow_characterization?: string[] | null
          workflow_cure_equipment?: string[] | null
          workflow_dentistry_ortho?: string[] | null
          workflow_final_equipment?: string[] | null
          workflow_finishing?: string[] | null
          workflow_installation?: string[] | null
          workflow_lab_supplies?: string[] | null
          workflow_notebook?: string | null
          workflow_print_accessories?: string[] | null
          workflow_print_parts?: string[] | null
          workflow_print_software?: string[] | null
          workflow_printers?: string[] | null
          workflow_resins?: string[] | null
          workflow_scanners?: string[] | null
        }
        Update: {
          author_user_id?: string | null
          brand_id?: string | null
          causes?: Json | null
          confidence?: number | null
          created_at?: string | null
          failure_type?: string
          id?: string
          image_urls?: string[] | null
          model_id?: string | null
          problem_description?: string
          resin_id?: string | null
          solutions?: Json | null
          status?: string
          tags?: string[] | null
          title?: string
          updated_at?: string | null
          workflow_cad_softwares?: string[] | null
          workflow_characterization?: string[] | null
          workflow_cure_equipment?: string[] | null
          workflow_dentistry_ortho?: string[] | null
          workflow_final_equipment?: string[] | null
          workflow_finishing?: string[] | null
          workflow_installation?: string[] | null
          workflow_lab_supplies?: string[] | null
          workflow_notebook?: string | null
          workflow_print_accessories?: string[] | null
          workflow_print_parts?: string[] | null
          workflow_print_software?: string[] | null
          workflow_printers?: string[] | null
          workflow_resins?: string[] | null
          workflow_scanners?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "support_cases_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_cases_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_cases_resin_id_fkey"
            columns: ["resin_id"]
            isOneToOne: false
            referencedRelation: "resins"
            referencedColumns: ["id"]
          },
        ]
      }
      system_a_catalog: {
        Row: {
          active: boolean | null
          approved: boolean | null
          canonical_url: string | null
          category: string
          created_at: string | null
          cta_1_description: string | null
          cta_1_label: string | null
          cta_1_url: string | null
          cta_2_description: string | null
          cta_2_label: string | null
          cta_2_url: string | null
          cta_3_description: string | null
          cta_3_label: string | null
          cta_3_url: string | null
          currency: string | null
          description: string | null
          display_order: number | null
          external_id: string
          extra_data: Json | null
          id: string
          image_url: string | null
          keyword_ids: string[] | null
          keywords: string[] | null
          last_sync_at: string | null
          meta_description: string | null
          name: string
          og_image_url: string | null
          price: number | null
          product_category: string | null
          product_subcategory: string | null
          promo_price: number | null
          rating: number | null
          review_count: number | null
          seo_title_override: string | null
          slug: string | null
          source: string
          updated_at: string | null
          visible_in_ui: boolean | null
        }
        Insert: {
          active?: boolean | null
          approved?: boolean | null
          canonical_url?: string | null
          category: string
          created_at?: string | null
          cta_1_description?: string | null
          cta_1_label?: string | null
          cta_1_url?: string | null
          cta_2_description?: string | null
          cta_2_label?: string | null
          cta_2_url?: string | null
          cta_3_description?: string | null
          cta_3_label?: string | null
          cta_3_url?: string | null
          currency?: string | null
          description?: string | null
          display_order?: number | null
          external_id: string
          extra_data?: Json | null
          id?: string
          image_url?: string | null
          keyword_ids?: string[] | null
          keywords?: string[] | null
          last_sync_at?: string | null
          meta_description?: string | null
          name: string
          og_image_url?: string | null
          price?: number | null
          product_category?: string | null
          product_subcategory?: string | null
          promo_price?: number | null
          rating?: number | null
          review_count?: number | null
          seo_title_override?: string | null
          slug?: string | null
          source?: string
          updated_at?: string | null
          visible_in_ui?: boolean | null
        }
        Update: {
          active?: boolean | null
          approved?: boolean | null
          canonical_url?: string | null
          category?: string
          created_at?: string | null
          cta_1_description?: string | null
          cta_1_label?: string | null
          cta_1_url?: string | null
          cta_2_description?: string | null
          cta_2_label?: string | null
          cta_2_url?: string | null
          cta_3_description?: string | null
          cta_3_label?: string | null
          cta_3_url?: string | null
          currency?: string | null
          description?: string | null
          display_order?: number | null
          external_id?: string
          extra_data?: Json | null
          id?: string
          image_url?: string | null
          keyword_ids?: string[] | null
          keywords?: string[] | null
          last_sync_at?: string | null
          meta_description?: string | null
          name?: string
          og_image_url?: string | null
          price?: number | null
          product_category?: string | null
          product_subcategory?: string | null
          promo_price?: number | null
          rating?: number | null
          review_count?: number | null
          seo_title_override?: string | null
          slug?: string | null
          source?: string
          updated_at?: string | null
          visible_in_ui?: boolean | null
        }
        Relationships: []
      }
      system_health_logs: {
        Row: {
          ai_analysis: string | null
          ai_suggested_action: string | null
          auto_remediated: boolean
          created_at: string
          details: Json | null
          error_type: string | null
          function_name: string
          id: string
          lead_email: string | null
          lead_id: string | null
          resolved: boolean
          resolved_at: string | null
          severity: string
        }
        Insert: {
          ai_analysis?: string | null
          ai_suggested_action?: string | null
          auto_remediated?: boolean
          created_at?: string
          details?: Json | null
          error_type?: string | null
          function_name: string
          id?: string
          lead_email?: string | null
          lead_id?: string | null
          resolved?: boolean
          resolved_at?: string | null
          severity?: string
        }
        Update: {
          ai_analysis?: string | null
          ai_suggested_action?: string | null
          auto_remediated?: boolean
          created_at?: string
          details?: Json | null
          error_type?: string | null
          function_name?: string
          id?: string
          lead_email?: string | null
          lead_id?: string | null
          resolved?: boolean
          resolved_at?: string | null
          severity?: string
        }
        Relationships: []
      }
      team_members: {
        Row: {
          ativo: boolean
          created_at: string
          email: string
          id: string
          manychat_api_key: string | null
          nome_completo: string
          piperun_owner_id: string | null
          role: string
          updated_at: string
          waleads_api_key: string | null
          whatsapp_number: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          email: string
          id?: string
          manychat_api_key?: string | null
          nome_completo: string
          piperun_owner_id?: string | null
          role: string
          updated_at?: string
          waleads_api_key?: string | null
          whatsapp_number: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          email?: string
          id?: string
          manychat_api_key?: string | null
          nome_completo?: string
          piperun_owner_id?: string | null
          role?: string
          updated_at?: string
          waleads_api_key?: string | null
          whatsapp_number?: string
        }
        Relationships: []
      }
      technical_ticket_messages: {
        Row: {
          created_at: string
          id: string
          message: string
          sender: string
          ticket_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          sender?: string
          ticket_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          sender?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "technical_ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "technical_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      technical_tickets: {
        Row: {
          ai_summary: string | null
          client_summary: string | null
          conversation_log: Json | null
          created_at: string
          equipment: string | null
          id: string
          lead_id: string | null
          notified_at: string | null
          resolved_at: string | null
          status: string
          support_team_member_id: string | null
          ticket_full_id: string
          ticket_sequence: number
          ticket_version: string
        }
        Insert: {
          ai_summary?: string | null
          client_summary?: string | null
          conversation_log?: Json | null
          created_at?: string
          equipment?: string | null
          id?: string
          lead_id?: string | null
          notified_at?: string | null
          resolved_at?: string | null
          status?: string
          support_team_member_id?: string | null
          ticket_full_id: string
          ticket_sequence: number
          ticket_version?: string
        }
        Update: {
          ai_summary?: string | null
          client_summary?: string | null
          conversation_log?: Json | null
          created_at?: string
          equipment?: string | null
          id?: string
          lead_id?: string | null
          notified_at?: string | null
          resolved_at?: string | null
          status?: string
          support_team_member_id?: string | null
          ticket_full_id?: string
          ticket_sequence?: number
          ticket_version?: string
        }
        Relationships: [
          {
            foreignKeyName: "technical_tickets_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "lead_model_routing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technical_tickets_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "lia_attendances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technical_tickets_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_academy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technical_tickets_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_cognitive"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technical_tickets_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_commercial"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technical_tickets_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_ecommerce"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technical_tickets_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_leads_correto"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "technical_tickets_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_opportunity_engine"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "technical_tickets_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_timing_alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technical_tickets_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_workflow_portfolio"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "technical_tickets_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_workflow_timeline"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "technical_tickets_support_team_member_id_fkey"
            columns: ["support_team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      text_embedding_cache: {
        Row: {
          created_at: string | null
          embedding: string | null
          hit_count: number | null
          text_hash: string
        }
        Insert: {
          created_at?: string | null
          embedding?: string | null
          hit_count?: number | null
          text_hash: string
        }
        Update: {
          created_at?: string | null
          embedding?: string | null
          hit_count?: number | null
          text_hash?: string
        }
        Relationships: []
      }
      upsell_predictions: {
        Row: {
          generated_at: string | null
          id: string
          lead_id: string | null
          model_version: string | null
          predicted_qty: number | null
          predicted_value: number | null
          probability: number | null
          product_name: string | null
          reasoning: string | null
          window_end: string | null
          window_start: string | null
        }
        Insert: {
          generated_at?: string | null
          id?: string
          lead_id?: string | null
          model_version?: string | null
          predicted_qty?: number | null
          predicted_value?: number | null
          probability?: number | null
          product_name?: string | null
          reasoning?: string | null
          window_end?: string | null
          window_start?: string | null
        }
        Update: {
          generated_at?: string | null
          id?: string
          lead_id?: string | null
          model_version?: string | null
          predicted_qty?: number | null
          predicted_value?: number | null
          probability?: number | null
          product_name?: string | null
          reasoning?: string | null
          window_end?: string | null
          window_start?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "upsell_predictions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "lead_model_routing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "upsell_predictions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "lia_attendances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "upsell_predictions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_academy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "upsell_predictions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_cognitive"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "upsell_predictions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_commercial"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "upsell_predictions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_ecommerce"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "upsell_predictions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_leads_correto"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "upsell_predictions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_opportunity_engine"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "upsell_predictions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_timing_alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "upsell_predictions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_workflow_portfolio"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "upsell_predictions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_workflow_timeline"
            referencedColumns: ["lead_id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_inbox: {
        Row: {
          confidence_score: number | null
          created_at: string
          direction: string
          id: string
          intent_detected: string | null
          lead_id: string | null
          matched_by: string | null
          media_type: string | null
          media_url: string | null
          message_text: string | null
          phone: string
          phone_normalized: string | null
          processed_at: string | null
          raw_payload: Json | null
          seller_notified: boolean | null
        }
        Insert: {
          confidence_score?: number | null
          created_at?: string
          direction?: string
          id?: string
          intent_detected?: string | null
          lead_id?: string | null
          matched_by?: string | null
          media_type?: string | null
          media_url?: string | null
          message_text?: string | null
          phone: string
          phone_normalized?: string | null
          processed_at?: string | null
          raw_payload?: Json | null
          seller_notified?: boolean | null
        }
        Update: {
          confidence_score?: number | null
          created_at?: string
          direction?: string
          id?: string
          intent_detected?: string | null
          lead_id?: string | null
          matched_by?: string | null
          media_type?: string | null
          media_url?: string | null
          message_text?: string | null
          phone?: string
          phone_normalized?: string | null
          processed_at?: string | null
          raw_payload?: Json | null
          seller_notified?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_inbox_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "lead_model_routing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_inbox_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "lia_attendances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_inbox_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_academy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_inbox_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_cognitive"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_inbox_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_commercial"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_inbox_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_ecommerce"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_inbox_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_leads_correto"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "whatsapp_inbox_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_opportunity_engine"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "whatsapp_inbox_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_timing_alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_inbox_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_workflow_portfolio"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "whatsapp_inbox_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_workflow_timeline"
            referencedColumns: ["lead_id"]
          },
        ]
      }
      whatsapp_templates: {
        Row: {
          approved_at: string | null
          body_text: string
          buttons: Json | null
          created_at: string
          footer_text: string | null
          header_content: string | null
          header_type: string | null
          id: string
          language_code: string
          metadata: Json | null
          performance_data: Json | null
          related_product_ids: string[] | null
          source_id: string | null
          source_system: string
          status: string
          template_category: string
          template_name: string
          updated_at: string
          variables: string[] | null
        }
        Insert: {
          approved_at?: string | null
          body_text: string
          buttons?: Json | null
          created_at?: string
          footer_text?: string | null
          header_content?: string | null
          header_type?: string | null
          id?: string
          language_code?: string
          metadata?: Json | null
          performance_data?: Json | null
          related_product_ids?: string[] | null
          source_id?: string | null
          source_system?: string
          status?: string
          template_category?: string
          template_name: string
          updated_at?: string
          variables?: string[] | null
        }
        Update: {
          approved_at?: string | null
          body_text?: string
          buttons?: Json | null
          created_at?: string
          footer_text?: string | null
          header_content?: string | null
          header_type?: string | null
          id?: string
          language_code?: string
          metadata?: Json | null
          performance_data?: Json | null
          related_product_ids?: string[] | null
          source_id?: string | null
          source_system?: string
          status?: string
          template_category?: string
          template_name?: string
          updated_at?: string
          variables?: string[] | null
        }
        Relationships: []
      }
    }
    Views: {
      company_ltv: {
        Row: {
          company_id: string | null
          deals_ganhos: number | null
          deals_total: number | null
          ltv: number | null
          ticket_medio: number | null
          ultimo_fechamento: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_customer_graph"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "deals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "v_person_company_graph"
            referencedColumns: ["company_id"]
          },
        ]
      }
      lead_model_routing: {
        Row: {
          confidence_score_analysis: number | null
          created_at: string | null
          email: string | null
          id: string | null
          interest_timeline: string | null
          lead_stage_detected: string | null
          nome: string | null
          piperun_stage_name: string | null
          recommended_approach: string | null
          urgency_level: string | null
        }
        Insert: {
          confidence_score_analysis?: number | null
          created_at?: string | null
          email?: string | null
          id?: string | null
          interest_timeline?: string | null
          lead_stage_detected?: string | null
          nome?: string | null
          piperun_stage_name?: string | null
          recommended_approach?: string | null
          urgency_level?: string | null
        }
        Update: {
          confidence_score_analysis?: number | null
          created_at?: string | null
          email?: string | null
          id?: string | null
          interest_timeline?: string | null
          lead_stage_detected?: string | null
          nome?: string | null
          piperun_stage_name?: string | null
          recommended_approach?: string | null
          urgency_level?: string | null
        }
        Relationships: []
      }
      person_ltv: {
        Row: {
          deals_ganhos: number | null
          deals_total: number | null
          ltv: number | null
          person_id: string | null
          ticket_medio: number | null
          ultimo_fechamento: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deals_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "v_customer_graph"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "deals_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "v_person_company_graph"
            referencedColumns: ["person_id"]
          },
        ]
      }
      v_behavioral_health: {
        Row: {
          registros: number | null
          tabela: string | null
          ultimo: string | null
        }
        Relationships: []
      }
      v_customer_graph: {
        Row: {
          account_type: string | null
          anchor_product: string | null
          billing_document: string | null
          cargo: string | null
          cnpj: string | null
          company_city: string | null
          company_id: string | null
          company_name: string | null
          company_type: string | null
          company_uf: string | null
          created_at: string | null
          equip_scanner: string | null
          identity_keys: Json | null
          impressora_modelo: string | null
          intelligence_score: Json | null
          last_interaction: string | null
          lead_status: string | null
          ltv_b2b: number | null
          ltv_b2c: number | null
          person_cpf: string | null
          person_email: string | null
          person_id: string | null
          person_name: string | null
          person_phone: string | null
          razao_social: string | null
          status_cad: string | null
          temperatura_lead: string | null
          total_deals: number | null
          total_interactions: number | null
          ultimo_produto: string | null
          updated_at: string | null
          workflow_score: number | null
        }
        Relationships: []
      }
      v_equipment_field_map: {
        Row: {
          ativacao_field: string | null
          etapa_nome: string | null
          etapa_numero: number | null
          field_key: string | null
          match_patterns: string[] | null
          model_field: string | null
          serial_field: string | null
          subcategoria: string | null
        }
        Relationships: []
      }
      v_lead_academy: {
        Row: {
          academy_curso_concluido: string[] | null
          academy_progresso_pct: number | null
          academy_ultimo_modulo_acessado: string | null
          astron_courses_completed: number | null
          astron_courses_total: number | null
          astron_last_login_at: string | null
          created_at: string | null
          email: string | null
          id: string | null
          nome: string | null
        }
        Insert: {
          academy_curso_concluido?: string[] | null
          academy_progresso_pct?: number | null
          academy_ultimo_modulo_acessado?: string | null
          astron_courses_completed?: number | null
          astron_courses_total?: number | null
          astron_last_login_at?: string | null
          created_at?: string | null
          email?: string | null
          id?: string | null
          nome?: string | null
        }
        Update: {
          academy_curso_concluido?: string[] | null
          academy_progresso_pct?: number | null
          academy_ultimo_modulo_acessado?: string | null
          astron_courses_completed?: number | null
          astron_courses_total?: number | null
          astron_last_login_at?: string | null
          created_at?: string | null
          email?: string | null
          id?: string | null
          nome?: string | null
        }
        Relationships: []
      }
      v_lead_cognitive: {
        Row: {
          cognitive_analysis: Json | null
          cognitive_updated_at: string | null
          confidence_score_analysis: number | null
          created_at: string | null
          email: string | null
          id: string | null
          lead_stage_detected: string | null
          nome: string | null
          objection_risk: string | null
          primary_motivation: string | null
          psychological_profile: string | null
        }
        Insert: {
          cognitive_analysis?: Json | null
          cognitive_updated_at?: string | null
          confidence_score_analysis?: number | null
          created_at?: string | null
          email?: string | null
          id?: string | null
          lead_stage_detected?: string | null
          nome?: string | null
          objection_risk?: string | null
          primary_motivation?: string | null
          psychological_profile?: string | null
        }
        Update: {
          cognitive_analysis?: Json | null
          cognitive_updated_at?: string | null
          confidence_score_analysis?: number | null
          created_at?: string | null
          email?: string | null
          id?: string | null
          lead_stage_detected?: string | null
          nome?: string | null
          objection_risk?: string | null
          primary_motivation?: string | null
          psychological_profile?: string | null
        }
        Relationships: []
      }
      v_lead_commercial: {
        Row: {
          created_at: string | null
          email: string | null
          id: string | null
          ltv_total: number | null
          nome: string | null
          piperun_id: string | null
          piperun_last_contact_at: string | null
          piperun_probability: number | null
          piperun_stage_name: string | null
          piperun_value_mrr: number | null
          proposals_total_value: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id?: string | null
          ltv_total?: number | null
          nome?: string | null
          piperun_id?: string | null
          piperun_last_contact_at?: string | null
          piperun_probability?: number | null
          piperun_stage_name?: string | null
          piperun_value_mrr?: number | null
          proposals_total_value?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string | null
          ltv_total?: number | null
          nome?: string | null
          piperun_id?: string | null
          piperun_last_contact_at?: string | null
          piperun_probability?: number | null
          piperun_stage_name?: string | null
          piperun_value_mrr?: number | null
          proposals_total_value?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      v_lead_ecommerce: {
        Row: {
          created_at: string | null
          email: string | null
          id: string | null
          lojaintegrada_cliente_id: number | null
          lojaintegrada_ltv: number | null
          lojaintegrada_primeira_compra: string | null
          lojaintegrada_total_pedidos_pagos: number | null
          lojaintegrada_ultimo_pedido_data: string | null
          lojaintegrada_ultimo_pedido_valor: number | null
          nome: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id?: string | null
          lojaintegrada_cliente_id?: number | null
          lojaintegrada_ltv?: number | null
          lojaintegrada_primeira_compra?: string | null
          lojaintegrada_total_pedidos_pagos?: number | null
          lojaintegrada_ultimo_pedido_data?: string | null
          lojaintegrada_ultimo_pedido_valor?: number | null
          nome?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string | null
          lojaintegrada_cliente_id?: number | null
          lojaintegrada_ltv?: number | null
          lojaintegrada_primeira_compra?: string | null
          lojaintegrada_total_pedidos_pagos?: number | null
          lojaintegrada_ultimo_pedido_data?: string | null
          lojaintegrada_ultimo_pedido_valor?: number | null
          nome?: string | null
        }
        Relationships: []
      }
      v_lead_timeline: {
        Row: {
          details: string | null
          event_category: string | null
          event_name: string | null
          event_timestamp: string | null
          lead_id: string | null
          source_channel: string | null
        }
        Relationships: []
      }
      v_leads_correto: {
        Row: {
          atualizado_em: string | null
          cidade: string | null
          data_original: string | null
          email: string | null
          empresa: string | null
          etapa: string | null
          lead_id: string | null
          nome: string | null
          num_compras: number | null
          origem: string | null
          produto_principal: string | null
          proprietario: string | null
          resumo_ia: string | null
          score_rfm: number | null
          segmento: string | null
          status_real: string | null
          uf: string | null
          valor_total: number | null
        }
        Relationships: []
      }
      v_open_opportunities: {
        Row: {
          churn_risk_score: number | null
          cidade: string | null
          competitor_product: string | null
          computed_at: string | null
          email: string | null
          lead_id: string | null
          lis: number | null
          ltv_total: number | null
          nome: string | null
          nps_satisfacao: number | null
          opp_id: string | null
          opportunity_type: string | null
          piperun_stage_name: string | null
          priority: string | null
          product_name: string | null
          recommended_action: string | null
          recommended_message: string | null
          score: number | null
          signal_detail: string | null
          signal_source: string | null
          telefone_normalized: string | null
          urgency_level: string | null
          value_est_brl: number | null
          vendedor: string | null
          workflow_stage: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_opportunities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "lead_model_routing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_opportunities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "lia_attendances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_opportunities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_academy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_opportunities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_cognitive"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_opportunities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_commercial"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_opportunities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_lead_ecommerce"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_opportunities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_leads_correto"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "lead_opportunities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_opportunity_engine"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "lead_opportunities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_timing_alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_opportunities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_workflow_portfolio"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "lead_opportunities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "v_workflow_timeline"
            referencedColumns: ["lead_id"]
          },
        ]
      }
      v_opportunity_engine: {
        Row: {
          astron_courses_total: number | null
          astron_status: string | null
          cad_ativo: string | null
          cad_concorrente: string | null
          cad_gap: string | null
          churn_risk_score: number | null
          cidade: string | null
          cursos_ativo: string | null
          cursos_gap: string | null
          email: string | null
          final_ativo: string | null
          final_gap: string | null
          impressao_ativo: string | null
          impressao_concorrente: string | null
          impressao_gap: string | null
          last_deal_date: string | null
          lead_id: string | null
          lead_status: string | null
          lis: number | null
          ltv_potencial: number | null
          ltv_total: number | null
          nome: string | null
          nps_satisfacao: number | null
          opportunity_score: number | null
          perfil_cognitivo: string | null
          pipeline_potential: number | null
          piperun_pipeline_name: string | null
          piperun_stage_name: string | null
          portfolio_updated_at: string | null
          pos_ativo: string | null
          pos_gap: string | null
          scanner_ativo: string | null
          scanner_concorrente: string | null
          scanner_gap: string | null
          scanner_interesse: string | null
          stages_com_gap: Json | null
          tags: string | null
          telefone_normalized: string | null
          tem_concorrente: boolean | null
          top_opportunity: string | null
          top_stage: string | null
          top_value: number | null
          total_deals: number | null
          total_opps: number | null
          uf: string | null
          urgency_level: string | null
          vendedor: string | null
        }
        Insert: {
          astron_courses_total?: number | null
          astron_status?: string | null
          cad_ativo?: never
          cad_concorrente?: never
          cad_gap?: never
          churn_risk_score?: number | null
          cidade?: string | null
          cursos_ativo?: never
          cursos_gap?: never
          email?: string | null
          final_ativo?: never
          final_gap?: never
          impressao_ativo?: never
          impressao_concorrente?: never
          impressao_gap?: never
          last_deal_date?: string | null
          lead_id?: string | null
          lead_status?: string | null
          lis?: number | null
          ltv_potencial?: never
          ltv_total?: number | null
          nome?: string | null
          nps_satisfacao?: number | null
          opportunity_score?: number | null
          perfil_cognitivo?: never
          pipeline_potential?: never
          piperun_pipeline_name?: string | null
          piperun_stage_name?: string | null
          portfolio_updated_at?: string | null
          pos_ativo?: never
          pos_gap?: never
          scanner_ativo?: never
          scanner_concorrente?: never
          scanner_gap?: never
          scanner_interesse?: never
          stages_com_gap?: never
          tags?: never
          telefone_normalized?: string | null
          tem_concorrente?: never
          top_opportunity?: never
          top_stage?: never
          top_value?: never
          total_deals?: number | null
          total_opps?: never
          uf?: string | null
          urgency_level?: string | null
          vendedor?: string | null
        }
        Update: {
          astron_courses_total?: number | null
          astron_status?: string | null
          cad_ativo?: never
          cad_concorrente?: never
          cad_gap?: never
          churn_risk_score?: number | null
          cidade?: string | null
          cursos_ativo?: never
          cursos_gap?: never
          email?: string | null
          final_ativo?: never
          final_gap?: never
          impressao_ativo?: never
          impressao_concorrente?: never
          impressao_gap?: never
          last_deal_date?: string | null
          lead_id?: string | null
          lead_status?: string | null
          lis?: number | null
          ltv_potencial?: never
          ltv_total?: number | null
          nome?: string | null
          nps_satisfacao?: number | null
          opportunity_score?: number | null
          perfil_cognitivo?: never
          pipeline_potential?: never
          piperun_pipeline_name?: string | null
          piperun_stage_name?: string | null
          portfolio_updated_at?: string | null
          pos_ativo?: never
          pos_gap?: never
          scanner_ativo?: never
          scanner_concorrente?: never
          scanner_gap?: never
          scanner_interesse?: never
          stages_com_gap?: never
          tags?: never
          telefone_normalized?: string | null
          tem_concorrente?: never
          top_opportunity?: never
          top_stage?: never
          top_value?: never
          total_deals?: number | null
          total_opps?: never
          uf?: string | null
          urgency_level?: string | null
          vendedor?: string | null
        }
        Relationships: []
      }
      v_person_company_graph: {
        Row: {
          company_id: string | null
          company_name: string | null
          company_type: string | null
          deals_na_empresa: number | null
          email: string | null
          ltv_na_empresa: number | null
          person_id: string | null
          person_name: string | null
          role: string | null
        }
        Relationships: []
      }
      v_phone_duplicates: {
        Row: {
          canonical_id: string | null
          confidence: string | null
          duplicados: string[] | null
          emails: string[] | null
          ltvs: number[] | null
          max_ltv: number | null
          nomes: string[] | null
          telefone_normalized: string | null
          total: number | null
        }
        Relationships: []
      }
      v_timing_alerts: {
        Row: {
          email: string | null
          etapas_com_concorrente: number | null
          fresadora_concorrente: string | null
          id: string | null
          last_deal_date: string | null
          ltv_total: number | null
          next_upsell_score: number | null
          nome: string | null
          proximo_upsell: string | null
          recompra_days_overdue: number | null
          scanner_alerta: string | null
          telefone_normalized: string | null
          tipo_alerta: string | null
          total_hits: number | null
          vendedor: string | null
        }
        Insert: {
          email?: string | null
          etapas_com_concorrente?: never
          fresadora_concorrente?: never
          id?: string | null
          last_deal_date?: string | null
          ltv_total?: number | null
          next_upsell_score?: number | null
          nome?: string | null
          proximo_upsell?: string | null
          recompra_days_overdue?: number | null
          scanner_alerta?: never
          telefone_normalized?: string | null
          tipo_alerta?: never
          total_hits?: never
          vendedor?: string | null
        }
        Update: {
          email?: string | null
          etapas_com_concorrente?: never
          fresadora_concorrente?: never
          id?: string | null
          last_deal_date?: string | null
          ltv_total?: number | null
          next_upsell_score?: number | null
          nome?: string | null
          proximo_upsell?: string | null
          recompra_days_overdue?: number | null
          scanner_alerta?: never
          telefone_normalized?: string | null
          tipo_alerta?: never
          total_hits?: never
          vendedor?: string | null
        }
        Relationships: []
      }
      v_turmas_com_vagas: {
        Row: {
          active: boolean | null
          course_id: string | null
          course_title: string | null
          end_date: string | null
          end_time: string | null
          enrolled_count: number | null
          id: string | null
          instructor_name: string | null
          label: string | null
          location: string | null
          meeting_link: string | null
          modality: string | null
          pipeline_id_kanban: number | null
          sellflux_tag: string | null
          slots: number | null
          sort_order: number | null
          stage_after_enroll: string | null
          start_date: string | null
          start_time: string | null
          total_days: number | null
          vagas_disponiveis: number | null
          whatsapp_group_link: string | null
        }
        Relationships: [
          {
            foreignKeyName: "smartops_course_turmas_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "smartops_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      v_workflow_portfolio: {
        Row: {
          e1_acessorios_raw: string | null
          e1_notebook: string | null
          e1_scanner_bancada: string | null
          e1_scanner_intraoral: string | null
          e1_sdr_scanner: string | null
          e1_sdr_scanner_modelo: string | null
          e2_sdr_licenca: string | null
          e2_sdr_software: string | null
          e2_software: string | null
          e3_impressora: string | null
          e3_impressora_modelo_conc: string | null
          e3_resina: string | null
          e3_sdr_impressora: string | null
          e3_sdr_resina: string | null
          e4_equipamentos: string | null
          e4_sdr: string | null
          e4_sdr_cura_modelo: string | null
          e5_sdr_caracterizacao: string | null
          e5_sdr_dentistica: string | null
          e6_sdr_area: string | null
          e6_sdr_cursos: string | null
          e6_sdr_modalidade: string | null
          e7_equipamentos: string | null
          e7_sdr_fresagem: string | null
          e7_sdr_marca: string | null
          e7_sdr_modelo: string | null
          hits_e2_software: number | null
          hits_e3_impressora: number | null
          hits_e3_resina: number | null
          hits_e3_software: number | null
          hits_e4_equipamentos: number | null
          hits_e7_equipamentos: number | null
          hits_e7_software: number | null
          hits_fresagem: number | null
          lead_id: string | null
          status_cad: string | null
          status_impressora: string | null
          status_insumos: string | null
          status_pos_impressao: string | null
          status_scanner: string | null
        }
        Insert: {
          e1_acessorios_raw?: string | null
          e1_notebook?: string | null
          e1_scanner_bancada?: never
          e1_scanner_intraoral?: never
          e1_sdr_scanner?: string | null
          e1_sdr_scanner_modelo?: string | null
          e2_sdr_licenca?: string | null
          e2_sdr_software?: string | null
          e2_software?: never
          e3_impressora?: never
          e3_impressora_modelo_conc?: string | null
          e3_resina?: string | null
          e3_sdr_impressora?: string | null
          e3_sdr_resina?: string | null
          e4_equipamentos?: string | null
          e4_sdr?: string | null
          e4_sdr_cura_modelo?: string | null
          e5_sdr_caracterizacao?: string | null
          e5_sdr_dentistica?: string | null
          e6_sdr_area?: string | null
          e6_sdr_cursos?: string | null
          e6_sdr_modalidade?: string | null
          e7_equipamentos?: never
          e7_sdr_fresagem?: string | null
          e7_sdr_marca?: string | null
          e7_sdr_modelo?: string | null
          hits_e2_software?: number | null
          hits_e3_impressora?: number | null
          hits_e3_resina?: number | null
          hits_e3_software?: number | null
          hits_e4_equipamentos?: number | null
          hits_e7_equipamentos?: number | null
          hits_e7_software?: number | null
          hits_fresagem?: number | null
          lead_id?: string | null
          status_cad?: string | null
          status_impressora?: string | null
          status_insumos?: string | null
          status_pos_impressao?: string | null
          status_scanner?: string | null
        }
        Update: {
          e1_acessorios_raw?: string | null
          e1_notebook?: string | null
          e1_scanner_bancada?: never
          e1_scanner_intraoral?: never
          e1_sdr_scanner?: string | null
          e1_sdr_scanner_modelo?: string | null
          e2_sdr_licenca?: string | null
          e2_sdr_software?: string | null
          e2_software?: never
          e3_impressora?: never
          e3_impressora_modelo_conc?: string | null
          e3_resina?: string | null
          e3_sdr_impressora?: string | null
          e3_sdr_resina?: string | null
          e4_equipamentos?: string | null
          e4_sdr?: string | null
          e4_sdr_cura_modelo?: string | null
          e5_sdr_caracterizacao?: string | null
          e5_sdr_dentistica?: string | null
          e6_sdr_area?: string | null
          e6_sdr_cursos?: string | null
          e6_sdr_modalidade?: string | null
          e7_equipamentos?: never
          e7_sdr_fresagem?: string | null
          e7_sdr_marca?: string | null
          e7_sdr_modelo?: string | null
          hits_e2_software?: number | null
          hits_e3_impressora?: number | null
          hits_e3_resina?: number | null
          hits_e3_software?: number | null
          hits_e4_equipamentos?: number | null
          hits_e7_equipamentos?: number | null
          hits_e7_software?: number | null
          hits_fresagem?: number | null
          lead_id?: string | null
          status_cad?: string | null
          status_impressora?: string | null
          status_insumos?: string | null
          status_pos_impressao?: string | null
          status_scanner?: string | null
        }
        Relationships: []
      }
      v_workflow_timeline: {
        Row: {
          cidade: string | null
          computed_at: string | null
          dias_sem_compra: number | null
          e1_alerta: string | null
          e1_ativo: string | null
          e1_concorrente: string | null
          e1_dias: number | null
          e1_gap: string | null
          e1_hits: number | null
          e1_ultima_interacao: string | null
          e2_ativo: string | null
          e2_concorrente: string | null
          e2_dias: number | null
          e2_gap: string | null
          e2_hits: number | null
          e2_ultima_interacao: string | null
          e3_ativo: string | null
          e3_concorrente: string | null
          e3_dias: number | null
          e3_gap: string | null
          e3_hits: number | null
          e3_recompra: boolean | null
          e3_ultima_interacao: string | null
          e4_cross_sell: boolean | null
          e4_gap: string | null
          e4_hits: number | null
          e5_gap: string | null
          e5_hits: number | null
          e6_ativo: string | null
          e6_cursos_ok: number | null
          e6_engajamento: string | null
          e6_gap: string | null
          e7_concorrente: string | null
          e7_gap: string | null
          e7_hits: number | null
          e7_marca_concorrente: string | null
          e7_ultima_interacao: string | null
          email: string | null
          last_deal_date: string | null
          lead_id: string | null
          lead_status: string | null
          lis: number | null
          ltv_total: number | null
          nome: string | null
          opportunity_score: number | null
          piperun_stage_name: string | null
          proximo_upsell_etapa: string | null
          proximo_upsell_score: number | null
          recompra_alert: boolean | null
          recompra_dias_atrasado: number | null
          recompra_etapa: string | null
          stages_ativo: number | null
          stages_concorrente: number | null
          stages_sdr: number | null
          telefone_normalized: string | null
          total_hits: number | null
          vendedor: string | null
        }
        Insert: {
          cidade?: string | null
          computed_at?: string | null
          dias_sem_compra?: never
          e1_alerta?: never
          e1_ativo?: never
          e1_concorrente?: never
          e1_dias?: never
          e1_gap?: never
          e1_hits?: never
          e1_ultima_interacao?: never
          e2_ativo?: never
          e2_concorrente?: never
          e2_dias?: never
          e2_gap?: never
          e2_hits?: never
          e2_ultima_interacao?: never
          e3_ativo?: never
          e3_concorrente?: never
          e3_dias?: never
          e3_gap?: never
          e3_hits?: never
          e3_recompra?: never
          e3_ultima_interacao?: never
          e4_cross_sell?: never
          e4_gap?: never
          e4_hits?: never
          e5_gap?: never
          e5_hits?: never
          e6_ativo?: never
          e6_cursos_ok?: never
          e6_engajamento?: never
          e6_gap?: never
          e7_concorrente?: never
          e7_gap?: never
          e7_hits?: never
          e7_marca_concorrente?: never
          e7_ultima_interacao?: never
          email?: string | null
          last_deal_date?: string | null
          lead_id?: string | null
          lead_status?: string | null
          lis?: number | null
          ltv_total?: number | null
          nome?: string | null
          opportunity_score?: number | null
          piperun_stage_name?: string | null
          proximo_upsell_etapa?: never
          proximo_upsell_score?: never
          recompra_alert?: never
          recompra_dias_atrasado?: never
          recompra_etapa?: never
          stages_ativo?: never
          stages_concorrente?: never
          stages_sdr?: never
          telefone_normalized?: string | null
          total_hits?: never
          vendedor?: string | null
        }
        Update: {
          cidade?: string | null
          computed_at?: string | null
          dias_sem_compra?: never
          e1_alerta?: never
          e1_ativo?: never
          e1_concorrente?: never
          e1_dias?: never
          e1_gap?: never
          e1_hits?: never
          e1_ultima_interacao?: never
          e2_ativo?: never
          e2_concorrente?: never
          e2_dias?: never
          e2_gap?: never
          e2_hits?: never
          e2_ultima_interacao?: never
          e3_ativo?: never
          e3_concorrente?: never
          e3_dias?: never
          e3_gap?: never
          e3_hits?: never
          e3_recompra?: never
          e3_ultima_interacao?: never
          e4_cross_sell?: never
          e4_gap?: never
          e4_hits?: never
          e5_gap?: never
          e5_hits?: never
          e6_ativo?: never
          e6_cursos_ok?: never
          e6_engajamento?: never
          e6_gap?: never
          e7_concorrente?: never
          e7_gap?: never
          e7_hits?: never
          e7_marca_concorrente?: never
          e7_ultima_interacao?: never
          email?: string | null
          last_deal_date?: string | null
          lead_id?: string | null
          lead_status?: string | null
          lis?: number | null
          ltv_total?: number | null
          nome?: string | null
          opportunity_score?: number | null
          piperun_stage_name?: string | null
          proximo_upsell_etapa?: never
          proximo_upsell_score?: never
          recompra_alert?: never
          recompra_dias_atrasado?: never
          recompra_etapa?: never
          stages_ativo?: never
          stages_concorrente?: never
          stages_sdr?: never
          telefone_normalized?: string | null
          total_hits?: never
          vendedor?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      calculate_lead_intelligence_score: {
        Args: { p_lead_id: string }
        Returns: undefined
      }
      compute_workflow_timeline: {
        Args: { lead: Database["public"]["Tables"]["lia_attendances"]["Row"] }
        Returns: Json
      }
      fn_calc_workflow_score: {
        Args: { p_lead_id: string }
        Returns: undefined
      }
      fn_deduplicate_proposal_csv: {
        Args: { p_csv_rows: Json }
        Returns: {
          cod_produto: string
          itens_count: number
          nome_produto: string
          proposal_id: string
          quantidade: number
          tipo_frete: string
          valor_frete: number
          valor_total: number
          valor_unitario: number
        }[]
      }
      fn_get_lead_context: { Args: { p_lead_id: string }; Returns: Json }
      fn_list_proposal_products: {
        Args: never
        Returns: {
          occurrences: number
          product_name: string
        }[]
      }
      fn_map_lead_source: {
        Args: {
          p_formulario_source?: string
          p_loja_cliente_id?: string
          p_platform_lead_id?: string
          p_sellflux_custom_fields?: Json
        }
        Returns: {
          original_id: string
          source: string
          source_reference: string
        }[]
      }
      fn_record_lead_event: {
        Args: {
          p_entity_id?: string
          p_entity_name?: string
          p_entity_type?: string
          p_event_data?: Json
          p_event_type: string
          p_lead_id: string
          p_source_channel?: string
        }
        Returns: string
      }
      fn_search_deals_by_status: {
        Args: {
          p_limit?: number
          p_max_value?: number
          p_min_value?: number
          p_owner?: string
          p_product?: string
          p_status?: string
        }
        Returns: {
          deal_created_at: string
          deal_id: string
          deal_items: string
          deal_origin: string
          deal_owner: string
          deal_stage: string
          deal_status: string
          deal_value: number
          lead_email: string
          lead_id: string
          lead_nome: string
        }[]
      }
      fn_search_leads_by_proposal_product: {
        Args: { deal_status?: string; product_search: string }
        Returns: {
          lead_id: string
        }[]
      }
      get_brand_distribution: {
        Args: never
        Returns: {
          brand_name: string
          parameter_count: number
          percentage: number
        }[]
      }
      get_leads_for_opportunity_engine: {
        Args: { p_cols?: string; p_cutoff: string; p_limit?: number }
        Returns: {
          academy_curso_concluido: string[] | null
          academy_progresso_pct: number | null
          academy_ultimo_modulo_acessado: string | null
          anchor_product: string | null
          area_atuacao: string | null
          astron_courses_access: Json | null
          astron_courses_completed: number | null
          astron_courses_total: number | null
          astron_created_at: string | null
          astron_email: string | null
          astron_last_login_at: string | null
          astron_login_url: string | null
          astron_nome: string | null
          astron_phone: string | null
          astron_plans_active: string[] | null
          astron_plans_data: Json | null
          astron_status: string | null
          astron_synced_at: string | null
          astron_user_id: number | null
          ativo_cad: boolean | null
          ativo_cad_ia: boolean | null
          ativo_cura: boolean | null
          ativo_insumos: boolean | null
          ativo_notebook: boolean | null
          ativo_print: boolean | null
          ativo_scan: boolean | null
          ativo_smart_slice: boolean | null
          automation_cooldown_until: string | null
          avg_ticket: number | null
          buyer_type: string | null
          churn_risk_score: number | null
          cidade: string | null
          codigo_contrato: string | null
          cognitive_analysis: Json | null
          cognitive_analyzed_at: string | null
          cognitive_context_hash: string | null
          cognitive_model_version: string | null
          cognitive_prompt_hash: string | null
          cognitive_updated_at: string | null
          comentario_perda: string | null
          como_digitaliza: string | null
          company_hash: string | null
          company_id: string | null
          confidence_score_analysis: number | null
          created_at: string
          crm_lock_source: string | null
          crm_lock_until: string | null
          cs_treinamento: string | null
          data_contrato: string | null
          data_fechamento_crm: string | null
          data_primeiro_contato: string | null
          data_treinamento: string | null
          data_ultima_compra_cad: string | null
          data_ultima_compra_cad_ia: string | null
          data_ultima_compra_cura: string | null
          data_ultima_compra_insumos: string | null
          data_ultima_compra_notebook: string | null
          data_ultima_compra_print: string | null
          data_ultima_compra_scan: string | null
          data_ultima_compra_smart_slice: string | null
          email: string
          empresa_cidade: string | null
          empresa_cnae: string | null
          empresa_cnaes: Json | null
          empresa_cnpj: string | null
          empresa_custom_fields: Json | null
          empresa_data_abertura: string | null
          empresa_email: string | null
          empresa_email_nf: string | null
          empresa_endereco: Json | null
          empresa_facebook: string | null
          empresa_hash: string | null
          empresa_ie: string | null
          empresa_linkedin: string | null
          empresa_nome: string | null
          empresa_pais: string | null
          empresa_piperun_id: number | null
          empresa_porte: string | null
          empresa_razao_social: string | null
          empresa_segmento: string | null
          empresa_situacao: string | null
          empresa_telefone: string | null
          empresa_touch_model: string | null
          empresa_uf: string | null
          empresa_website: string | null
          entrada_sistema: string
          equip_cad: string | null
          equip_cad_ativacao: string | null
          equip_cad_serial: string | null
          equip_fresadora: string | null
          equip_fresadora_ativacao: string | null
          equip_fresadora_idade_meses: number | null
          equip_fresadora_serial: string | null
          equip_impressora: string | null
          equip_impressora_ativacao: string | null
          equip_impressora_ativacao_estimada: string | null
          equip_impressora_idade_meses: number | null
          equip_impressora_serial: string | null
          equip_notebook: string | null
          equip_notebook_ativacao: string | null
          equip_notebook_serial: string | null
          equip_pos_impressao: string | null
          equip_pos_impressao_ativacao: string | null
          equip_pos_impressao_serial: string | null
          equip_scanner: string | null
          equip_scanner_ativacao: string | null
          equip_scanner_ativacao_estimada: string | null
          equip_scanner_bancada: string | null
          equip_scanner_bancada_ativacao: string | null
          equip_scanner_bancada_serial: string | null
          equip_scanner_idade_meses: number | null
          equip_scanner_serial: string | null
          equip_upgrade_produto: string | null
          equip_upgrade_reasoning: string | null
          equip_upgrade_signal: boolean | null
          equip_upgrade_urgency: string | null
          especialidade: string | null
          form_name: string | null
          funil_entrada_crm: string | null
          historico_resumos: Json | null
          hits_cad: number | null
          hits_e1_acessorios: number | null
          hits_e1_notebook: number | null
          hits_e1_pecas_partes: number | null
          hits_e1_scanner_bancada: number | null
          hits_e1_scanner_intraoral: number | null
          hits_e2_creditos_ia: number | null
          hits_e2_pecas_partes: number | null
          hits_e2_servico: number | null
          hits_e2_software: number | null
          hits_e3_acessorios: number | null
          hits_e3_impressora: number | null
          hits_e3_pecas_partes: number | null
          hits_e3_resina: number | null
          hits_e3_software: number | null
          hits_e4_equipamentos: number | null
          hits_e4_limpeza_acabamento: number | null
          hits_e5_caracterizacao: number | null
          hits_e5_dentistica_orto: number | null
          hits_e5_instalacao: number | null
          hits_e6_online: number | null
          hits_e6_presencial: number | null
          hits_e7_acessorios: number | null
          hits_e7_equipamentos: number | null
          hits_e7_pecas_partes: number | null
          hits_e7_servico: number | null
          hits_e7_software: number | null
          hits_finalizacao: number | null
          hits_fresagem: number | null
          hits_impressao3d: number | null
          hits_insumos_cursos: number | null
          hits_pos_impressao: number | null
          hits_scanner: number | null
          id: string
          id_cliente_smart: string | null
          imersao_concluida: boolean | null
          imersao_data: string | null
          imersao_equipamentos_treinados: string[] | null
          imersao_turma_id: string | null
          impressora_modelo: string | null
          informacao_desejada: string | null
          insumos_adquiridos: string | null
          intelligence_score: Json | null
          intelligence_score_backfilled_at: string | null
          intelligence_score_total: number | null
          intelligence_score_updated_at: string | null
          interest_timeline: string | null
          ip_origem: string | null
          itens_proposta_crm: string | null
          itens_proposta_parsed: Json | null
          last_automated_action_at: string | null
          last_deal_date: string | null
          last_deal_value: number | null
          last_form_cad: string | null
          last_form_date_cad: string | null
          last_form_date_finalizacao: string | null
          last_form_date_fresagem: string | null
          last_form_date_impressao: string | null
          last_form_date_insumos: string | null
          last_form_date_pos_impressao: string | null
          last_form_date_scanner: string | null
          last_form_finalizacao: string | null
          last_form_fresagem: string | null
          last_form_impressao: string | null
          last_form_insumos: string | null
          last_form_pos_impressao: string | null
          last_form_scanner: string | null
          last_sync_at: string | null
          last_sync_source: string | null
          lead_card_published_at: string | null
          lead_card_url: string | null
          lead_stage_detected: string | null
          lead_status: string
          lead_timing_dias: number | null
          lojaintegrada_bairro: string | null
          lojaintegrada_bandeira_cartao: string | null
          lojaintegrada_cep: string | null
          lojaintegrada_cliente_data_criacao: string | null
          lojaintegrada_cliente_id: number | null
          lojaintegrada_cliente_obs: string | null
          lojaintegrada_complemento: string | null
          lojaintegrada_cupom_desconto: string | null
          lojaintegrada_cupom_json: Json | null
          lojaintegrada_data_modificacao: string | null
          lojaintegrada_data_nascimento: string | null
          lojaintegrada_endereco: string | null
          lojaintegrada_forma_envio: string | null
          lojaintegrada_forma_pagamento: string | null
          lojaintegrada_historico_pedidos: Json | null
          lojaintegrada_itens_json: Json | null
          lojaintegrada_ltv: number | null
          lojaintegrada_marketplace: Json | null
          lojaintegrada_numero: string | null
          lojaintegrada_parcelas: number | null
          lojaintegrada_pedido_id: number | null
          lojaintegrada_peso_real: number | null
          lojaintegrada_primeira_compra: string | null
          lojaintegrada_raw_payload: Json | null
          lojaintegrada_referencia: string | null
          lojaintegrada_sexo: string | null
          lojaintegrada_tipo_pessoa: string | null
          lojaintegrada_total_pedidos_pagos: number | null
          lojaintegrada_tracking_code: string | null
          lojaintegrada_ultimo_pedido_data: string | null
          lojaintegrada_ultimo_pedido_numero: number | null
          lojaintegrada_ultimo_pedido_status: string | null
          lojaintegrada_ultimo_pedido_valor: number | null
          lojaintegrada_updated_at: string | null
          lojaintegrada_utm_campaign: string | null
          lojaintegrada_valor_desconto: number | null
          lojaintegrada_valor_envio: number | null
          lojaintegrada_valor_subtotal: number | null
          ltv_projected_12m: number | null
          ltv_projected_24m: number | null
          ltv_total: number | null
          map_fresadora_date: string | null
          map_fresadora_marca: string | null
          map_fresadora_modelo: string | null
          merge_history: Json | null
          merged_at: string | null
          merged_into: string | null
          motivo_perda: string | null
          next_purchase_probability: number | null
          next_purchase_product: string | null
          next_purchase_value: number | null
          next_purchase_window_end: string | null
          next_purchase_window_start: string | null
          next_upsell_date_est: string | null
          next_upsell_product: string | null
          next_upsell_score: number | null
          next_upsell_stage: string | null
          nome: string
          nps_recomendaria: number | null
          nps_respondido_em: string | null
          nps_satisfacao: number | null
          nps_temas_cursos: string[] | null
          objection_risk: string | null
          opportunity_score: number | null
          opportunity_signals: Json | null
          origem_campanha: string | null
          original_date: string | null
          original_id: string | null
          original_source: string | null
          pais_origem: string | null
          person_hash: string | null
          person_id: string | null
          pessoa_cargo: string | null
          pessoa_cpf: string | null
          pessoa_endereco: Json | null
          pessoa_facebook: string | null
          pessoa_genero: string | null
          pessoa_hash: string | null
          pessoa_lgpd: Json | null
          pessoa_linkedin: string | null
          pessoa_manager: Json | null
          pessoa_nascimento: string | null
          pessoa_observation: string | null
          pessoa_piperun_id: number | null
          pessoa_rdstation: string | null
          pessoa_website: string | null
          piperun_action: Json | null
          piperun_activities: Json | null
          piperun_closed_at: string | null
          piperun_created_at: string | null
          piperun_custom_fields: Json | null
          piperun_deal_city: string | null
          piperun_deal_order: number | null
          piperun_deals_history: Json | null
          piperun_deleted: boolean | null
          piperun_description: string | null
          piperun_files: Json | null
          piperun_forms: Json | null
          piperun_frozen: boolean | null
          piperun_frozen_at: string | null
          piperun_hash: string | null
          piperun_id: string | null
          piperun_involved_users: Json | null
          piperun_last_contact_at: string | null
          piperun_lead_time: number | null
          piperun_link: string | null
          piperun_observation: string | null
          piperun_origin_id: number | null
          piperun_origin_name: string | null
          piperun_origin_sub_name: string | null
          piperun_owner_id: number | null
          piperun_pipeline_id: number | null
          piperun_pipeline_name: string | null
          piperun_probability: number | null
          piperun_probably_closed_at: string | null
          piperun_raw_payload: Json | null
          piperun_stage_changed_at: string | null
          piperun_stage_id: number | null
          piperun_stage_name: string | null
          piperun_status: number | null
          piperun_tags_raw: Json | null
          piperun_title: string | null
          piperun_updated_at: string | null
          piperun_value_mrr: number | null
          platform: string | null
          platform_ad_id: string | null
          platform_adgroup_id: string | null
          platform_campaign_id: string | null
          platform_cpl: number | null
          platform_form_id: string | null
          platform_lead_id: string | null
          platform_placement: string | null
          portfolio_json: Json | null
          portfolio_updated_at: string | null
          prediction_accuracy: number | null
          predictions_updated_at: string | null
          primary_motivation: string | null
          principal_aplicacao: string | null
          proactive_count: number | null
          proactive_sent_at: string | null
          produto_interesse: string | null
          produto_interesse_auto: string | null
          proposals_data: Json | null
          proposals_last_status: number | null
          proposals_total_mrr: number | null
          proposals_total_value: number | null
          proprietario_lead_crm: string | null
          psychological_profile: string | null
          raw_payload: Json | null
          recommended_approach: string | null
          recompra_alert: boolean | null
          recompra_days_overdue: number | null
          recompra_stage: string | null
          resina_consumo_mensal_estimado: number | null
          resina_interesse: string | null
          resumo_historico_ia: string | null
          reuniao_agendada: boolean | null
          rota_inicial_lia: string | null
          score: number | null
          sdr_cad_funcionalidades: string | null
          sdr_cad_licenca: string | null
          sdr_cad_treinamento: string | null
          sdr_caracterizacao_interesse: string | null
          sdr_caracterizacao_produto_atual: string | null
          sdr_cura_modelo: string | null
          sdr_cursos_area: string | null
          sdr_cursos_interesse: string | null
          sdr_cursos_modalidade: string | null
          sdr_dentistica_interesse: string | null
          sdr_fresadora_marca: string | null
          sdr_fresadora_modelo: string | null
          sdr_fresagem_interesse: string | null
          sdr_impressora_interesse: string | null
          sdr_insumos_lab_interesse: string | null
          sdr_insumos_tipo: string | null
          sdr_marca_impressora_param: string | null
          sdr_modelo_impressora_param: string | null
          sdr_pos_impressao_interesse: string | null
          sdr_resina_atual: string | null
          sdr_resina_param: string | null
          sdr_scanner_interesse: string | null
          sdr_scanner_modelo: string | null
          sdr_smartgum_interesse: boolean | null
          sdr_smartmake_interesse: boolean | null
          sdr_software_cad_interesse: string | null
          sdr_solucoes_interesse: string | null
          sdr_suporte_descricao: string | null
          sdr_suporte_equipamento: string | null
          sdr_suporte_tipo: string | null
          sdr_usa_resina_smartdent: boolean | null
          sellflux_custom_fields: Json | null
          sellflux_synced_at: string | null
          software_cad: string | null
          source: string
          source_reference: string | null
          status_atual_lead_crm: string | null
          status_cad: string | null
          status_impressora: string | null
          status_insumos: string | null
          status_oportunidade: string | null
          status_pos_impressao: string | null
          status_scanner: string | null
          suporte_educacional_tickets_total: number | null
          suporte_impressora_tickets_6m: number | null
          suporte_tecnico_tickets_total: number | null
          tags_crm: string[] | null
          telefone_normalized: string | null
          telefone_raw: string | null
          tem_impressora: string | null
          tem_scanner: string | null
          temperatura_lead: string | null
          timeline_cad: Json | null
          timeline_cursos: Json | null
          timeline_finalizacao: Json | null
          timeline_fresagem: Json | null
          timeline_impressao: Json | null
          timeline_pos_impressao: Json | null
          timeline_scanner: Json | null
          total_deals: number | null
          total_messages: number | null
          total_sessions: number | null
          uf: string | null
          ultima_etapa_comercial: string | null
          ultima_sessao_at: string | null
          updated_at: string
          urgency_level: string | null
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          valor_oportunidade: number | null
          volume_mensal_pecas: string | null
          wa_group_origem: string | null
          workflow_portfolio: Json | null
          workflow_score: number | null
          workflow_timeline: Json | null
          workflow_timeline_updated_at: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "lia_attendances"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_leads_for_piperun_backfill: {
        Args: { batch_size?: number }
        Returns: {
          id: string
          piperun_id: string
        }[]
      }
      get_rag_stats: {
        Args: never
        Returns: {
          chunk_count: number
          last_indexed_at: string
          source_type: string
        }[]
      }
      get_user_role: {
        Args: { user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_panel_access: { Args: { user_id: string }; Returns: boolean }
      increment_lookup_hit: { Args: { lookup_id: string }; Returns: undefined }
      is_admin: { Args: { user_id: string }; Returns: boolean }
      is_author: { Args: { user_id: string }; Returns: boolean }
      match_agent_embeddings: {
        Args: {
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          chunk_text: string
          id: string
          metadata: Json
          similarity: number
          source_type: string
        }[]
      }
      match_agent_embeddings_v2: {
        Args: {
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          chunk_text: string
          id: string
          metadata: Json
          similarity: number
          source_type: string
        }[]
      }
      merge_tags_crm: {
        Args: { p_lead_id: string; p_new_tags: string[] }
        Returns: undefined
      }
      normalize_name_for_compare: { Args: { n: string }; Returns: string }
      normalize_text: { Args: { text_input: string }; Returns: string }
      search_knowledge_base: {
        Args: { language_code?: string; search_query: string }
        Returns: {
          category_letter: string
          category_name: string
          content_id: string
          content_type: string
          excerpt: string
          matched_field: string
          relevance: number
          slug: string
          title: string
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      unaccent: { Args: { "": string }; Returns: string }
      update_extra_data_reviews: {
        Args: {
          p_google_place_id: string
          p_record_id: string
          p_reviews_reputation: Json
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "user" | "author"
      resin_type:
        | "standard"
        | "flexible"
        | "tough"
        | "transparent"
        | "biocompatible"
        | "high_temp"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user", "author"],
      resin_type: [
        "standard",
        "flexible",
        "tough",
        "transparent",
        "biocompatible",
        "high_temp",
      ],
    },
  },
} as const
