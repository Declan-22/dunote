<script>
    import { onMount, tick } from 'svelte';
    import { fade, fly } from 'svelte/transition';
    import { flip } from 'svelte/animate';
    import { spring } from 'svelte/motion';
    import { X, Tag } from 'lucide-svelte';
  
    export let currentNote = { tags: [] };
    export let showTagModal = true;
    export let onTagsUpdated = () => {}; // Callback when tags change
    
    let newTag = '';
    let allTags = []; // Tags memory - could be loaded from Supabase
    let inputTags = []; // Current tags in input area
    let tagMemoryEl;
    let tagInputEl;
    let draggedTag = null;
    let dragSource = null;
  
    // Load previously used tags - replace with Supabase fetch if needed
    onMount(async () => {
      // Example tags - replace with data from Supabase if needed
      allTags = ['research', 'ideas', 'important', 'work', 'personal', 'todo', 'follow-up'];
      
      // Initialize with current note tags
      inputTags = [...currentNote.tags];
      
      // Remove duplicates from all tags (tags that are already in inputTags)
      allTags = allTags.filter(tag => !inputTags.includes(tag));
    });
  
    function addTag() {
      if (!newTag.trim()) return;
      
      const tag = newTag.trim().toLowerCase();
      
      if (!inputTags.includes(tag)) {
        inputTags = [...inputTags, tag];
        
        // If this tag was in memory, remove it
        if (allTags.includes(tag)) {
          allTags = allTags.filter(t => t !== tag);
        }
        
        updateNoteTags();
      }
      
      newTag = '';
    }
  
    function removeTag(tag) {
      inputTags = inputTags.filter(t => t !== tag);
      
      // Add back to memory if not already there
      if (!allTags.includes(tag)) {
        allTags = [...allTags, tag];
      }
      
      updateNoteTags();
    }
  
    function updateNoteTags() {
      currentNote.tags = [...inputTags];
      onTagsUpdated(currentNote.tags);
    }
  
    function handleDragStart(event, tag, source) {
      draggedTag = tag;
      dragSource = source;
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', tag);
      
      // Set the drag image to be the element itself
      const elem = event.target;
      event.dataTransfer.setDragImage(elem, 10, 10);
    }
  
    function handleDragEnd() {
      draggedTag = null;
      dragSource = null;
    }
  
    function handleDragOver(event, target) {
      event.preventDefault();
      if (draggedTag && dragSource !== target) {
        event.dataTransfer.dropEffect = 'move';
      }
    }
  
    function handleDrop(event, target) {
      event.preventDefault();
      
      if (!draggedTag || dragSource === target) return;
      
      if (dragSource === 'memory' && target === 'input') {
        // Move from memory to input
        if (!inputTags.includes(draggedTag)) {
          inputTags = [...inputTags, draggedTag];
          allTags = allTags.filter(t => t !== draggedTag);
          updateNoteTags();
        }
      } else if (dragSource === 'input' && target === 'memory') {
        // Move from input to memory
        inputTags = inputTags.filter(t => t !== draggedTag);
        if (!allTags.includes(draggedTag)) {
          allTags = [...allTags, draggedTag];
        }
        updateNoteTags();
      }
      
      draggedTag = null;
      dragSource = null;
    }
  
    async function closeModal() {
      showTagModal = false;
    }
  </script>
  
  <div 
    class="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50"
    transition:fade={{ duration: 150 }}
    on:click|self={closeModal}
  >
    <div 
      class="bg-[var(--bg-secondary)] rounded-lg shadow-xl max-w-md w-full p-6"
      transition:fly={{ y: 20, duration: 200 }}
    >
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-lg font-medium text-[var(--text-primary)]">Manage Tags</h3>
        <button on:click={closeModal} class="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
          <X size={20} />
        </button>
      </div>
  
      <div class="flex mb-4">
        <input 
          type="text" 
          bind:value={newTag}
          placeholder="Add a tag..." 
          class="flex-1 px-3 py-2 bg-[var(--bg-accent)] text-[var(--text-primary)] rounded-l-md border border-[var(--border-color)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-accent)]"
          on:keydown={(e) => e.key === 'Enter' && addTag()}
        />
        <button 
          on:click={addTag}
          class="px-3 py-2 bg-[var(--button-bg)] text-[var(--button-text)] rounded-r-md hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--brand-accent)] focus:ring-offset-2"
        >
          Add
        </button>
      </div>
  
      <!-- Current Tags Input Area -->
      <div class="mb-6">
        <label class="block text-sm font-medium text-[var(--text-secondary)] mb-2">Current Tags</label>
        <div 
          bind:this={tagInputEl}
          class="min-h-12 p-2 bg-[var(--bg-accent)] border border-[var(--border-color)] rounded-md flex flex-wrap gap-2"
          on:dragover={(e) => handleDragOver(e, 'input')}
          on:drop={(e) => handleDrop(e, 'input')}
        >
          {#if inputTags.length === 0}
            <p class="text-[var(--text-secondary)] text-sm p-1">Drag tags here or add new ones above</p>
          {:else}
            {#each inputTags as tag (tag)}
              <div 
                class="bg-[var(--brand-accent-muted)] text-[var(--button-text)] px-2 py-1 rounded-md text-sm flex items-center"
                draggable="true"
                on:dragstart={(e) => handleDragStart(e, tag, 'input')}
                on:dragend={handleDragEnd}
                animate:flip={{ duration: 300 }}
                transition:fly={{ y: 5, duration: 200 }}
              >
                <span class="mr-1">#{tag}</span>
                <button 
                  on:click={() => removeTag(tag)} 
                  class="text-[var(--button-text)] hover:text-[var(--error)] opacity-75 hover:opacity-100"
                >
                  <X size={14} />
                </button>
              </div>
            {/each}
          {/if}
        </div>
      </div>
  
      <!-- Tag Memory Area -->
      <div class="mb-6">
        <label class="block text-sm font-medium text-[var(--text-secondary)] mb-2">Tag Memory</label>
        <div 
          bind:this={tagMemoryEl}
          class="min-h-20 max-h-40 overflow-y-auto p-2 bg-[var(--bg-accenttwo)] border border-[var(--border-color)] rounded-md flex flex-wrap gap-2"
          on:dragover={(e) => handleDragOver(e, 'memory')}
          on:drop={(e) => handleDrop(e, 'memory')}
        >
          {#if allTags.length === 0}
            <p class="text-[var(--text-secondary)] text-sm p-1">No tags in memory</p>
          {:else}
            {#each allTags as tag (tag)}
              <div 
                class="bg-[var(--pill-bg)] text-[var(--text-accent)] px-2 py-1 rounded-md text-sm flex items-center cursor-grab"
                draggable="true"
                on:dragstart={(e) => handleDragStart(e, tag, 'memory')}
                on:dragend={handleDragEnd}
                animate:flip={{ duration: 300 }}
                transition:fly={{ y: 5, duration: 200 }}
              >
                <span>#{tag}</span>
              </div>
            {/each}
          {/if}
        </div>
        <p class="text-xs text-[var(--text-secondary)] mt-1">Drag tags between sections</p>
      </div>
  
      <div class="flex justify-end">
        <button 
          on:click={closeModal}
          class="px-4 py-2 bg-[var(--button-bg)] text-[var(--button-text)] rounded-md hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--brand-accent)] focus:ring-offset-2"
        >
          Done
        </button>
      </div>
    </div>
  </div>