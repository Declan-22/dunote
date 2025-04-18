<script lang="ts">
    import { page } from '$app/stores';
    import { noteStore } from '$lib/stores/noteStore';
    import { onMount, onDestroy } from 'svelte';
    import { fly, slide, fade } from 'svelte/transition';
    import { quintOut } from 'svelte/easing';
    import { user } from '$lib/stores/userStore';
    import { supabase } from '$lib/supabaseClient';
    import { Drawflow } from 'drawflow';
    import NotesList from '$lib/components/NotesList.svelte';


      // TipTap imports
    import { Editor } from '@tiptap/core';
    import StarterKit from '@tiptap/starter-kit';
    import Placeholder from '@tiptap/extension-placeholder';
    import TaskList from '@tiptap/extension-task-list';
    import TaskItem from '@tiptap/extension-task-item';
    import Highlight from '@tiptap/extension-highlight';
    import Link from '@tiptap/extension-link';
    import Image from '@tiptap/extension-image';
    import Underline from '@tiptap/extension-underline';
    import Table from '@tiptap/extension-table'
    import TableRow from '@tiptap/extension-table-row'
    import TableCell from '@tiptap/extension-table-cell'
    import TableHeader from '@tiptap/extension-table-header'
    import TextStyle from '@tiptap/extension-text-style'


    type FontSize = 'small' | 'normal' | 'large' | 'huge';
    type Node = { id: string; title: string };
    type SavedTimeout = ReturnType<typeof setTimeout>;
    
    // Icons - import from a common icon library like lucide-icons
    import { 
      Bold, Italic, Strikethrough, 
      List, ListOrdered, CheckSquare, Link as LinkIcon, 
      Image as ImageIcon, AlignLeft, AlignCenter, AlignRight,
      ChevronDown, X, Hash, PlusCircle, Code, Quote, Type,
      Paperclip, Tag as TagIcon
    } from 'lucide-svelte';


  interface Note {
      id: string;
      title: string;
      content: string;
      tags: string[];
      created_at: string;
      updated_at: string;
      user_id: string;
      attachedNodes: Array<{ id: string; title: string }>;
      node_id?: string;
      ts_vector?: string;
  }
  

    let isLoading = true;
    let showAttachModal = false;
    let showTagModal = false;
    let availableNodes: Array<{ id: string; title: string }> = [];
    let newTag = '';
    let isSaving = false;
    let lastSavedTime = '';
    let editor: Editor;
    let currentNote: Note = {
      id: '',
      title: '',
      content: '',
      tags: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      attachedNodes: []
    };
    let canvas: HTMLCanvasElement | null = null;

    let showToolbar = true;
    let toolbarPosition = { top: 0, left: 0 };
    let fontSizeOptions = ['small', 'normal', 'large', 'huge'];
    let currentFontSize = 'normal';
    let toolbarExpanded = false;
    let searchTerm = '';
    let isSearching = false;
    let searchResults = [];
    let savedTimeout: SavedTimeout;

  
    onMount(async () => {
    const noteId = $page.params.id;
    if (noteId && noteId !== 'new') {
      currentNote = await noteStore.getNoteById(noteId);
    } else {
      currentNote = await noteStore.createNewNote();
    }
    
    // Initialize editor with currentNote content
    editor = new Editor({
      element: document.querySelector('#editor'),
      extensions: [StarterKit, /* other extensions */],
      content: currentNote.content,
      onUpdate: () => autoSave()
    });
    
    isLoading = false;


      // Load available nodes for attachment
    loadAvailableNodes();
    
    // Load existing note or create new one
    const url = new URL(window.location.href);

    
    if (noteId) {
      (async () => {
        await loadNote(noteId);
      })();
    } else {
      // Create new note properly
      currentNote = {
        id: '',
        title: '',
        content: '',
        tags: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        attachedNodes: []
      };
    }
  });
  
  onDestroy(() => {
    if (editor) {
      editor.destroy();
    }
  });


  function handleDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (toolbarExpanded && !target.closest('.toolbar')) {
      toolbarExpanded = false;
    }
  }

  function insertTable() {
  editor.chain().focus().insertTable({
    rows: 3,
    cols: 3,
    withHeaderRow: true
  }).run();
}

  function toggleHeading(level: number) {
    editor.chain().focus().toggleHeading({ level: level as 1 | 2 | 3 | 4 | 5 | 6 }).run();
  }

  
  async function loadAvailableNodes() {
  try {
    const { data, error } = await supabase
      .from('nodes')
      .select('id, title')
      .eq('user_id', $user?.id)  // Add this filter
      .order('title');
      
    if (error) throw error;
    availableNodes = data;
    console.log('Available nodes:', availableNodes);  // Debug log
  } catch (error) {
    console.error('Error loading nodes:', error);
  }
}
  
    async function loadNote(id: string) {
      try {
          const { data, error } = await supabase
              .from('notes')
              .select('*, attachedNodes:note_nodes(nodes(id, title))')
              .eq('id', id)
              .single();

          if (error) throw error;
          
          currentNote = {
              ...data,
              attachedNodes: data.attachedNodes.map((an: any) => an.nodes)
          };
          
          if (editor) {
              editor.commands.setContent(currentNote.content);
          }
      } catch (error) {
          console.error('Error loading note:', error);
      }
  }
  
  function autoSave() {
    // Clear previous timeout
    if (savedTimeout) clearTimeout(savedTimeout);
    
    isSaving = true;
    
    // Set new timeout
    savedTimeout = setTimeout(async () => {
      try {
        currentNote.updated_at = new Date().toISOString();
        
        if (!currentNote.id) {
          // Create new note
          const { data, error } = await supabase
            .from('notes')
            .insert([currentNote])
            .select()
            .single();
            
          if (error) throw error;
          
          currentNote.id = data.id;
          
          // Update URL without page reload
          const url = new URL(window.location.href);
          url.searchParams.set('id', currentNote.id);
          window.history.pushState({}, '', url);
        } else {
          // Update existing note
          const { error } = await supabase
            .from('notes')
            .update(currentNote)
            .eq('id', currentNote.id);
            
          if (error) throw error;
        }
        
        // Update last saved time
        const now = new Date();
        lastSavedTime = now.toLocaleTimeString();
        
        // Update note store
        noteStore.update(notes => {
          const index = notes.findIndex(n => n.id === currentNote.id);
          if (index >= 0) {
            notes[index] = currentNote;
          } else {
            notes.push(currentNote);
          }
          return notes;
        });
        
        isSaving = false;
      } catch (error) {
        console.error('Error saving note:', error);
        isSaving = false;
      }
    }, 1000);
  }
  
  function toggleBold() {
    editor.chain().focus().toggleBold().run();
  }
  
  function toggleItalic() {
    editor.chain().focus().toggleItalic().run();
  }
  
  function toggleUnderline() {
    editor.chain().focus().toggleUnderline().run();
  }
  
  function toggleStrike() {
    editor.chain().focus().toggleStrike().run();
  }
  
  function toggleBulletList() {
    editor.chain().focus().toggleBulletList().run();
  }
  
  function toggleOrderedList() {
    editor.chain().focus().toggleOrderedList().run();
  }
  
  function toggleTaskList() {
    editor.chain().focus().toggleTaskList().run();
  }
  
  function setFontSize(size: FontSize) {
    currentFontSize = size;
    const editorEl = document.querySelector<HTMLElement>('#editor');
    if (editorEl) {
      editorEl.className = `prose ${sizeClasses[size]}`;
    }
  }

  const sizeClasses: Record<FontSize, string> = {
    small: 'prose-sm',
    normal: 'prose-base',
    large: 'prose-lg',
    huge: 'prose-xl'
  };
  
  function toggleLink() {
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('URL', previousUrl);
    
    if (url === null) {
      return;
    }
    
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }
  

  
  function toggleAttachModal() {
    showAttachModal = !showAttachModal;
  }
  
  function toggleTagModal() {
    showTagModal = !showTagModal;
  }
  
  async function attachNode(nodeId: string) {
  try {
    // First ensure note exists in DB
    if (!currentNote.id) {
      const { data: newNote } = await supabase
        .from('notes')
        .insert(currentNote)
        .select()
        .single();
      currentNote.id = newNote.id;
    }

    // Create relationship in note_nodes
    const { error } = await supabase
      .from('note_nodes')
      .insert({
        note_id: currentNote.id,
        node_id: nodeId
      });

    if (!error) {
      // Update local state
      const node = availableNodes.find(n => n.id === nodeId);
      if (node) {
        currentNote.attachedNodes = [...currentNote.attachedNodes, node];
      }
    }
  } catch (err) {
    console.error('Attachment failed:', err);
  }
  showAttachModal = false;
}

  function detachNode(nodeId: string) {
    currentNote.attachedNodes = currentNote.attachedNodes.filter(node => node.id !== nodeId);
    autoSave();
  }
  
  function addTag() {
    if (newTag.trim() && !currentNote.tags.includes(newTag.trim())) {
      currentNote.tags = [...currentNote.tags, newTag.trim()];
      newTag = '';
      autoSave();
    }
  }
  
  function removeTag(tag: string) {
    currentNote.tags = currentNote.tags.filter(t => t !== tag);
    autoSave();
  }
  
  function handleKeydown(event: KeyboardEvent) {
    // Keyboard shortcuts
    if (event.ctrlKey || event.metaKey) {
      switch (event.key) {
        case 'b':
          event.preventDefault();
          toggleBold();
          break;
        case 'i':
          event.preventDefault();
          toggleItalic();
          break;
        case 'u':
          event.preventDefault();
          toggleUnderline();
          break;
      }
    }
  }
  
  function toggleToolbarExpanded() {
    toolbarExpanded = !toolbarExpanded;
  }
  
  function handleTitleInput(event: Event) {
      const inputEvent = event as InputEvent;
      currentNote.title = (inputEvent.target as HTMLInputElement).value;
      autoSave();
  }

  async function insertImage() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
              try {
            const { data, error } = await supabase.storage
              .from('note-images')
              .upload(`${$user?.id}/${file.name}`, file);
            
          if (error) throw error;
          
          const { data: publicUrlData } = supabase.storage
            .from('note-images')
            .getPublicUrl(data.path);
          
          editor.chain().setImage({ src: publicUrlData.publicUrl }).run();
        } catch (e) {
          console.error("Image upload failed");
        }
       }
     };
     input.click();
    }
  </script>

