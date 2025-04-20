export type Script = {
  id: string
  created_at: string
  name: string
  content: string
  type: 'onboarding' | 'conversation'
  is_active: boolean
}

export type Message = {
  id: string
  created_at: string
  content: string
  role: 'user' | 'assistant'
  script_id: string | null
}

export type Profile = {
  id: string
  created_at: string
  name: string
  email: string
  avatar_url: string | null
}

export type Database = {
  public: {
    Tables: {
      scripts: {
        Row: Script
        Insert: Omit<Script, 'id' | 'created_at'>
        Update: Partial<Omit<Script, 'id' | 'created_at'>>
      }
      messages: {
        Row: Message
        Insert: Omit<Message, 'id' | 'created_at'>
        Update: Partial<Omit<Message, 'id' | 'created_at'>>
      }
      profiles: {
        Row: Profile
        Insert: Omit<Profile, 'id' | 'created_at'>
        Update: Partial<Omit<Profile, 'id' | 'created_at'>>
      }
    }
  }
} 