<script lang="ts">
    import { page } from '$app/stores';
    import Output from '$lib/components/Output.svelte';
  </script>
  
  {#if $page.params.id}
    <Output siloId={$page.params.id} />
  {/if}