import { redirect } from '@sveltejs/kit';

export const load = async ({ locals }) => {
  if (!locals.session) throw redirect(303, '/login');
  return { session: locals.session };
}