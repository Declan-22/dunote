// src/routes/+layout.server.ts
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
  try {
    const { data: { session } } = await locals.supabase.auth.getSession()
    return { session }
  } catch (error) {
    console.error('Failed to load session:', error)
    return { session: null }
  }
}



