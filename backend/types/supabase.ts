export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      scripts: {
        Row: {
          id: number
          stage: number
          prompt: string
          created_at?: string
          updated_at?: string
        }
        Insert: {
          id?: number
          stage: number
          prompt: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          stage?: number
          prompt?: string
          created_at?: string
          updated_at?: string
        }
      }
      sessions: {
        Row: {
          id: string
          user_id?: string
          created_at: string
          updated_at?: string
          last_activity?: string
        }
        Insert: {
          id: string
          user_id?: string
          created_at?: string
          updated_at?: string
          last_activity?: string
        }
        Update: {
          id?: string
          user_id?: string
          created_at?: string
          updated_at?: string
          last_activity?: string
        }
      }
      messages: {
        Row: {
          id: number
          session_id: string
          role: string
          content: string
          created_at: string
        }
        Insert: {
          id?: number
          session_id: string
          role: string
          content: string
          created_at?: string
        }
        Update: {
          id?: number
          session_id?: string
          role?: string
          content?: string
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
} 