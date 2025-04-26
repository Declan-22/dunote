import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      fallback: 'index.html'
    }),
    csp: {
      directives: {
        'script-src': [
            "'self'",
            'https://apis.google.com',
            'https://www.gstatic.com',
            "'unsafe-inline'"
        ],
        'frame-src': [
            "'self'",
            'https://accounts.google.com',
            'https://docs.google.com'
        ],
        'connect-src': [
            "'self'",
            'https://www.googleapis.com',
            'https://psrarnzlkhpkgjtihtha.supabase.co'
        ]
      }
    }
  }
};

export default config;

