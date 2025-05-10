import { writable } from 'svelte/store';
import { supabase } from '$lib/supabaseClient';
import { browser } from '$app/environment';

import type { User } from '@supabase/supabase-js';

export const user = writable<User | null>(null);

if (browser) {
  supabase.auth.getSession().then(({ data }) => {
    if (data.session) user.set(data.session.user);
  });

  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session) user.set(session.user);
    if (event === 'SIGNED_OUT') user.set(null);
  });
}