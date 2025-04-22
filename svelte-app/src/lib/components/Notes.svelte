<script lang="ts">
    import { page } from '$app/stores';
    import { onMount, onDestroy } from 'svelte';
    import { supabase } from '$lib/supabaseClient';
    import { user } from '$lib/stores/userStore';
    import { sidebarCollapsed } from '$lib/stores/uiStore';
    import { fly } from 'svelte/transition';
    import { noteStore, } from '$lib/stores/noteStore';
    import type { Node } from '$lib/types/nodes';
    import ErrorBoundary from './ErrorBoundary.svelte';

  
    onDestroy(() => {
    if (editorInstance) {
      editorInstance.destroy();
      editorInstance = null;
    }
    // Add this cleanup
    // Define handleClickOutside if needed
    function handleClickOutside(event: MouseEvent) {
        // Add logic to handle click outside
    }

    // Define handleTitleKeydown if needed
    function handleTitleKeydown(event: KeyboardEvent) {
        // Add logic to handle title keydown
    }

    window.removeEventListener('click', handleClickOutside);
    window.removeEventListener('keydown', handleTitleKeydown);
  });

    let userId = $user?.id;
    // Note data structure interface
    interface Note {
  id: string;
  title: string;
  content: string;
  node_id?: string; 
  created_at: string;
  updated_at: string;
  tags: string[];
  user_id?: string;
  ts_vector?: string;
  attachedNodes?: any[]; // Add this line with the correct type
  nodes?: Partial<Node>[];
}
  
    // Editor state
    let notes: Note[] = [];
    let currentNote: Note | null = null;
    let searchQuery = '';
    let filteredNotes: Note[] = [];
    let isCreatingNew = false;
    let isSaving = false;
    let editorInitialized = false;
    let editorInstance: any;
    let showAttachModal = false;
    let availableNodes: any[] = [];
    let newTagInput = '';
    let searchTimeout: NodeJS.Timeout;

    
  
  async function handleSearchInput(e: Event) {
    const query = (e.target as HTMLInputElement).value;
    searchQuery = query;
    
    // Debounce search requests
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
      if (query.length > 2) {
        notes = await noteStore.searchNotes(query);
      } else {
        await loadNotes();
      }
    }, 300);
  }
    // Load notes when component mounts and user is available
    onMount(async () => {
      if ($user?.id) {
        await Promise.all([loadNotes(), loadAvailableNodes()]);
        initEditor();
      }
    });
  
    onDestroy(() => {
      if (editorInstance) {
        editorInstance.destroy();
        editorInstance = null;
      }
    });
  
    // Filter notes based on search query
  $: filteredNotes = searchQuery ? notes.filter(note => 
      (note.title?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (note.content?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (note.tags || []).some(tag => 
        tag.toLowerCase().includes(searchQuery.toLowerCase())
      )
    ) : notes;
  
    // Load notes from database
    async function loadNotes() {
    try {
      if ($user?.id) {
        notes = await noteStore.loadNotes();
      }
    } catch (err) {
      console.error('Failed to load notes:', err);
      notes = []; // Reset to empty array
    }
    filteredNotes = [...notes];
  }
  
    // Load available nodes for attachment
    async function loadAvailableNodes() {
    try {
      // Replace with your actual node loading logic
      availableNodes = []; 
    } catch (err) {
      console.error('Error loading nodes:', err);
    }
  }
  
    // Initialize the rich text editor
    function initEditor() {
      if (typeof window !== 'undefined' && !editorInitialized) {
        // This would be where we initialize a rich text editor like Quill
        // For this implementation, we're just setting a flag
        editorInitialized = true;
        // Mock editor instance - in real implementation this would be the actual editor
        editorInstance = {
          getContents: () => currentNote?.content || '',
          setContents: (content: string) => {
            if (currentNote) currentNote.content = content;
          },
          destroy: () => {
            // Cleanup code would go here
          },
        };
      }
    }
  
    // Create a new note
    async function createNewNote() {
    try {
      const newNote = await noteStore.createNewNote();
      currentNote = newNote;
      isCreatingNew = true;
    } catch (err) {
      console.error('Create failed:', err);
    }
  }
  
    // Select a note to edit
    function selectNote(note: Note) {
      currentNote = { ...note };
      isCreatingNew = false;
      // If editor is initialized, set its contents
      if (editorInstance) {
        setTimeout(() => {
          if (currentNote) {
            editorInstance.setContents(currentNote.content);
          }
        }, 10);
      }
    }
  
    // Save the current note
    async function saveNote() {
    if (!currentNote) return;
    
    try {
      if (editorInstance) {
        currentNote.content = editorInstance.getContents();
      }
      
      const savedNote = await noteStore.saveNote(currentNote);
      currentNote = savedNote;
      await loadNotes();
      isCreatingNew = false;
    } catch (err) {
      console.error('Save failed:', err);
    }
  }
  
    // Delete the current note
    async function deleteNote() {
      if (!currentNote) return;
      if (!confirm('Are you sure you want to delete this note?')) return;
      try {
        const { error } = await supabase
          .from('notes')
          .delete()
          .eq('id', currentNote.id);
        if (error) throw error;
        // Refresh notes list and clear current note
        await loadNotes();
        currentNote = null;
      } catch (err) {
        console.error('Error deleting note:', err);
      }
    }
  
    // Show the modal to attach note to a node
    function showAttachToNodeModal() {
      showAttachModal = true;
    }
  
    // Attach current note to a node
    async function attachToNode(nodeId: string) {
    if (!currentNote?.id) return;
    await noteStore.attachNode(currentNote.id, nodeId);
    showAttachModal = false;
  }
  
    // Add a tag to the current note
    function addTag(tag: string) {
      if (!currentNote || !tag) return;
      if (!currentNote.tags.includes(tag)) {
        currentNote.tags = [...currentNote.tags, tag];
      }
      newTagInput = '';
    }
  
    // Handle keydown for tag input
    function handleTagInputKeydown(event: KeyboardEvent) {
      if (event.key === 'Enter' && newTagInput) {
        addTag(newTagInput);
      }
    }
  
    // Remove a tag from the current note
    function removeTag(tag: string) {
      if (!currentNote) return;
      currentNote.tags = currentNote.tags.filter((t) => t !== tag);
    }
  
    // Insert a table into the editor
    function insertTable() {
      // This would insert a table structure into the editor
      // Implementation depends on the specific editor library used
      alert('Table insertion would be implemented here');
    }
  
    // Insert a chart into the editor
    function insertChart() {
      // This would open a chart creation interface
      alert('Chart insertion would be implemented here');
    }
  
    // Insert a kanban board into the editor
    function insertKanban() {
      // This would insert a kanban board structure
      alert('Kanban board insertion would be implemented here');
    }
  
    // Open drawing tool
    function openDrawingTool() {
      // This would open a drawing interface
      alert('Drawing tool would be implemented here');
    }

    $: console.log('Current notes:', notes);
    $: console.log('Filtered notes:', filteredNotes);
  </script>
  
  <!-- Notes sidebar -->
  <div class="w-64 border-r border-[var(--border-color)] overflow-y-auto">
    <div class="p-4 border-b border-[var(--border-color)]">
      <h2 class="text-xl font-semibold mb-2">Notes</h2>
      <!-- Search bar -->
      <div class="relative">
        <input
        type="text"
        placeholder="Search notes..."
        class="w-full py-2 px-3 pr-8 bg-[var(--bg-secondary)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-md"
        on:input={handleSearchInput}
        bind:value={searchQuery}
      />
        <svg
          class="absolute right-3 top-2.5 w-5 h-5 text-[var(--text-secondary)]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>
      <!-- Create new note button -->
      <button
        on:click={createNewNote}
        class="mt-4 w-full py-2 px-4 bg-[var(--brand-green)] text-white rounded-md hover:bg-opacity-90 transition-colors flex items-center justify-center"
      >
        <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 4v16m8-8H4"
          />
        </svg>
        New Note
      </button>
    </div>
    <!-- Notes list -->
    <div class="p-2">
      {#if filteredNotes.length === 0}
        <p class="text-center text-[var(--text-secondary)] py-4">No notes found</p>
      {:else}
        {#each filteredNotes as note}
          <button
            on:click={() => selectNote(note)}
            class="w-full text-left p-3 mb-2 rounded-md hover:bg-[var(--bg-secondary)] transition-colors {currentNote?.id === note.id ? 'bg-[var(--bg-secondary)]' : ''}"
          >
            <h3 class="font-medium truncate">{note.title}</h3>
            <p class="text-sm text-[var(--text-secondary)] truncate">
              {new Date(note.updated_at).toLocaleDateString()}
            </p>
            {#if note.node_id}
              <div class="mt-1 flex items-center">
                <span class="text-xs px-2 py-0.5 bg-[var(--brand-green-light)] text-white rounded-full">
                  Attached
                </span>
              </div>
            {/if}
            {#if note.tags.length > 0}
              <div class="mt-1 flex flex-wrap gap-1">
                {#each note.tags.slice(0, 2) as tag}
                  <span class="text-xs px-1.5 py-0.5 bg-[var(--bg-primary)] text-[var(--text-secondary)] rounded-full">
                    #{tag}
                  </span>
                {/each}
                {#if note.tags.length > 2}
                  <span class="text-xs text-[var(--text-secondary)]">+{note.tags.length - 2}</span>
                {/if}
              </div>
            {/if}
          </button>
        {/each}
      {/if}
    </div>
  </div>
<ErrorBoundary> 
  <!-- Main content area -->
  <div class="flex-1 flex flex-col h-full overflow-hidden">
    {#if currentNote}
      <!-- Editor toolbar -->
      <div class="p-2 border-b border-[var(--border-color)] bg-[var(--bg-secondary)]">
        <div class="flex items-center space-x-2">
          <!-- Title input -->
          <input
            type="text"
            bind:value={currentNote.title}
            placeholder="Note title"
            class="flex-1 py-1.5 px-3 bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-md"
          />
          <!-- Save button -->
          <button
            on:click={saveNote}
            disabled={isSaving}
            class="py-1.5 px-3 bg-[var(--brand-green)] text-white rounded-md hover:bg-opacity-90 transition-colors flex items-center"
          >
            <svg class="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M5 13l4 4L19 7"
              />
            </svg>
            {isSaving ? 'Saving...' : 'Save'}
          </button>
          <!-- Attach to node button -->
          <button
            on:click={showAttachToNodeModal}
            class="py-1.5 px-3 bg-[var(--bg-secondary)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-md hover:bg-[var(--bg-primary)] transition-colors flex items-center"
          >
            <svg class="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101"
              />
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M10.172 13.828a4 4 0 005.656 0l4-4a4 4 0 10-5.656-5.656l-1.102 1.101"
              />
            </svg>
            {currentNote.node_id ? 'Attached' : 'Attach'}
          </button>
          <!-- Delete button -->
          <button
            on:click={deleteNote}
            class="py-1.5 px-3 bg-[var(--error)] text-white rounded-md hover:bg-opacity-90 transition-colors flex items-center"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        </div>
        <!-- Rich text editor toolbar -->
        <div class="flex flex-wrap items-center gap-2 mt-2 border border-[var(--border-color)] rounded-md p-1.5 bg-[var(--bg-primary)]">
          <!-- Text formatting -->
          <div class="flex items-center space-x-1">
            <button class="p-1 rounded hover:bg-[var(--bg-secondary)]">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 12h12M6 18h12M6 6h12"
                />
              </svg>
            </button>
            <button class="p-1 rounded hover:bg-[var(--bg-secondary)]">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </button>
            <span class="h-5 border-r border-[var(--border-color)]"></span>
          </div>
          <!-- Text style -->
          <div class="flex items-center space-x-1">
            <button class="p-1 rounded hover:bg-[var(--bg-secondary)]">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M4 6h16M4 12h16M4 18h7"
                />
              </svg>
            </button>
            <button class="p-1 rounded hover:bg-[var(--bg-secondary)] font-bold">B</button>
            <button class="p-1 rounded hover:bg-[var(--bg-secondary)] italic">I</button>
            <button class="p-1 rounded hover:bg-[var(--bg-secondary)] underline">U</button>
            <span class="h-5 border-r border-[var(--border-color)]"></span>
          </div>
          <!-- Advanced features -->
          <div class="flex items-center space-x-1">
            <button on:click={insertTable} class="p-1 rounded hover:bg-[var(--bg-secondary)]">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M3 10h18M3 14h18M3 6h18M3 18h18M8 6v12M16 6v12"
                />
              </svg>
            </button>
            <button on:click={insertChart} class="p-1 rounded hover:bg-[var(--bg-secondary)]">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M8 13v-1m4 1v-3m4 3V8M8 21l4-4 4 4M3 4h18M4 4v16h16V4H4z"
                />
              </svg>
            </button>
            <button on:click={insertKanban} class="p-1 rounded hover:bg-[var(--bg-secondary)]">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
                />
              </svg>
            </button>
            <button on:click={openDrawingTool} class="p-1 rounded hover:bg-[var(--bg-secondary)]">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                />
              </svg>
            </button>
          </div>
        </div>
        <!-- Tags section -->
        <div class="flex flex-wrap items-center mt-2 gap-2">
          <span class="text-sm text-[var(--text-secondary)]">Tags:</span>
          {#each currentNote.tags as tag}
            <div class="flex items-center bg-[var(--bg-secondary)] text-[var(--text-primary)] px-2 py-1 rounded-full text-sm">
              #{tag}
              <button on:click={() => removeTag(tag)} class="ml-1 text-[var(--text-secondary)] hover:text-[var(--error)]">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          {/each}
          <!-- Add tag input -->
          <div class="relative">
            <input
              type="text"
              bind:value={newTagInput}
              placeholder="Add tag..."
              class="py-1 px-2 bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-full text-sm"
              on:keydown={handleTagInputKeydown}
            />
          </div>
        </div>
      </div>
      <!-- Editor content area -->
      <div class="flex-1 p-4 overflow-y-auto">
        <!-- This would be replaced with an actual rich text editor component -->
        <div class="min-h-full border border-[var(--border-color)] rounded-md p-4 bg-[var(--bg-primary)]">
          <!-- Placeholder for rich text editor -->
          <textarea
            bind:value={currentNote.content}
            placeholder="Start typing your note here..."
            class="w-full h-full min-h-[500px] bg-transparent text-[var(--text-primary)] focus:outline-none resize-none"
          ></textarea>
        </div>
      </div>
    {:else}
      <!-- Empty state -->
      <div class="flex-1 flex flex-col items-center justify-center text-[var(--text-secondary)]">
        <svg class="w-16 h-16 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1"
            d="M9 12h6m-6 4h6m-6-8h6m-6-4h6M5 8h.01M5 12h.01M5 16h.01M5 20h.01M5 4a1 1 0 110-2 1 1 0 010 2zM19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v12a2 2 0 01-2 2z"
          />
        </svg>
        <h3 class="text-xl font-medium mb-2">No Note Selected</h3>
        <p class="text-center max-w-md mb-4">
          Create a new note or select an existing one from the sidebar.
        </p>
        <button on:click={createNewNote} class="py-2 px-4 bg-[var(--brand-green)] text-white rounded-md hover:bg-opacity-90 transition-colors">
          Create New Note
        </button>
      </div>
    {/if}
  </div>
  
  <!-- Attach to node modal -->
  {#if showAttachModal}
    <div transition:fly={{ y: 20, duration: 1500 }} class="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50">
      <div class="bg-[var(--bg-secondary)] p-4 rounded-lg shadow-lg max-w-md w-full">
        <h3 class="text-lg font-semibold mb-4">Attach Note to Node</h3>
        <input
          type="text"
          placeholder="Search nodes..."
          class="w-full mb-4 py-2 px-3 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-md"
        />
        <div class="space-y-2 max-h-[50vh] overflow-y-auto">
          {#if availableNodes.length === 0}
            <p class="text-center text-[var(--text-secondary)] py-4">No nodes available</p>
          {:else}
          {#each availableNodes as node (node.id)}
            <button
              on:click={() => attachToNode(node.id)}
              class="w-full text-left p-3 rounded-md hover:bg-[var(--bg-primary)] transition-colors flex items-center"
              aria-label={`Attach to node ${node.title}`}
            >
              <svg class="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <!-- Your icon -->
              </svg>
              {node.title}
            </button>
          {/each}
          {/if}
        </div>
      </div>
    </div>
  {/if}
</ErrorBoundary>

