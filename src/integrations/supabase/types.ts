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
          ai_prompt_template: string | null
          author_id: string | null
          canva_template_url: string | null
          category_id: string | null
          content_html: string | null
          content_image_url: string | null
          created_at: string | null
          excerpt: string
          faqs: Json | null
          file_name: string | null
          file_url: string | null
          icon_color: string | null
          id: string
          keyword_ids: string[] | null
          keywords: string[] | null
          meta_description: string | null
          og_image_url: string | null
          order_index: number
          recommended_resins: string[] | null
          slug: string
          title: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          ai_prompt_template?: string | null
          author_id?: string | null
          canva_template_url?: string | null
          category_id?: string | null
          content_html?: string | null
          content_image_url?: string | null
          created_at?: string | null
          excerpt: string
          faqs?: Json | null
          file_name?: string | null
          file_url?: string | null
          icon_color?: string | null
          id?: string
          keyword_ids?: string[] | null
          keywords?: string[] | null
          meta_description?: string | null
          og_image_url?: string | null
          order_index: number
          recommended_resins?: string[] | null
          slug: string
          title: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          ai_prompt_template?: string | null
          author_id?: string | null
          canva_template_url?: string | null
          category_id?: string | null
          content_html?: string | null
          content_image_url?: string | null
          created_at?: string | null
          excerpt?: string
          faqs?: Json | null
          file_name?: string | null
          file_url?: string | null
          icon_color?: string | null
          id?: string
          keyword_ids?: string[] | null
          keywords?: string[] | null
          meta_description?: string | null
          og_image_url?: string | null
          order_index?: number
          recommended_resins?: string[] | null
          slug?: string
          title?: string
          updated_at?: string | null
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
      knowledge_videos: {
        Row: {
          content_id: string | null
          created_at: string | null
          id: string
          order_index: number
          title: string
          url: string
        }
        Insert: {
          content_id?: string | null
          created_at?: string | null
          id?: string
          order_index: number
          title: string
          url: string
        }
        Update: {
          content_id?: string | null
          created_at?: string | null
          id?: string
          order_index?: number
          title?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_videos_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "knowledge_contents"
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
      resins: {
        Row: {
          active: boolean
          canonical_url: string | null
          color: string | null
          created_at: string
          cta_1_description: string | null
          cta_1_label: string | null
          cta_1_url: string | null
          cta_2_description: string | null
          cta_2_label: string | null
          cta_2_url: string | null
          cta_3_description: string | null
          cta_3_label: string | null
          cta_3_url: string | null
          description: string | null
          id: string
          image_url: string | null
          keyword_ids: string[] | null
          keywords: string[] | null
          manufacturer: string
          meta_description: string | null
          name: string
          og_image_url: string | null
          price: number | null
          seo_title_override: string | null
          slug: string | null
          type: Database["public"]["Enums"]["resin_type"] | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          canonical_url?: string | null
          color?: string | null
          created_at?: string
          cta_1_description?: string | null
          cta_1_label?: string | null
          cta_1_url?: string | null
          cta_2_description?: string | null
          cta_2_label?: string | null
          cta_2_url?: string | null
          cta_3_description?: string | null
          cta_3_label?: string | null
          cta_3_url?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          keyword_ids?: string[] | null
          keywords?: string[] | null
          manufacturer: string
          meta_description?: string | null
          name: string
          og_image_url?: string | null
          price?: number | null
          seo_title_override?: string | null
          slug?: string | null
          type?: Database["public"]["Enums"]["resin_type"] | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          canonical_url?: string | null
          color?: string | null
          created_at?: string
          cta_1_description?: string | null
          cta_1_label?: string | null
          cta_1_url?: string | null
          cta_2_description?: string | null
          cta_2_label?: string | null
          cta_2_url?: string | null
          cta_3_description?: string | null
          cta_3_label?: string | null
          cta_3_url?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          keyword_ids?: string[] | null
          keywords?: string[] | null
          manufacturer?: string
          meta_description?: string | null
          name?: string
          og_image_url?: string | null
          price?: number | null
          seo_title_override?: string | null
          slug?: string | null
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
        Args: Record<PropertyKey, never>
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
      has_panel_access: {
        Args: { user_id: string }
        Returns: boolean
      }
      is_admin: {
        Args: { user_id: string }
        Returns: boolean
      }
      is_author: {
        Args: { user_id: string }
        Returns: boolean
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
