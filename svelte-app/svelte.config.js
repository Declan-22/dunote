import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      fallback: 'index.html',
      strict: false // 👈 Nuclear option to ignore all prerender errors
    }),
    prerender: {
      handleMissingId: 'ignore',
      entries: [] // 👈 Empty array skips dynamic routes
    }
  }
};

export default config;

