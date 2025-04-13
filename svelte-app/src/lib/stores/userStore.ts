import { writable } from 'svelte/store';
import { supabase } from '$lib/supabaseClient';

import type { User } from '@supabase/supabase-js';

export const user = writable<User | null>(null);

supabase.auth.getSession().then(({ data: { session } }) => {
  user.set(session?.user ?? null);
});

supabase.auth.onAuthStateChange((event, session) => {
  user.set(session?.user ?? null);
});