<svelte:window on:keydown={handleKeydown} />
<script lang="ts">
    import { noteStore } from '$lib/stores/noteStore';
    import { fade } from 'svelte/transition';
    import { user } from '$lib/stores/userStore';
    import { goto } from '$app/navigation';
    import { onMount } from 'svelte';
    
    let searchQuery = '';
    let notes: Note[] = [];
    let isLoading = false;
    let currentPage = 1;
    let isAuthenticated = false;
    let showAuthWarning = false;
    const itemsPerPage = 20;
    let activeSettingsNote: string | null = null;
    
    onMount(() => {
      const unsubscribe = user.subscribe(value => {
        isAuthenticated = !!value?.id;
        // Only show warning once
        if (!isAuthenticated && !showAuthWarning) {
          showAuthWarning = true;
        }
        loadNotes();
      });
      
      return () => {
        unsubscribe();
      };
    });
    
    function handleKeydown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        document.querySelector('input')?.focus();
      }
    }

    interface Note {
        id: string;
        title: string;
        content?: string;
        created_at: string;
        updated_at: string;
        tags: string[];
        attachedNodes: Array<{ id: string; title: string }>;
        user_id?: string;
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
      } finally {
        isLoading = false;
      }
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
    
    function toggleSettings(noteId: string, event: MouseEvent) {
        event.stopPropagation();
        activeSettingsNote = activeSettingsNote === noteId ? null : noteId;
    }

    function closeSettings() {
        activeSettingsNote = null;
    }

    function downloadNote(note: Note, event: MouseEvent) {
        event.stopPropagation();
        closeSettings();

        const content = note.content || '';
        const title = note.title || 'Untitled Note';
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `${title}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    async function deleteNote(noteId: string, event: MouseEvent) {
        event.stopPropagation();
        closeSettings();

        if (confirm('Are you sure you want to delete this note?')) {
            await noteStore.deleteNote(noteId);
            await loadNotes();
        }
    }

    function handleClickOutside(event: MouseEvent) {
        if (activeSettingsNote) {
            closeSettings();
        }
    }
    
    function dismissWarning() {
      showAuthWarning = false;
    }
  
    $: if (searchQuery || currentPage) loadNotes();
</script>

<svelte:body on:click={handleClickOutside} />

<div class="flex flex-col space-y-4">
  <!-- Authentication Warning -->
  {#if showAuthWarning && !isAuthenticated}
    <div class="bg-amber-50 border-l-4 border-amber-500 p-4 mb-4 rounded-md" transition:fade={{ duration: 150 }}>
      <div class="flex items-start">
        <div class="flex-shrink-0">
          <svg class="h-5 w-5 text-amber-500" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
          </svg>
        </div>
        <div class="ml-3">
          <p class="text-sm text-amber-700">
            You are not logged in. You can view and create notes, but they will not be saved permanently without logging in.
          </p>
        </div>
        <div class="ml-auto pl-3">
          <div class="-mx-1.5 -my-1.5">
            <button 
              on:click={dismissWarning}
              class="inline-flex rounded-md p-1.5 text-amber-500 hover:bg-amber-100 focus:outline-none"
            >
              <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  {/if}

  <!-- Search Bar -->
  <div class="relative">
      <div class="absolute inset-y-0 left-3 flex items-center pointer-events-none">
          <svg class="w-5 h-5 text-gray-00" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
      </div>
      <input
          type="text"
          bind:value={searchQuery}
          placeholder="Search notes... (Ctrl+K)"
          class="w-full pl-10 pr-4 py-3 rounded-lg border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
      />
  </div>

  <!-- Loading State -->
  {#if isLoading}
      <div class="flex justify-center py-12">
          <div class="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-[var(--brand-green)]"></div>
      </div>
  {:else if !isAuthenticated && !notes.length}
      <div class="bg-[var(--bg-secondary)] rounded-lg p-8 text-center border border-[var(--border-color)]">
          <svg class="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
          </svg>
          <h3 class="text-lg font-medium text-[var(--text-primary)]">Please log in to see your notes</h3>
          <p class="mt-2 text-gray-500 dark:text-gray-400">
            You can create notes without logging in, but they won't be saved for later.
          </p>
          <a href="/login" class="mt-4 inline-block px-4 py-2 bg-[var(--brand-green)] text-white rounded-md hover:bg-opacity-90">
            Log in now
          </a>
      </div>
  {:else if notes.length === 0}
      <div class="bg-[var(--bg-secondary)] rounded-lg p-8 text-center border border-[var(--border-color)]">
          <svg class="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
          <h3 class="text-lg font-medium text-[var(--text-primary)]">
              {searchQuery ? 'No matching notes found' : 'No notes yet'}
          </h3>
          <p class="mt-2 text-gray-500 dark:text-gray-400">
              {searchQuery ? 'Try adjusting your search query' : 'Create your first note to get started'}
          </p>
      </div>
  {:else}
      <div class="space-y-3">
          {#each notes as note (note.id)}
              <div
                  on:click={() => handleNoteClick(note)}
                  class="flex items-stretch bg-[var(--border-color)] rounded-lg border-[var(--border-color)]  hover:scale-102 transition-transform duration-400 cursor-pointer shadow-sm hover:shadow"
                  transition:fade={{ duration: 150 }}
              >
                <!-- Attached Node Status -->
                <div 
                class="w-16 flex-shrink-0 {note.attachedNodes?.length ? 'bg-[var(--brand-green-accent)]' : 'bg-[var(--bg-secondary)]'} 
                flex flex-col items-center justify-center p-2 border-r border-[var(--border-color)] rounded-lg"
              >
                {#if note.attachedNodes?.length > 0}
                    <div class="h-8 w-8 rounded-full bg-[var(--node-icon-bg)] flex items-center justify-center mb-1">
                    <svg class="w-4 h-4 text-[var(--text-accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
                    </svg>
                    </div>
                    <span class="text-xs text-center font-medium text-[var(--text-accent)]">
                    {note.attachedNodes.length} {note.attachedNodes.length === 1 ? 'node' : 'nodes'}
                    </span>
                {:else}
                    <div class="h-8 w-8 rounded-full bg-transparent flex items-center justify-center mb-1">
                    <svg class="w-4 h-4 text-[var(--text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
                    </svg>
                    </div>
                    <span class="text-xs text-center font-medium text-[var(--text-secondary)]">No nodes</span>
                {/if}
                </div>

                <!-- Note Content -->
                <div class="flex-1 p-4">
                <h3 class="text-lg font-medium text-[var(--text-primary)]">{note.title || 'Untitled Note'}</h3>
                
                {#if note.content}
                    <p class="text-[var(--text-secondary)] text-sm mt-1 opacity-70 line-clamp-1">
                    {note.content.replace(/<[^>]*>?/gm, '')}
                    </p>
                {/if}
                
                <div class="flex mt-2 text-xs text-[var(--text-secondary)] space-x-4">
                    <span class="flex items-center">
                    <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                    </svg>
                    Created: {new Date(note.created_at).toLocaleDateString()}
                    </span>
                    {#if note.updated_at !== note.created_at}
                    <span class="flex items-center">
                        <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                        Modified: {new Date(note.updated_at).toLocaleDateString()}
                    </span>
                    {/if}
                </div>

                <!-- Attached Nodes Pills -->
                {#if note.attachedNodes?.length > 0}
                    <div class="flex flex-wrap gap-1 mt-3">
                    {#each note.attachedNodes as node, i}
                        {#if i < 3}
                        <span class="px-2 py-0.5 bg-[var(--pill-bg)] text-[var(--text-accent)] rounded-full text-xs">
                            @{node.title}
                        </span>
                        {:else if i === 3}
                        <span class="px-2 py-0.5 bg-[var(--pill-bg)] text-[var(--text-secondary)] rounded-full text-xs">
                            +{note.attachedNodes.length - 3} more
                        </span>
                        {/if}
                    {/each}
                    </div>
                {/if}
                </div>

                  <!-- Settings Menu -->
                  <div class="w-10 flex-shrink-0 flex items-center justify-center relative border-l border-[var(--bg-secondary)]">
                      <button 
                                    on:click={(e) => toggleSettings(note.id, e)}
                                    class="p-2 rounded-full hover:bg-[var(--bg-secondary)] transition-all duration-500 focus:outline-none"
                      >
                          <svg class="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"/>
                          </svg>
                      </button>
                      
                      {#if activeSettingsNote === note.id}
                          <div 
                              transition:fly={{ y: -5, duration: 150 }}
                              class="absolute right-0 top-10 w-48 bg-[var(--bg-secondary)] transition-all rounded-md shadow-lg z-10 border border-[var(--border-color)] py-1"
                          >
                              <button 
                                on:click={(e) => downloadNote(note, e)}
                                class="w-full px-4 py-2 text-left text-sm  flex items-center transform transition-transform duration-200 hover:scale-105"
                              >
                                  <svg class="w-4 h-4 mr-2 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                                  </svg>
                                  Download Note
                              </button>
                              <button 
                                  on:click={(e) => deleteNote(note.id, e)}
                                  class="w-full px-4 py-2 text-left text-sm  text-red-600 dark:text-red-400 flex items-center transform transition-transform duration-200 hover:scale-105"
                              >
                                  <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                                  </svg>
                                  Delete Note
                              </button>
                          </div>
                      {/if}
                  </div>
              </div>
          {/each}
      </div>
  {/if}
</div>

  <style>
    .line-clamp-1 {
        display: -webkit-box;
        -webkit-line-clamp: 1;
        line-clamp: 1;
        -webkit-box-orient: vertical;

    }
  </style>