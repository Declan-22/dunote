<!-- WorkspaceDetail.svelte -->

<script context="module" lang="ts">
    declare module 'google.picker' {
        export interface PickerBuilder {
            // Add necessary method declarations
        }
    }

    declare const gapi: {
        load: (module: string, options: { callback: () => void }) => void;
        auth2: {
            init: (config: any) => any;
            authorize: (config: any, callback: (response: any) => void) => void;
        };
    };

    declare const google: {
        picker: {
            ViewId: any;
            Document: any;
            Response: any;
            Action: any;
            DocsView: any;
            PickerBuilder: new () => any;
        };
    };
</script>

<script lang="ts">

import { siloStore } from '$lib/stores/siloStore';
    import { fade } from 'svelte/transition';
    import { supabase } from '$lib/supabaseClient';
    import { onMount } from 'svelte';
    import { onDestroy } from 'svelte';


    export let siloId: string;
    export let nodeId: string;

    let isEditing = false;
    let editedTitle = '';
    let editedPriority = 'medium';
    let editedDueDate = '';

    let googleApiLoaded = false;
    let googleAuth: any;
    let googlePickerApiLoaded = false;
    let oauthToken: string | null = null;

    interface GoogleAuthResult {
        access_token: string;
        error?: string;
    }

    // Add interface for Picker Response
    interface PickerResponse {
        [google.picker.Response.ACTION]: google.picker.Action;
        [google.picker.Response.DOCUMENTS]: google.picker.Document[];
    }

    async function initGoogleAuth() {
        await new Promise((resolve) => {
            gapi.load('auth2', () => {
                googleAuth = gapi.auth2.init({
                    client_id: '995567065866-orms8j8q05vmr0piu4qu4h4f88iub7ej.apps.googleusercontent.com',
                    cookie_policy: 'single_host_origin',
                    scope: 'https://www.googleapis.com/auth/drive.file'
                });
                resolve(true);
            });
        });
    }

// Add these functions to your script section
function loadGoogleApi() {
        if (typeof window === 'undefined' || googleApiLoaded) return;

        const script = document.createElement('script');
        script.src = 'https://apis.google.com/js/api.js';
        script.onload = () => {
            gapi.load('picker', { callback: onPickerApiLoad });
            gapi.load('auth2', { callback: onAuthApiLoad });
        };
        document.body.appendChild(script);
    }

    function onAuthApiLoad() {
        gapi.auth2.authorize({
            client_id: '995567065866-orms8j8q05vmr0piu4qu4h4f88iub7ej.apps.googleusercontent.com',
            scope: 'https://www.googleapis.com/auth/drive.file',
            response_type: 'code',
            redirect_uri: window.location.origin + '/oauth-callback',
            prompt: 'consent',
            cookie_policy: 'single_host_origin'
        }, (authResult: any) => {
            if (authResult && !authResult.error) {
                oauthToken = authResult.access_token;
                googleApiLoaded = true;
                createPicker();
            } else {
                console.error('Google auth error:', authResult?.error);
            }
        });
    }

function handleAuthResult(authResult) {
  if (authResult && !authResult.error) {
    oauthToken = authResult.access_token;
    googleApiLoaded = true;
  }
}

function onPickerApiLoad() {
  googlePickerApiLoaded = true;
}

function createPicker() {
        const view = new google.picker.DocsView(google.picker.ViewId.DOCUMENTS)
            .setIncludeFolders(true)
            .setSelectFolderEnabled(false);

        const picker = new google.picker.PickerBuilder()
            .addView(view)
            .setOAuthToken(oauthToken)
            .setDeveloperKey('AIzaSyDqy6kKM9Z7YkX4Xr2J9Q6q6Q1YQ6q6Q1Y') // Replace with your actual key
            .setCallback(pickerCallback)
            .setOrigin(window.location.origin)
            .setSize(800, 600)
            .build();

        picker.setVisible(true);
    }

    function pickerCallback(data: PickerResponse) {
        if (data[google.picker.Response.ACTION] === google.picker.Action.PICKED) {
            const doc = data[google.picker.Response.DOCUMENTS][0];
            const fileId = doc[google.picker.Document.ID];
            
            // Update node with Google Doc ID
            if (node?.data) {
      // Update local store
      $siloStore = $siloStore.map(silo => {
        if (silo.id === siloId) {
          return {
            ...silo,
            nodes: silo.nodes.map(n => n.id === nodeId ? {
              ...n, 
              data: {
                ...n.data,
                googleFileId: fileId
              }
            } : n)
          };
        }
        return silo;
      });
      
      // Sync with database
      supabase
        .from('nodes')
        .update({ 
          data: {
            ...node.data,
            googleFileId: fileId
          }
        })
        .eq('id', nodeId);
    }
  }
}


// Modify your handler function
async function handleGooglePicker() {
        if (!googleAuth) {
            await initGoogleAuth();
        }
        
        try {
            const user = await googleAuth.signIn();
            oauthToken = user.getAuthResponse().access_token;
            createPicker();
        } catch (error) {
            console.error('Auth error:', error);
        }
    }

