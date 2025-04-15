// src/routes/+layout.server.ts
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
  return {
    session: await locals.supabase.auth.getSession()
  };
};

export const prerender = true;
export const trailingSlash = 'always';



