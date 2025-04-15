<!-- src/routes/notes/+page.svelte -->
<script lang="ts">
  import NotesList from '$lib/components/NotesList.svelte';
  import { noteStore } from '$lib/stores/noteStore';
  import { goto } from '$app/navigation';

  async function createNewNote() {
    const note = await noteStore.createNewNote();
    await goto(`/notes/${note.id}`);
  }

    


</script>

<div class="notes-app h-screen flex flex-col bg-[var(--bg-primary)] text-[var(--text-primary)]">
  <div class="p-4 border-b border-[var(--border-color)]">
    <div class="max-w-4xl mx-auto flex justify-between items-center">
      <h1 class="text-2xl font-bold">Notes</h1>
      <button 
        on:click={createNewNote}
        class="px-4 py-2 bg-[var(--brand-green)] text-white rounded-md hover:bg-opacity-90 flex items-center"
      >
        <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
        </svg>
        New Note
      </button>
    </div>
  </div>
  
  <div class="flex-1 overflow-y-auto">
    <div class="max-w-4xl mx-auto p-4">
      <NotesList />
    </div>
  </div>
</div>

