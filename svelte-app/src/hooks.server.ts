// src/hooks.server.ts
import { createServerClient } from '@supabase/ssr'
import { redirect, type Handle } from '@sveltejs/kit'
import { supabase } from '$lib/supabaseClient';

export const handle: Handle = async ({ event, resolve }) => {
  // Create server client with proper cookie handling
  const supabase = createServerClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_KEY,
    {
      cookies: {
        get: (key) => event.cookies.get(key),
        set: (key, value, options) => {
          event.cookies.set(key, value, {
            ...options,
            path: '/',
            sameSite: 'lax',
            secure: import.meta.env.PROD
          });
        },
        remove: (key, options) => {
          event.cookies.delete(key, {
            ...options, 
            path: '/',
            sameSite: 'lax',
            secure: import.meta.env.PROD
          });
        }
      }
    }
  );

  // Get session from cookie
  const { data: { session }, error } = await supabase.auth.getSession();
  event.locals.session = session;

  // Protect auth routes
  if (event.url.pathname.startsWith('/notes') && !session) {
    throw redirect(303, '/login');
  }

  // Prevent logged-in users from accessing auth pages
  if (event.url.pathname.startsWith('/login') && session) {
    throw redirect(303, '/notes');
  }

  return resolve(event, {
    filterSerializedResponseHeaders(name) {
      return name === 'content-range';
    }
  });
};


