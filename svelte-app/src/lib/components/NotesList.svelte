
<svelte:window on:keydown={handleKeydown} />
<script lang="ts">
    import { noteStore } from '$lib/stores/noteStore';
    import { fade } from 'svelte/transition';
    import { user } from '$lib/stores/userStore';
    import { goto } from '$app/navigation';
    let searchQuery = '';
    type Note = { id: string; title: string; content?: string; created_at: string; updated_at: string };
    let notes: Note[] = [];
    let isLoading = false;
    let currentPage = 1;
    const itemsPerPage = 20;
    
    
    function handleKeydown(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      document.querySelector('input')?.focus();
    }
  }
    async function loadNotes() {
      isLoading = true;
      try {
        if (searchQuery.length > 2) {
          notes = await noteStore.searchNotes(searchQuery);
        } else {
          notes = await noteStore.loadNotes();
        }
      } catch (err) {
        console.error('Load failed:', err);
      }
      isLoading = false;
    }

    async function handleNoteClick(note: Note) {
    if (note.id) {
      await goto(`/notes/${note.id}`);
    } else {
      // Handle new notes that haven't been saved yet
      const newNote = await noteStore.saveNote(note);
      await goto(`/notes/${newNote.id}`);
    }
  }
  
    $: if (searchQuery || currentPage) loadNotes();
  </script>

  <div class="max-w-4xl mx-auto p-4">
    <!-- Search Bar -->
    <div class="mb-6">
      <input
        type="text"
        bind:value={searchQuery}
        placeholder="Search notes..."
        class="w-full p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  
    <!-- Loading State -->
    {#if isLoading}
      <div class="text-center py-8 text-gray-500">
        <svg class="animate-spin h-8 w-8 mx-auto text-blue-500" viewBox="0 0 24 24">
          <!-- Spinner SVG -->
        </svg>
      </div>
  
    <!-- Notes List -->
    {:else}
      <div class="space-y-2">
        {#each notes as note (note.id)}
        
        <div
        on:click={() => handleNoteClick(note)}
        on:keydown={(e) => e.key === 'Enter' && handleNoteClick(note)}
        role="button"
        tabindex="0"
        class="group relative block p-4 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 transition-colors cursor-pointer"
        >
          <div class="absolute top-2 right-2 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button 
              on:click|stopPropagation={() => noteStore.deleteNote(note.id)}
              class="p-1 text-red-500 hover:text-red-700"
              title="Delete note"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
              </svg>
            </button>
          </div>

            <h3 class="text-lg font-semibold mb-1">{note.title || 'Untitled Note'}</h3>
            {#if note.content}
              <p class="text-gray-600 dark:text-gray-400 line-clamp-2 mb-2">
                {note.content.replace(/<[^>]*>?/gm, '')} <!-- Strip HTML tags -->
              </p>
            {/if}
            <div class="flex items-center text-sm text-gray-500">
              <span class="mr-4">
                Created: {new Date(note.created_at).toLocaleDateString()}
              </span>
              {#if note.updated_at !== note.created_at}
                <span>
                  Modified: {new Date(note.updated_at).toLocaleDateString()}
                </span>
              {/if}
            </div>
        </div>
        {:else}
          <div class="text-center py-8 text-gray-500">
            {searchQuery ? 'No matching notes found' : 'No notes yet - create one!'}
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <style>
    .line-clamp-2 {
      display: -webkit-box;
      -webkit-line-clamp: 2;
      line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
  
    input:focus {
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.5);
    }
  </style>