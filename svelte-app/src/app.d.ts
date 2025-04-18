// src/app.d.ts
import type { SupabaseClient, Session } from '@supabase/supabase-js'

declare global {
  namespace App {
    interface Locals {
      supabase: SupabaseClient
      session: Session | null
    }
    interface PageData {
      session?: Session | null
      notesCount?: number
    }
  }
}
declare module 'drawflow'
export {};


