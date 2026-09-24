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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      body_metrics: {
        Row: {
          created_at: string
          id: string
          kind: string
          measured_at: string
          supersedes: string | null
          user_id: string
          value: number
          voided: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          measured_at?: string
          supersedes?: string | null
          user_id?: string
          value: number
          voided?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          measured_at?: string
          supersedes?: string | null
          user_id?: string
          value?: number
          voided?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "body_metrics_supersedes_fkey"
            columns: ["supersedes"]
            isOneToOne: false
            referencedRelation: "body_metrics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "body_metrics_supersedes_fkey"
            columns: ["supersedes"]
            isOneToOne: false
            referencedRelation: "body_metrics_current"
            referencedColumns: ["id"]
          },
        ]
      }
      dev_notes: {
        Row: {
          addressed_in: string | null
          app_version: string | null
          body: string
          created_at: string
          id: string
          screen: string | null
          status: string
          user_id: string
        }
        Insert: {
          addressed_in?: string | null
          app_version?: string | null
          body: string
          created_at?: string
          id?: string
          screen?: string | null
          status?: string
          user_id?: string
        }
        Update: {
          addressed_in?: string | null
          app_version?: string | null
          body?: string
          created_at?: string
          id?: string
          screen?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      desk_sets: {
        Row: {
          created_at: string
          exercise_id: string
          id: string
          logged_at: string
          reps: number | null
          seconds: number | null
          supersedes: string | null
          user_id: string
          voided: boolean
        }
        Insert: {
          created_at?: string
          exercise_id: string
          id?: string
          logged_at?: string
          reps?: number | null
          seconds?: number | null
          supersedes?: string | null
          user_id?: string
          voided?: boolean
        }
        Update: {
          created_at?: string
          exercise_id?: string
          id?: string
          logged_at?: string
          reps?: number | null
          seconds?: number | null
          supersedes?: string | null
          user_id?: string
          voided?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "desk_sets_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "desk_sets_supersedes_fkey"
            columns: ["supersedes"]
            isOneToOne: false
            referencedRelation: "desk_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "desk_sets_supersedes_fkey"
            columns: ["supersedes"]
            isOneToOne: false
            referencedRelation: "desk_sets_current"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment: {
        Row: {
          bands: Json
          bench: string
          dumbbell_settings_lb: number[]
          pullup_bar: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          bands?: Json
          bench?: string
          dumbbell_settings_lb?: number[]
          pullup_bar?: boolean
          updated_at?: string
          user_id?: string
        }
        Update: {
          bands?: Json
          bench?: string
          dumbbell_settings_lb?: number[]
          pullup_bar?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      exercises: {
        Row: {
          context: string[]
          cue: string
          dumbbells: number
          equipment: string[]
          grp: string
          id: string
          knee: string
          ladder: string
          load: string
          name: string
          rep_max: number | null
          rep_min: number | null
          rung: number
          sec_max: number | null
          sec_min: number | null
          unilateral: boolean
        }
        Insert: {
          context?: string[]
          cue: string
          dumbbells: number
          equipment?: string[]
          grp: string
          id: string
          knee: string
          ladder: string
          load: string
          name: string
          rep_max?: number | null
          rep_min?: number | null
          rung: number
          sec_max?: number | null
          sec_min?: number | null
          unilateral?: boolean
        }
        Update: {
          context?: string[]
          cue?: string
          dumbbells?: number
          equipment?: string[]
          grp?: string
          id?: string
          knee?: string
          ladder?: string
          load?: string
          name?: string
          rep_max?: number | null
          rep_min?: number | null
          rung?: number
          sec_max?: number | null
          sec_min?: number | null
          unilateral?: boolean
        }
        Relationships: []
      }
      profile: {
        Row: {
          baseline_weight_lb: number
          created_at: string
          desk_targets: Json
          height_in: number
          home_workouts_week: number
          location: string | null
          location_date: string | null
          peloton_minutes_week: number
          program_start_date: string
          protein_target_g: number
          timezone: string
          updated_at: string
          user_id: string
          work_end: string
          work_start: string
        }
        Insert: {
          baseline_weight_lb: number
          created_at?: string
          desk_targets?: Json
          height_in: number
          home_workouts_week?: number
          location?: string | null
          location_date?: string | null
          peloton_minutes_week?: number
          program_start_date?: string
          protein_target_g?: number
          timezone?: string
          updated_at?: string
          user_id?: string
          work_end?: string
          work_start?: string
        }
        Update: {
          baseline_weight_lb?: number
          created_at?: string
          desk_targets?: Json
          height_in?: number
          home_workouts_week?: number
          location?: string | null
          location_date?: string | null
          peloton_minutes_week?: number
          program_start_date?: string
          protein_target_g?: number
          timezone?: string
          updated_at?: string
          user_id?: string
          work_end?: string
          work_start?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id?: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      sessions: {
        Row: {
          check_in: Json | null
          created_at: string
          effort: number | null
          fight_type: string | null
          id: string
          kind: string
          minutes: number | null
          notes: string | null
          override: boolean
          ride_kcal: number | null
          ride_output_kj: number | null
          started_at: string
          supersedes: string | null
          template: string | null
          time_box: string | null
          user_id: string
          voided: boolean
        }
        Insert: {
          check_in?: Json | null
          created_at?: string
          effort?: number | null
          fight_type?: string | null
          id?: string
          kind: string
          minutes?: number | null
          notes?: string | null
          override?: boolean
          ride_kcal?: number | null
          ride_output_kj?: number | null
          started_at?: string
          supersedes?: string | null
          template?: string | null
          time_box?: string | null
          user_id?: string
          voided?: boolean
        }
        Update: {
          check_in?: Json | null
          created_at?: string
          effort?: number | null
          fight_type?: string | null
          id?: string
          kind?: string
          minutes?: number | null
          notes?: string | null
          override?: boolean
          ride_kcal?: number | null
          ride_output_kj?: number | null
          started_at?: string
          supersedes?: string | null
          template?: string | null
          time_box?: string | null
          user_id?: string
          voided?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "sessions_supersedes_fkey"
            columns: ["supersedes"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_supersedes_fkey"
            columns: ["supersedes"]
            isOneToOne: false
            referencedRelation: "sessions_current"
            referencedColumns: ["id"]
          },
        ]
      }
      sets: {
        Row: {
          band: string | null
          created_at: string
          exercise_id: string
          id: string
          knee_flag: boolean
          reps: number | null
          rir: number | null
          seconds: number | null
          session_id: string
          set_index: number
          supersedes: string | null
          user_id: string
          voided: boolean
          weight_lb: number | null
        }
        Insert: {
          band?: string | null
          created_at?: string
          exercise_id: string
          id?: string
          knee_flag?: boolean
          reps?: number | null
          rir?: number | null
          seconds?: number | null
          session_id: string
          set_index: number
          supersedes?: string | null
          user_id?: string
          voided?: boolean
          weight_lb?: number | null
        }
        Update: {
          band?: string | null
          created_at?: string
          exercise_id?: string
          id?: string
          knee_flag?: boolean
          reps?: number | null
          rir?: number | null
          seconds?: number | null
          session_id?: string
          set_index?: number
          supersedes?: string | null
          user_id?: string
          voided?: boolean
          weight_lb?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sets_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sets_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sets_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions_current"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sets_supersedes_fkey"
            columns: ["supersedes"]
            isOneToOne: false
            referencedRelation: "sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sets_supersedes_fkey"
            columns: ["supersedes"]
            isOneToOne: false
            referencedRelation: "sets_current"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      body_metrics_current: {
        Row: {
          created_at: string | null
          id: string | null
          kind: string | null
          measured_at: string | null
          supersedes: string | null
          user_id: string | null
          value: number | null
          voided: boolean | null
        }
        Insert: {
          created_at?: string | null
          id?: string | null
          kind?: string | null
          measured_at?: string | null
          supersedes?: string | null
          user_id?: string | null
          value?: number | null
          voided?: boolean | null
        }
        Update: {
          created_at?: string | null
          id?: string | null
          kind?: string | null
          measured_at?: string | null
          supersedes?: string | null
          user_id?: string | null
          value?: number | null
          voided?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "body_metrics_supersedes_fkey"
            columns: ["supersedes"]
            isOneToOne: false
            referencedRelation: "body_metrics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "body_metrics_supersedes_fkey"
            columns: ["supersedes"]
            isOneToOne: false
            referencedRelation: "body_metrics_current"
            referencedColumns: ["id"]
          },
        ]
      }
      desk_sets_current: {
        Row: {
          created_at: string | null
          exercise_id: string | null
          id: string | null
          logged_at: string | null
          reps: number | null
          seconds: number | null
          supersedes: string | null
          user_id: string | null
          voided: boolean | null
        }
        Insert: {
          created_at?: string | null
          exercise_id?: string | null
          id?: string | null
          logged_at?: string | null
          reps?: number | null
          seconds?: number | null
          supersedes?: string | null
          user_id?: string | null
          voided?: boolean | null
        }
        Update: {
          created_at?: string | null
          exercise_id?: string | null
          id?: string | null
          logged_at?: string | null
          reps?: number | null
          seconds?: number | null
          supersedes?: string | null
          user_id?: string | null
          voided?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "desk_sets_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "desk_sets_supersedes_fkey"
            columns: ["supersedes"]
            isOneToOne: false
            referencedRelation: "desk_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "desk_sets_supersedes_fkey"
            columns: ["supersedes"]
            isOneToOne: false
            referencedRelation: "desk_sets_current"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions_current: {
        Row: {
          check_in: Json | null
          created_at: string | null
          effort: number | null
          fight_type: string | null
          id: string | null
          kind: string | null
          minutes: number | null
          notes: string | null
          override: boolean | null
          ride_kcal: number | null
          ride_output_kj: number | null
          started_at: string | null
          supersedes: string | null
          template: string | null
          time_box: string | null
          user_id: string | null
          voided: boolean | null
        }
        Insert: {
          check_in?: Json | null
          created_at?: string | null
          effort?: number | null
          fight_type?: string | null
          id?: string | null
          kind?: string | null
          minutes?: number | null
          notes?: string | null
          override?: boolean | null
          ride_kcal?: number | null
          ride_output_kj?: number | null
          started_at?: string | null
          supersedes?: string | null
          template?: string | null
          time_box?: string | null
          user_id?: string | null
          voided?: boolean | null
        }
        Update: {
          check_in?: Json | null
          created_at?: string | null
          effort?: number | null
          fight_type?: string | null
          id?: string | null
          kind?: string | null
          minutes?: number | null
          notes?: string | null
          override?: boolean | null
          ride_kcal?: number | null
          ride_output_kj?: number | null
          started_at?: string | null
          supersedes?: string | null
          template?: string | null
          time_box?: string | null
          user_id?: string | null
          voided?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "sessions_supersedes_fkey"
            columns: ["supersedes"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_supersedes_fkey"
            columns: ["supersedes"]
            isOneToOne: false
            referencedRelation: "sessions_current"
            referencedColumns: ["id"]
          },
        ]
      }
      sets_current: {
        Row: {
          band: string | null
          created_at: string | null
          exercise_id: string | null
          id: string | null
          knee_flag: boolean | null
          reps: number | null
          rir: number | null
          seconds: number | null
          session_id: string | null
          set_index: number | null
          supersedes: string | null
          user_id: string | null
          voided: boolean | null
          weight_lb: number | null
        }
        Insert: {
          band?: string | null
          created_at?: string | null
          exercise_id?: string | null
          id?: string | null
          knee_flag?: boolean | null
          reps?: number | null
          rir?: number | null
          seconds?: number | null
          session_id?: string | null
          set_index?: number | null
          supersedes?: string | null
          user_id?: string | null
          voided?: boolean | null
          weight_lb?: number | null
        }
        Update: {
          band?: string | null
          created_at?: string | null
          exercise_id?: string | null
          id?: string | null
          knee_flag?: boolean | null
          reps?: number | null
          rir?: number | null
          seconds?: number | null
          session_id?: string | null
          set_index?: number | null
          supersedes?: string | null
          user_id?: string | null
          voided?: boolean | null
          weight_lb?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sets_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sets_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sets_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions_current"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sets_supersedes_fkey"
            columns: ["supersedes"]
            isOneToOne: false
            referencedRelation: "sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sets_supersedes_fkey"
            columns: ["supersedes"]
            isOneToOne: false
            referencedRelation: "sets_current"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      is_strictly_ascending: { Args: { vals: number[] }; Returns: boolean }
      is_valid_check_in: { Args: { c: Json }; Returns: boolean }
      owns_body_metric: { Args: { row_id: string }; Returns: boolean }
      owns_desk_set: { Args: { row_id: string }; Returns: boolean }
      owns_session: { Args: { row_id: string }; Returns: boolean }
      owns_set: { Args: { row_id: string }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
