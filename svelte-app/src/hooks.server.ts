// src/hooks.server.ts
import { createServerClient } from '@supabase/ssr'
import type { Handle } from '@sveltejs/kit'
import { supabase } from '$lib/supabaseClient';

export const handle: Handle = async ({ event, resolve }) => {
  // Initialize Supabase
  event.locals.supabase = createServerClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_KEY,
    {
      cookies: {
        get: (key) => event.cookies.get(key),
        set: (key, value, options) => {
          event.cookies.set(key, value, { ...options, path: '/' })
        },
        remove: (key, options) => {
          event.cookies.delete(key, { ...options, path: '/' })
        }
      }
    }
  )

  const { data: { session } } = await event.locals.supabase.auth.getSession()
  event.locals.session = session

  // Resolve with proper headers
  const response = await resolve(event, {
    filterSerializedResponseHeaders(name) {
      return name === 'content-range' || name === 'x-supabase-api-version'
    }
  })

  return response
}


