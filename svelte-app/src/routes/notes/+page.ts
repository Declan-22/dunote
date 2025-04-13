// src/routes/notes/+page.ts
import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent }) => {
  const { session } = await parent();
  
  if (!session) {
    throw redirect(303, '/login');
  }

  return {};
};

// Add type definitions
interface ParentData {
  supabase: any;
  session: any;
}

// Removed duplicate PageData declaration as it conflicts with the generated type in .svelte-kit