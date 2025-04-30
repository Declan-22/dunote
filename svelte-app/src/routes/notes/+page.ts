import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent }) => {
  // We no longer redirect users, we'll handle auth state in the components
  return {};
};

// Add type definitions
interface ParentData {
  supabase: any;
  session: any;
}

// Removed duplicate PageData declaration as it conflicts with the generated type in .svelte-kit