import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      fallback: 'index.html',
      precompress: false
    }),
    prerender: {
      handleHttpError: ({ path, message }) => {
        // Ignore auth-related errors during prerendering
        if (path.startsWith('/login') || path.startsWith('/signup')) return;
        throw new Error(message);
      }
    }
  }
};

export default config;

