// src/hooks.server.ts
import { createServerClient } from '@supabase/ssr'
import type { Handle } from '@sveltejs/kit'

export const handle: Handle = async ({ event, resolve }) => {
  
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
  console.log('Session in hooks:', (await event.locals.supabase.auth.getSession()).data.session)
  event.locals.session = (await event.locals.supabase.auth.getSession()).data.session

  return resolve(event)
}


