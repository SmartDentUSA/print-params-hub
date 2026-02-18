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
          embedding_updated_at: string | null
          id: string
          metadata: Json | null
          source_type: string
        }
        Insert: {
          chunk_text: string
          content_id?: string | null
          created_at?: string | null
          embedding?: string | null
          embedding_updated_at?: string | null
          id?: string
          metadata?: Json | null
          source_type: string
        }
        Update: {
          chunk_text?: string
          content_id?: string | null
          created_at?: string | null
          embedding?: string | null
          embedding_updated_at?: string | null
          id?: string
          metadata?: Json | null
          source_type?: string
        }
        Relationships: []
      }
      agent_interactions: {
        Row: {
          agent_response: string | null
          context_sources: Json | null
          created_at: string | null
          feedback: string | null
          feedback_comment: string | null
          id: string
          lang: string | null
          session_id: string
          top_similarity: number | null
          unanswered: boolean | null
          user_message: string
        }
        Insert: {
          agent_response?: string | null
          context_sources?: Json | null
          created_at?: string | null
          feedback?: string | null
          feedback_comment?: string | null
          id?: string
          lang?: string | null
          session_id: string
          top_similarity?: number | null
          unanswered?: boolean | null
          user_message: string
        }
        Update: {
          agent_response?: string | null
          context_sources?: Json | null
          created_at?: string | null
          feedback?: string | null
          feedback_comment?: string | null
          id?: string
          lang?: string | null
          session_id?: string
          top_similarity?: number | null
          unanswered?: boolean | null
          user_message?: string
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
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          frequency?: number | null
          id?: string
          lang?: string | null
          question: string
          resolution_note?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          frequency?: number | null
          id?: string
          lang?: string | null
          question?: string
          resolution_note?: string | null
          status?: string | null
          updated_at?: string | null
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_brand_distribution: {
        Args: never
        Returns: {
          brand_name: string
          parameter_count: number
          percentage: number
        }[]
      }
      get_user_role: {
        Args: { user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_panel_access: { Args: { user_id: string }; Returns: boolean }
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
