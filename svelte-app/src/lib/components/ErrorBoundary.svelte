<script lang="ts">
    import { onDestroy } from 'svelte';
    
    let error: Error | null;
    
    onDestroy(() => {
      error = null;
    });
  </script>
  
  {#if error}
    <div class="p-4 bg-red-100 text-red-700">
      <h2 class="text-xl font-bold">Error occurred</h2>
      <p>{error.message}</p>
    </div>
  {:else}
    <slot />
  {/if}