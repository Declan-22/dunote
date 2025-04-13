// routes/api/profile/[uid].json/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabase } from '$lib/supabaseClient';

export const GET: RequestHandler = async ({ params }) => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', params.uid)
    .single();

  return error ? json({ error }, { status: 500 }) : json(data);
};