onMount(() => {
  // Load Google API when component mounts
  loadGoogleApi();
});
  
    $: node = $siloStore
      .find(s => s.id === siloId)
      ?.nodes.find(n => n.id === nodeId);
  
    onMount(() => {
      if (node) {
        editedTitle = node.data.title || '';
        editedPriority = node.data.priority || 'medium';
        editedDueDate = node.data.dueDate || '';
      }
    });
  
    async function saveChanges() {
      if (!node) return;
      
      const updates = {
        data: {
          ...node.data,
          title: editedTitle,
          priority: editedPriority,
          dueDate: editedDueDate
        }
      };
      
      // Update local store
      $siloStore = $siloStore.map(silo => {
        if (silo.id === siloId) {
          return {
            ...silo,
            nodes: silo.nodes.map(n => n.id === nodeId ? {...n, ...updates} : n)
          };
        }
        return silo;
      });
  
      // Sync with database
      try {
        const { error } = await supabase
          .from('nodes')
          .update(updates)
          .eq('id', nodeId);
        
        if (error) throw error;
      } catch (err) {
        console.error('Failed to save node:', err);
      }
      
      isEditing = false;
    }
  
    function toggleComplete() {
      if (!node) return;
      const newStatus = !node.data.isComplete;
      
      $siloStore = $siloStore.map(silo => {
        if (silo.id === siloId) {
          return {
            ...silo,
            nodes: silo.nodes.map(n => 
              n.id === nodeId ? {...n, data: {...n.data, isComplete: newStatus}} : n
            )
          };
        }
        return silo;
      });
  
      // Sync with DB
      supabase
        .from('nodes')
        .update({ data: {...node.data, isComplete: newStatus} })
        .eq('id', nodeId);
    }
  </script>
  
  {#if node}
  <div transition:fade class="workspace-detail bg-[var(--bg-primary)] text-[var(--text-primary)]">
    <div class="doc-iframe-container">
      {#if node.data.googleFileId}
        <iframe 
          src={`https://docs.google.com/document/d/${node.data.googleFileId}/edit?embedded=true`}
          class="doc-iframe"
        />
      {:else}
        <div class="no-doc-message p-4">
          <p class="text-[var(--text-secondary)] mb-4">No document linked to this task</p>
          <button 
          class="bg-[var(--brand-green)] px-4 py-2 rounded-lg text-white"
          on:click={handleGooglePicker}
        >
          Link Google Doc
        </button>
        </div>
      {/if}
    </div>
  
    <div class="node-preview bg-[var(--bg-secondary)] p-4 border-l border-[var(--border-color)]">
      {#if isEditing}
        <div class="space-y-4">
          <input 
            bind:value={editedTitle}
            class="w-full p-2 rounded bg-[var(--bg-primary)]"
          />
          <select 
            bind:value={editedPriority}
            class="w-full p-2 rounded bg-[var(--bg-primary)]"
          >
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <input
            type="date"
            bind:value={editedDueDate}
            class="w-full p-2 rounded bg-[var(--bg-primary)]"
          />
          <div class="flex gap-2">
            <button on:click={saveChanges} class="bg-[var(--brand-green)] text-white px-4 py-2 rounded">
              Save
            </button>
            <button on:click={() => isEditing = false} class="bg-gray-500 text-white px-4 py-2 rounded">
              Cancel
            </button>
          </div>
        </div>
      {:else}
        <div class="space-y-4">
          <h2 class="text-xl font-semibold">{node.data.title}</h2>
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-[var(--text-secondary)]">Priority:</span>
              <span class="priority-badge {node.data.priority}">
                {node.data.priority}
              </span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-[var(--text-secondary)]">Due Date:</span>
              <span>{node.data.dueDate || 'No due date'}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-[var(--text-secondary)]">Status:</span>
              <span>{node.data.isComplete ? 'Complete' : 'Incomplete'}</span>
            </div>
          </div>
          <div class="flex gap-2">
            <button 
              on:click={() => isEditing = true}
              class="bg-[var(--bg-primary)] border border-[var(--border-color)] px-4 py-2 rounded"
            >
              Edit
            </button>
            <button 
              on:click={toggleComplete}
              class="bg-[var(--brand-green)] text-white px-4 py-2 rounded"
            >
              Mark {node.data.isComplete ? 'Incomplete' : 'Complete'}
            </button>
          </div>
        </div>
      {/if}
    </div>
  </div>
  {:else}
  <div class="error p-4">Node not found</div>
  {/if}
  
  <style>
    .workspace-detail {
      display: grid;
      grid-template-columns: 1fr;
      height: 100vh;
    }
  
    .doc-iframe {
      width: 100%;
      height: 100%;
      border: none;
    }
  
    .node-preview {
      min-height: 300px;
    }
  
    @media (min-width: 768px) {
      .workspace-detail {
        grid-template-columns: 1fr 300px;
      }
    }

  </style>