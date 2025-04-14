<script lang="ts">
    import { page } from '$app/stores';
    import { noteStore } from '$lib/stores/noteStore';
    import { onMount } from 'svelte';
  
    let note: Note | null = null;
    let isLoading = true;
  
    onMount(async () => {
      const noteId = $page.params.id;
      if (noteId) {
        note = await noteStore.getNoteById(noteId);
      }
      isLoading = false;
    });
  </script>

{#if isLoading}
  <div class="text-center p-8">Loading...</div>
{:else if note}
  <!-- Your existing note editor component -->
{:else}
  <div class="text-center p-8">Note not found</div>
{/if}