{#if isLoading}
  <div class="loading-wave">
    {#each "Loading..." as char, index (index)}
      <span class="loading-char" style="--i: {index}">{char}</span>
    {/each}
  </div>
{:else if currentNote}
<div class="notes-app h-screen flex flex-col bg-[var(--bg-primary)] text-[var(--text-primary)]">
  <!-- Status bar -->
  <div class="bg-transparent py-2 px-4 flex justify-between items-center border-b border-[var(--border-color)] text-xs">
    <div class="flex items-center space-x-2">

    </div>
    <div class="flex items-center space-x-3">
      {#if isSaving}
        <span transition:fade>Saving...</span>
      {:else if lastSavedTime}
        <span transition:fade>Saved at {lastSavedTime}</span>
      {/if}
      <button 
        on:click={toggleAttachModal} 
        class="flex items-center text-gray-600 dark:text-gray-300 hover:text-blue-500 dark:hover:text-blue-400"
      >
        <Paperclip size={14} class="mr-1" />
        <span>Attach</span>
      </button>
      <button 
        on:click={toggleTagModal} 
        class="flex items-center text-gray-600 dark:text-gray-300 hover:text-blue-500 dark:hover:text-blue-400"
      >
        <TagIcon size={14} class="mr-1" />
        <span>Tags</span>
      </button>
    </div>
  </div>

  <!-- Main content area -->
<div class="flex-1 flex flex-col overflow-hidden">
    <!-- Scroll container with padding -->
  <div class="flex-1 overflow-y-auto scroll-smooth p-8  pb-20">
    
    <!-- Title input -->
    <div class="mb-6 mt-9">
      <input 
        type="text" 
        value={currentNote.title} 
        on:input={handleTitleInput}
        placeholder="Untitled note" 
        class="w-full text-3xl font-bold bg-transparent border-none placeholder:text-[var(--text-secondary)] placeholder:opacity-50 focus:outline-none focus:ring-0"
      />
    </div>
    
    <!-- Tags display -->
    {#if currentNote.tags && currentNote.tags.length > 0}
      <div class="flex flex-wrap gap-2 mb-6" transition:slide>
        {#each currentNote.tags as tag}
          <div class="bg-[var(--brand-green-light)] text-[var(--light-text)] px-2 py-0.5 rounded-md text-sm flex items-center">
            <span class="mr-1">#{tag}</span>
            <button on:click={() => removeTag(tag)} class="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200">
              <X size={14} />
            </button>
          </div>
        {/each}
      </div>
    {/if}
    
    <!-- Attached nodes display -->
    {#if currentNote.attachedNodes && currentNote.attachedNodes.length > 0}
      <div class="mb-6" transition:slide>
        <h3 class="text-sm font-medium text-[var(--text-secondary)] mb-2">Attached nodes:</h3>
        <div class="flex flex-wrap gap-2">
          {#each currentNote.attachedNodes as node}
            <div class="bg-[var(--bg-secondary)] px-3 py-1 rounded-md text-sm flex items-center">
              <span class="mr-1">{node.title}</span>
              <button on:click={() => detachNode(node.id)} class="text-gray-500 hover:text-red-500">
                <X size={14} />
              </button>
            </div>
          {/each}
        </div>
      </div>
    {/if}
    
    <!-- TipTap Editor -->
    <div id="editor" class="prose max-w-none focus:outline-none">
      <input 
        type="text" 
        placeholder="Start writing..." 
        class="w-full text-1xl font-regular bg-transparent border-none placeholder:text-[var(--text-secondary)] placeholder:opacity-50 focus:outline-none focus:ring-0"
      /> 
    </div>
  </div>
  </div>
  
  <!-- Floating Toolbar -->
  <div 
    class="toolbar fixed z-10 bg-[var(--bg-secondary)] rounded-lg shadow-lg border border-[var(--border-color)]"
    class:expanded={toolbarExpanded}
    style="top: 45px; left: 50%; transform: translateX(-50%);"
  >
    <div class="flex items-center px-1">
      <!-- Basic Formatting -->
      <div class="flex">
        <button 
          on:click={toggleBold} 
          class="toolbar-btn" 
          class:active={editor?.isActive('bold')}
          title="Bold (Ctrl+B)"
        >
          <Bold size={18} />
        </button>
        
        <button 
          on:click={toggleItalic} 
          class="toolbar-btn" 
          class:active={editor?.isActive('italic')}
          title="Italic (Ctrl+I)"
        >
          <Italic size={18} />
        </button>
        
        <button 
          on:click={toggleUnderline} 
          class="toolbar-btn" 
          class:active={editor?.isActive('underline')}
          title="Underline (Ctrl+U)"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 4v6a6 6 0 0012 0V4m-6 14v2m-7 0h14" />
          </svg>
        </button>
        
        <button 
          on:click={toggleStrike} 
          class="toolbar-btn" 
          class:active={editor?.isActive('strike')}
          title="Strikethrough"
        >
          <Strikethrough size={18} />
        </button>

          <!-- Add table button -->
        <button 
        on:click={insertTable} 
        class="toolbar-btn"
        title="Insert Table">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="M6 5h11a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3M4 17a2 2 0 0 0 2 2h5v-3H4zm7-5H4v3h7zm6 7a2 2 0 0 0 2-2v-1h-7v3zm2-7h-7v3h7zM4 11h7V8H4zm8 0h7V8h-7z"/></svg>
        

      </button>


      </div>
      
      <div class="toolbar-divider"></div>
      
      <!-- Lists -->
      <div class="flex">
        <button 
          on:click={toggleBulletList} 
          class="toolbar-btn" 
          class:active={editor?.isActive('bulletList')}
          title="Bullet List"
        >
          <List size={18} />
        </button>
        
        <button 
          on:click={toggleOrderedList} 
          class="toolbar-btn" 
          class:active={editor?.isActive('orderedList')}
          title="Numbered List"
        >
          <ListOrdered size={18} />
        </button>
        
        <button 
          on:click={toggleTaskList} 
          class="toolbar-btn" 
          class:active={editor?.isActive('taskList')}
          title="Task List"
        >
          <CheckSquare size={18} />
        </button>
      </div>
      
      <div class="toolbar-divider"></div>
      
      <!-- Insert -->
      <div class="flex">
        <button 
          on:click={toggleLink} 
          class="toolbar-btn" 
          class:active={editor?.isActive('link')}
          title="Insert Link"
        >
          <LinkIcon size={18} />
        </button>
        
        <button 
          on:click={insertImage} 
          class="toolbar-btn"
          title="Insert Image"
        >
          <ImageIcon size={18} />
        </button>
      </div>
      
      <div class="toolbar-divider"></div>
      
      <!-- Font size dropdown -->
      <div class="relative group">
        <button class="toolbar-btn flex items-center" title="Text Size">
          <Type size={18} />
          <ChevronDown size={14} class="ml-1" />
        </button>
        
        <div class="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 py-1 invisible group-hover:visible min-w-32">
          {#each fontSizeOptions as size (size)}
            <button 
              on:click={() => setFontSize(size as FontSize)} 
              class="block w-full text-left px-4 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm"
              class:font-semibold={currentFontSize === size}
            >
              {size.charAt(0).toUpperCase() + size.slice(1)}
            </button>
          {/each}
        </div>
      </div>
      
      <!-- Toggle Expanded Toolbar -->
      <button 
        on:click={toggleToolbarExpanded} 
        class="toolbar-btn ml-2" 
        title="More Options"
      >
        {#if toolbarExpanded}
          <ChevronDown size={18} />
        {:else}
          <ChevronDown size={18} style="transform: rotate(-90deg);" />
        {/if}
      </button>
    </div>
    
    <!-- Expanded Toolbar Options -->
    {#if toolbarExpanded}
      <div 
        class="mt-1 pt-1 border-t border-gray-200 dark:border-gray-700 grid grid-cols-2 gap-1 px-1 pb-1"
        transition:slide={{duration: 150}}
      >
        <!-- Block Formatting -->
        <button 
          on:click={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} 
          class="toolbar-btn" 
          class:active={editor?.isActive('heading', { level: 1 })}
        >
          <span class="text-sm">H1</span>
        </button>
        
        <button 
          on:click={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} 
          class="toolbar-btn" 
          class:active={editor?.isActive('heading', { level: 2 })}
        >
          <span class="text-sm">H2</span>
        </button>
        
        <button 
          on:click={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} 
          class="toolbar-btn" 
          class:active={editor?.isActive('heading', { level: 3 })}
        >
          <span class="text-sm">H3</span>
        </button>
        
        <button 
          on:click={() => editor.chain().focus().toggleCodeBlock().run()} 
          class="toolbar-btn" 
          class:active={editor?.isActive('codeBlock')}
        >
          <Code size={18} />
        </button>
        
        <button 
          on:click={() => editor.chain().focus().toggleBlockquote().run()} 
          class="toolbar-btn" 
          class:active={editor?.isActive('blockquote')}
        >
          <Quote size={18} />
        </button>
        
        <button 
          on:click={() => editor.chain().focus().setHorizontalRule().run()} 
          class="toolbar-btn"
        >
          <span class="text-sm">HR</span>
        </button>
      </div>
    {/if}
  </div>
  
  <!-- Attach Modal -->
  {#if showAttachModal}
    <div 
      class="fixed inset-0  bg-opacity-30 backdrop-blur-sm flex items-center justify-center z-50"
      transition:fade={{ duration: 150 }}
      on:click|self={() => showAttachModal = false}
    >
      <div 
        class="bg-[var(--bg-secondary)] rounded-lg shadow-xl max-w-md w-full p-6"
        transition:fly={{ y: 20, duration: 200 }}
      >
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-lg font-medium">Attach to Node</h3>
          <button on:click={() => showAttachModal = false} class="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
            <X size={20} />
          </button>
        </div>
        
        <input 
          type="text" 
          placeholder="Search nodes..." 
          class="w-full mb-4 px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        
        <div class="max-h-60 overflow-y-auto mb-4">
          {#if availableNodes.length === 0}
            <p class="text-gray-500 dark:text-gray-400 text-center py-4">No nodes available</p>
          {:else}
            <div class="space-y-1">
              {#each availableNodes as node}
                <button 
                  on:click={() => attachNode(node.id)}
                  class="w-full text-left px-3 py-2 rounded-md hover:bg-[var(--bg-primary)] transition-all duration-200"
                  class:bg-[var(--brand-green-light)]={currentNote.attachedNodes?.some(n => n.id === node.id)}
                  
                >
                  {node.title}
                </button>
              {/each}
            </div>
          {/if}
        </div>
        
        <div class="flex justify-end">
          <button 
            on:click={() => showAttachModal = false}
            class="px-4 py-2 bg-[var(--brand-green)] text-white rounded-md hover:bg-[var(--brand-green-dark)] hover:scale-105 transition-all: duration-200 "
          >
            Done
          </button>
        </div>
      </div>
    </div>
  {/if}
  
  <!-- Tags Modal -->
  {#if showTagModal}
    <div 
      class="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50"
      transition:fade={{ duration: 150 }}
      on:click|self={() => showTagModal = false}
    >
      <div 
        class="bg-[var(--bg-secondary)] dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6"
        transition:fly={{ y: 20, duration: 200 }}
      >
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-lg font-medium">Manage Tags</h3>
          <button on:click={() => showTagModal = false} class="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
            <X size={20} />
          </button>
        </div>
        
        <div class="flex mb-4">
          <input 
            type="text" 
            bind:value={newTag}
            placeholder="Add a tag..." 
            class="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            on:keydown={(e) => e.key === 'Enter' && addTag()}
          />
          <button 
            on:click={addTag}
            class="px-3 py-2 bg-blue-600 text-white rounded-r-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Add
          </button>
        </div>
        
        <div class="mb-4">
          {#if currentNote.tags.length === 0}
            <p class="text-gray-500 dark:text-gray-400 text-center py-2">No tags added yet</p>
          {:else}
            <div class="flex flex-wrap gap-2">
              {#each currentNote.tags as tag}
                <div class="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded-md text-sm flex items-center">
                  <span class="mr-1">#{tag}</span>
                  <button on:click={() => removeTag(tag)} class="text-blue-600 dark:text-blue-400 hover:text-red-500">
                    <X size={14} />
                  </button>
                </div>
              {/each}
            </div>
          {/if}
        </div>
        
        <div class="flex justify-end">
          <button 
            on:click={() => showTagModal = false}
            class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>
{:else}
  <div class="text-center p-8">Note not found</div>
{/if}

<style>
  .toolbar-btn {
    padding: 0.5rem;
    border-radius: 0.375rem;
    color: var(--text-primary);
    background-color: transparent;
    transition: background-color var(--transition-fast);
  }
  
  .toolbar-btn:hover {
    background-color: var(--brand-green-light);
  }
  
  .toolbar-btn.active {
    background-color: var(--brand-green);
    color: var(--light-text);
  }

  .toolbar-divider {
    width: 1px;
    height: 1.5rem;
    background-color: var(--border-color);
    margin: 0 0.25rem;
  }

  #editor {
    outline: none;
    border: none;
    padding: 0;
    min-height: calc(100vh - 300px);
    color: var(--text-primary);
  }


  .loading-wave {
    text-align: center;
    display: flex;
    justify-content: center;
    gap: 1px;
    padding: 8px;
    margin-top: 200px;
  }

  .loading-char {
    display: inline-block;
    animation: wave 1.2s ease-in-out infinite;
    animation-delay: calc(0.1s * var(--i));
  }

  @keyframes wave {
    0%, 40%, 100% {
      transform: translateY(0);
    }
    20% {
      transform: translateY(-15px);
    }
  }

      ::-webkit-scrollbar {
      width: 8px;
      height: 8px;
      transition: all 0.3s;
    }

    ::-webkit-scrollbar-track {
      background: var(--bg-secondary);
      border-radius: 4px;
      transition: all 0.3s;
    }

    ::-webkit-scrollbar-thumb {
      background: var(--border-color);
      border-radius: 4px;
      transition: all 0.3s;
    }

    ::-webkit-scrollbar-thumb:hover {
      background: var(--brand-green);
      transition: all 0.3s;
    }
    

  #editor p.is-editor-empty:first-child::before {
    color: var(--text-secondary);
    content: attr(data-placeholder);
    float: left;
    pointer-events: none;
    height: 0;
  }

  #editor h1, #editor h2, #editor h3 {
    color: var(--text-primary);
  }

  #editor blockquote {
    border-left-color: var(--border-color);
    color: var(--text-secondary);
  }

  #editor pre {
    background-color: var(--bg-secondary);
    border: 1px solid var(--border-color);
  }

  .kanban-board {
    margin: 1rem 0;
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    background-color: var(--bg-secondary);
    overflow: hidden;
  }
  
  .kanban-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1rem;
    background-color: var(--bg-primary);
    border-bottom: 1px solid var(--border-color);
  }
  
  .kanban-header h3 {
    margin: 0;
    font-size: 1.1rem;
  }
  
  .kanban-columns {
    display: flex;
    gap: 1rem;
    padding: 1rem;
    overflow-x: auto;
    min-height: 300px;
  }
  
  .kanban-column {
    flex: 0 0 250px;
    display: flex;
    flex-direction: column;
    background-color: var(--bg-primary);
    border-radius: 0.25rem;
    border: 1px solid var(--border-color);
    max-height: 500px;
  }
  
  .kanban-column-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem;
    border-bottom: 1px solid var(--border-color);
  }
  
  .kanban-column-title {
    margin: 0;
    font-size: 1rem;
    font-weight: 500;
  }
  
  .kanban-cards {
    flex: 1;
    overflow-y: auto;
    padding: 0.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .kanban-card {
    background-color: white;
    border-radius: 0.25rem;
    border: 1px solid var(--border-color);
    padding: 0.5rem;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    cursor: grab;
    position: relative;
  }
  
  .kanban-card.dragging {
    opacity: 0.5;
  }
  
  .kanban-card-content {
    min-height: 40px;
  }
  
  .kanban-card-controls {
    display: flex;
    justify-content: flex-end;
    gap: 0.25rem;
    opacity: 0;
    transition: opacity 0.2s;
  }
  
  .kanban-card:hover .kanban-card-controls {
    opacity: 1;
  }
  
  .kanban-delete-column, 
  .kanban-delete-card,
  .kanban-card-color {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1rem;
    padding: 0.25rem;
    border-radius: 0.25rem;
  }
  
  .kanban-delete-column:hover, 
  .kanban-delete-card:hover {
    background-color: var(--error);
    color: white;
  }
  
  .kanban-add-column,
  .kanban-add-card {
    background-color: transparent;
    border: 1px dashed var(--border-color);
    border-radius: 0.25rem;
    padding: 0.5rem;
    margin-top: 0.5rem;
    cursor: pointer;
    color: var(--text-secondary);
    transition: background-color 0.2s;
    width: 100%;
  }
  
  .kanban-add-column:hover,
  .kanban-add-card:hover {
    background-color: var(--bg-primary);
    color: var(--text-primary);
  }
  
  /* Image styles */
  .note-image-container {
    margin: 1rem 0;
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    overflow: hidden;
  }
  
  .note-image-wrapper {
    position: relative;
  }
  
  .note-image {
    max-width: 100%;
    display: block;
  }
  
  .image-controls {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    display: flex;
    gap: 0.5rem;
    opacity: 0;
    transition: opacity 0.2s;
    background-color: rgba(0, 0, 0, 0.5);
    border-radius: 0.25rem;
    padding: 0.25rem;
  }
  
  .note-image-wrapper:hover .image-controls {
    opacity: 1;
  }
  
  .image-comment-toggle,
  .image-fullscreen,
  .image-delete {
    background: none;
    border: none;
    cursor: pointer;
    color: white;
    padding: 0.25rem;
    border-radius: 0.25rem;
  }
  
  .image-comments-section {
    padding: 1rem;
    border-top: 1px solid var(--border-color);
    background-color: var(--bg-secondary);
  }
  
  .comments-list {
    max-height: 300px;
    overflow-y: auto;
    margin-bottom: 1rem;
  }
  
  .comment-input-wrapper {
    display: flex;
    gap: 0.5rem;
  }
  
  .comment-input {
    flex: 1;
    padding: 0.5rem;
    border: 1px solid var(--border-color);
    border-radius: 0.25rem;
    resize: vertical;
    min-height: 60px;
  }
  
  .comment-submit {
    align-self: flex-end;
    padding: 0.5rem 1rem;
    background-color: var(--brand-green);
    color: white;
    border: none;
    border-radius: 0.25rem;
    cursor: pointer;
  }
  
  .comment-item {
    margin-bottom: 1rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid var(--border-color);
  }
  
  .comment-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 0.5rem;
  }
  
  .comment-user {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .comment-avatar {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    object-fit: cover;
  }
  
  /* Mermaid flowchart styles */
  .mermaid-wrapper {
    margin: 1rem 0;
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    overflow: hidden;
  }
  
  .mermaid-controls {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    padding: 0.5rem;
    background-color: var(--bg-secondary);
    border-bottom: 1px solid var(--border-color);
  }
  
  .mermaid-edit,
  .mermaid-comments {
    background: none;
    border: none;
    cursor: pointer;
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    display: flex;
    align-items: center;
    gap: 0.25rem;
    color: var(--text-secondary);
  }
  
  .mermaid-edit:hover,
  .mermaid-comments:hover {
    background-color: var(--bg-primary);
    color: var(--text-primary);
  }
  
  .ai-flowchart-placeholder,
  .image-placeholder {
    padding: 1rem;
    border: 2px dashed var(--border-color);
    border-radius: 0.5rem;
    margin: 1rem 0;
    text-align: center;
    color: var(--text-secondary);
    background-color: var(--bg-secondary);
  }
  

</style>