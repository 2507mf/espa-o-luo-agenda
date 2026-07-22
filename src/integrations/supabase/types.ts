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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          phone: string | null
          created_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          phone?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          phone?: string | null
          created_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          user_id: string
          role: Database["public"]["Enums"]["app_role"]
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          role?: Database["public"]["Enums"]["app_role"]
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          created_at?: string
        }
        Relationships: []
      }
      rooms: {
        Row: {
          id: string
          name: string
          description: string | null
          capacity: number | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          capacity?: number | null
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          capacity?: number | null
          is_active?: boolean
          created_at?: string
        }
        Relationships: []
      }
      bookings: {
        Row: {
          id: string
          room_id: string
          user_id: string
          starts_at: string
          ends_at: string
          status: Database["public"]["Enums"]["booking_status"]
          notes: string | null
          plan_purchase_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          room_id: string
          user_id: string
          starts_at: string
          ends_at: string
          status?: Database["public"]["Enums"]["booking_status"]
          notes?: string | null
          plan_purchase_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          room_id?: string
          user_id?: string
          starts_at?: string
          ends_at?: string
          status?: Database["public"]["Enums"]["booking_status"]
          notes?: string | null
          plan_purchase_id?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_plan_purchase_id_fkey"
            columns: ["plan_purchase_id"]
            isOneToOne: false
            referencedRelation: "plan_purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          id: string
          room_id: string
          name: string
          plan_type: Database["public"]["Enums"]["plan_type"]
          price: number
          units_included: number
          unit: Database["public"]["Enums"]["plan_unit"]
          validity_days: number | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          room_id: string
          name: string
          plan_type: Database["public"]["Enums"]["plan_type"]
          price: number
          units_included: number
          unit: Database["public"]["Enums"]["plan_unit"]
          validity_days?: number | null
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          room_id?: string
          name?: string
          plan_type?: Database["public"]["Enums"]["plan_type"]
          price?: number
          units_included?: number
          unit?: Database["public"]["Enums"]["plan_unit"]
          validity_days?: number | null
          is_active?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plans_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_purchases: {
        Row: {
          id: string
          plan_id: string
          user_id: string
          created_by: string
          price_paid: number
          unit: Database["public"]["Enums"]["plan_unit"]
          units_included: number
          units_used: number
          payment_status: Database["public"]["Enums"]["payment_status"]
          purchased_at: string
          expires_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          plan_id: string
          user_id: string
          created_by: string
          price_paid: number
          unit: Database["public"]["Enums"]["plan_unit"]
          units_included: number
          units_used?: number
          payment_status?: Database["public"]["Enums"]["payment_status"]
          purchased_at?: string
          expires_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          plan_id?: string
          user_id?: string
          created_by?: string
          price_paid?: number
          unit?: Database["public"]["Enums"]["plan_unit"]
          units_included?: number
          units_used?: number
          payment_status?: Database["public"]["Enums"]["payment_status"]
          purchased_at?: string
          expires_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_purchases_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_purchases_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: { _user_id: string; _role: Database["public"]["Enums"]["app_role"] }
        Returns: boolean
      }
      book_plan_shift: {
        Args: {
          _plan_purchase_id: string
          _room_id: string
          _starts_at: string
          _ends_at: string
          _notes?: string | null
        }
        Returns: Database["public"]["Tables"]["bookings"]["Row"]
      }
      self_serve_purchase: {
        Args: { _plan_id: string; _slots: Json; _notes?: string | null }
        Returns: Database["public"]["Tables"]["plan_purchases"]["Row"]
      }
    }
    Enums: {
      app_role: "admin" | "user"
      booking_status: "confirmed" | "cancelled"
      plan_type: "combo" | "mensalista" | "turno_avulso" | "hora_avulsa"
      plan_unit: "turno" | "hora"
      payment_status: "pending" | "confirmed"
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
      app_role: ["admin", "user"],
      booking_status: ["confirmed", "cancelled"],
      plan_type: ["combo", "mensalista", "turno_avulso", "hora_avulsa"],
      plan_unit: ["turno", "hora"],
      payment_status: ["pending", "confirmed"],
    },
  },
} as const
