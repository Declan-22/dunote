<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { parseTaskInput } from '$lib/utils/taskParser';
  import { fade } from 'svelte/transition';
  import { supabase } from '$lib/supabaseClient';
    
  type StatusKey = 'not-started' | 'in-progress' | 'completed';
  type PriorityKey = 'high' | 'medium' | 'low';
  
  interface Task {
      id: string;
      name: string;
      due_date?: string | null; // Changed to allow null values
      status: StatusKey;
      priority: PriorityKey;
      resources?: string[] | string; // Allow both string and array
      blocked_by?: string[];
      [key: string]: any; // For any additional properties
  }

  interface TaskTable {
    id: string;
    columns: { id: string; label: string; visible: boolean }[];
    tasks: Task[];
  }
    
  const dispatch = createEventDispatcher();
  export let value = '';
  export let availableSilos = []; // To hold available silos for integration
  let tasks: Task[] = [];
  let newTask = '';
  let showHelp = false;
  let tableVisible = false;
  let columnSelectorOpen = false;
  let user = null;
  let integrationMode = false;
  let selectedSiloId = '';
  let tables: TaskTable[] = [];
  let activePreset: string = 'tasks';
  let inputFocused = true;


  // Available columns with default visibility
  let availableColumns = [
    { id: 'name', label: 'Task Name', visible: true },
    { id: 'due_date', label: 'Due Date', visible: true },
    { id: 'status', label: 'Status', visible: true },
    { id: 'priority', label: 'Priority', visible: true },
    { id: 'resources', label: 'Resources', visible: true },
    { id: 'assigned_to', label: 'Assigned To', visible: false },
    { id: 'estimated_time', label: 'Time Estimate', visible: false },
    { id: 'client', label: 'Client', visible: false },
    { id: 'deliverable', label: 'Deliverable', visible: false },
    { id: 'milestone', label: 'Milestone', visible: false }
];

const columnPresets = {
    tasks: ['name', 'priority', 'due_date', 'status', 'resources'],
    client: ['name', 'client', 'due_date', 'status', 'deliverable'],
    project: ['name', 'milestone', 'due_date', 'status', 'priority'],
    personal: ['name', 'due_date', 'status', 'priority', 'estimated_time'],
    commission: ['name', 'client', 'deliverable', 'due_date', 'status', 'priority']
};

function applyColumnPreset(presetName: string) {
  activePreset = presetName;
    const preset = columnPresets[presetName];
    if (preset) {
        // First hide all columns
        availableColumns = availableColumns.map(col => ({...col, visible: false}));
        // Then show only the ones in the preset
        availableColumns = availableColumns.map(col => ({
            ...col, 
            visible: preset.includes(col.id)
        }));
    }
}

  const priorityColors = {
      high: 'var(--error)',
      medium: 'var(--warning)',
      low: 'var(--success)'
  };

  const statusIcons = {
      'not-started': `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/></svg>`,
      'in-progress': `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>`,
      'completed': `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>`
  };

  onMount(async () => {
  // Check auth state
  const { data } = await supabase.auth.getUser();
  user = data.user;
  
  // Fetch available silos for integration
  if (user) {
    // Make sure we're fetching the right fields
    // Update this query to match your table structure
    const { data: silos, error } = await supabase
      .from('silos')
      .select('id, name')  // Changed from 'title' to 'name' to match your schema
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
      
    if (silos && !error) {
      availableSilos = silos;
      // If we have silos and integration mode is active, select the first by default
      if (integrationMode && silos.length > 0) {
        selectedSiloId = silos[0].id;
      }
    } else if (error) {
      console.error('Error fetching silos:', error);
    }
    
  }
  applyColumnPreset('tasks');
    tables = [createNewTable()];
  });
  function createNewTable(): TaskTable {
    return {
      id: crypto.randomUUID(),
      columns: JSON.parse(JSON.stringify(availableColumns)), // Deep copy
      tasks: []
    };
  }

  function arraysEqual(a: string[], b: string[]) {
    return a.length === b.length && a.every((v, i) => v === b[i]);
  }

  function addTask(e: KeyboardEvent) {
      if (e.key === 'Enter') {
          const parsed = parseTaskInput(newTask);
          
          // Convert parsed tasks to match our Task interface
          const newTasks: Task[] = parsed.map(t => ({
              id: crypto.randomUUID(),
              name: t.name || '',
              due_date: t.due_date || undefined,
              status: (t.status as StatusKey) || 'not-started',
              priority: (t.priority as PriorityKey) || 'medium',
              resources: t.resources || undefined,
              blocked_by: t.blocked_by || undefined,
              ...t // Include any other properties
          }));
          
          tasks = [...tasks, ...newTasks];
          tableVisible = true;
          newTask = '';
          e.preventDefault();
          const currentVisible = availableColumns.filter(c => c.visible).map(c => c.id);
      const lastTable = tables[tables.length - 1];
      const lastVisible = lastTable.columns.filter(c => c.visible).map(c => c.id);

      if (!arraysEqual(currentVisible, lastVisible)) {
        tables = [...tables, createNewTable()];
      }

      const targetTable = tables[tables.length - 1];
      targetTable.tasks = [...targetTable.tasks, ...newTasks];
      newTask = '';
      inputFocused = true; // Maintain focus
      e.preventDefault();
    }
  }

  function deleteTask(id: string) {
      tasks = tasks.filter(task => task.id !== id);
      if (tasks.length === 0) tableVisible = false;
  }

  async function runDump() {
    if (!user) {
      // Handle the case where user is not logged in
      const { data } = await supabase.auth.getUser();
      user = data.user;
      
      if (!user) {
        alert('You must be logged in to save tasks');
        return;
      }
    }
    
    if (tasks.length === 0) {
      alert('Please add at least one task before saving');
      return;
    }
    
    // Dispatch event with tasks for parent component to handle
    // Include integration mode and selectedSiloId if in integration mode
    dispatch('process', { 
      tasks,
      integrationMode,
      siloId: integrationMode ? selectedSiloId : null,
      // Make sure to include a title property
      title: 'Task Collection'
    });
  }

  function clearTable() {
      tasks = [];
      tableVisible = false;
  }
  
  function toggleColumnVisibility(columnId: string) {
    availableColumns = availableColumns.map(col => {
        if (col.id === columnId) {
            return { ...col, visible: !col.visible };
        }
        return col;
    });
}
  
  function toggleIntegrationMode() {
  integrationMode = !integrationMode;
  
  if (integrationMode) {
    if (availableSilos.length > 0) {
      selectedSiloId = availableSilos[0].id;
    } else {
      // Optionally fetch silos again in case they were created since page load
      refreshSilos();
    }
  }
}

async function refreshSilos() {
  if (!user) {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  }
  
  if (user) {
    const { data: silos, error } = await supabase
      .from('silos')
      .select('id, name')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
      
    if (silos && !error) {
      availableSilos = silos;
      if (integrationMode && silos.length > 0) {
        selectedSiloId = silos[0].id;
      }
    } else if (error) {
      console.error('Error refreshing silos:', error);
    }
  }
}

</script>
  
<div class="task-dump-container">
  <div class="header">
    <h2>Task Dump</h2>
    <div class="header-controls">
      <button class="icon-button" on:click={toggleIntegrationMode} title="Toggle integration mode">
        <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24">
            <path fill="currentColor" d="M7.5 4.75a.75.75 0 1 0 0 1.5a.75.75 0 0 0 0-1.5m-2.25.75a2.25 2.25 0 1 1 3 2.122v3.906q.13-.096.27-.178c.949-.572 2.165-.739 3.198-.88l.179-.025c1.161-.162 2.102-.322 2.777-.777c.505-.342.937-.91 1.048-2.056a2.25 2.25 0 1 1 1.504.018c-.126 1.577-.738 2.622-1.712 3.28c-1.013.685-2.322.87-3.41 1.02l-.025.004c-1.17.162-2.107.292-2.786.7c-.315.19-.562.436-.737.782c-.18.354-.306.856-.306 1.584v1.378a2.251 2.251 0 1 1-1.5 0V7.622A2.25 2.25 0 0 1 5.25 5.5m11.25-.75a.75.75 0 1 0 0 1.5a.75.75 0 0 0 0-1.5m-9 13a.75.75 0 1 0 0 1.5a.75.75 0 0 0 0-1.5" />
        </svg>
    </button>
        <button class="icon-button" on:click={() => columnSelectorOpen = !columnSelectorOpen}>
            <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
        </button>
        <button class="help-button" on:click={() => showHelp = !showHelp}>?</button>
    </div>
  </div>

  {#if columnSelectorOpen}
      <div class="column-selector" transition:fade>
          {#each availableColumns as column}
              <label>
                  <input 
                      type="checkbox" 
                      bind:checked={column.visible}
                      on:change={() => toggleColumnVisibility(column.id)}
                  />
                  {column.label}
              </label>
          {/each}
      </div>
  {/if}

  {#if integrationMode}
  <div class="integration-selector" transition:fade>
    <label>
      Add tasks to existing silo:
      <select bind:value={selectedSiloId}>
        {#each availableSilos as silo}
          <option value={silo.id}>{silo.name}</option> <!-- Changed from silo.title to silo.name -->
        {/each}
      </select>
    </label>
    {#if availableSilos.length === 0}
      <p class="empty-silos-message">No silos found. Create a new silo first.</p>
    {/if}
  </div>
  {/if}

  {#if showHelp}
    <div class="help-box" transition:fade>
      <p>Type tasks naturally. The system will automatically detect:</p>
      <ul>
        <li>Dates (today, tomorrow, specific dates)</li>
        <li>Classes or subjects</li>
        <li>Priorities (urgent, important)</li>
        <li>Time estimates</li>
        <li>Resources needed</li>
      </ul>
    </div>
  {/if}

  {#if !tableVisible}
  <div class="input-container">
    <input
      class="floating-input font-mono"
      bind:value={newTask}
      on:keydown={addTask}
      on:focus={() => inputFocused = true}
      on:blur={() => inputFocused = false}
      class:focused={inputFocused}
      placeholder="Type your task and press Enter..."
      autofocus
    />
    
    <div class="input-buttons">
      <button 
      on:click={() => applyColumnPreset('tasks')} 
      class="input-button"
      class:active={activePreset === 'tasks'}>
      
      <svg xmlns="http://www.w3.org/2000/svg"
      width="16" height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round">
   <path d="M9 12l2 2l4-4M4 6a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6z" />
 </svg>
      
      Tasks
    </button>
        <button on:click={() => applyColumnPreset('client')} class="input-button">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
            Client
        </button>
        <button on:click={() => applyColumnPreset('project')} class="input-button">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="3" y1="9" x2="21" y2="9"></line>
                <line x1="9" y1="21" x2="9" y2="9"></line>
            </svg>
            Project
        </button>
        <button on:click={() => applyColumnPreset('personal')} class="input-button">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
            </svg>
            Personal
        </button>
        <button on:click={() => applyColumnPreset('commission')} class="input-button">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
            </svg>
            Commission
        </button>
    </div>
</div>
    {:else}
        <div class="table-container" transition:fade={{ duration: 200 }}>
            <table class="task-table">
                <thead>
                    <tr>
                        {#each availableColumns.filter(c => c.visible) as col}
                            <th>{col.label}</th>
                        {/each}
                        <th class="actions-header"></th>
                    </tr>
                </thead>
                <tbody>
                    {#each tasks as task (task.id)}
                        <tr class="task-row">
                            {#each availableColumns.filter(c => c.visible) as col}
                                <td>
                                    {#if col.id === 'status'}
                                        <div class="status-container">
                                            <span class="status-icon" class:completed={task.status === 'completed'} class:in-progress={task.status === 'in-progress'}>
                                                {@html statusIcons[task.status as StatusKey] || statusIcons['not-started']}
                                            </span>
                                            <select bind:value={task.status} class="status-select font-mono">
                                                <option value="not-started">Not Started</option>
                                                <option value="in-progress">In Progress</option>
                                                <option value="completed">Completed</option>
                                            </select>
                                        </div>
                                    {:else if col.id === 'priority'}
                                        <select bind:value={task.priority} class="priority-select font-mono">
                                            <option value="high">High</option>
                                            <option value="medium">Medium</option>
                                            <option value="low">Low</option>
                                        </select>
                                    {:else}
                                        <input
                                            class="font-mono"
                                            bind:value={task[col.id]}
                                            placeholder={col.label}
                                            type={col.id === 'due_date' ? 'date' : 'text'}
                                        />
                                    {/if}
                                </td>
                            {/each}
                            <td class="actions-cell">
                                <button class="delete-button" on:click={() => deleteTask(task.id)}>
                                    ✕
                                </button>
                            </td>
                        </tr>
                    {/each}
                    <tr class="new-task-row">
                        <td colspan={availableColumns.filter(c => c.visible).length}>
                            <input
                                class="font-mono"
                                bind:value={newTask}
                                on:keydown={addTask}
                                placeholder="+ Add new task"
                            />
                        </td>
                    </tr>
                </tbody>
            </table>

            <div class="controls">
                <button class="control-button clear" on:click={clearTable}>Clear All</button>
                <button class="control-button run" on:click={runDump}>
                  {integrationMode ? 'Add to Silo' : 'Create New Silo'}
                </button>
            </div>
        </div>
    {/if}
</div>


<style>
  /* Global styles */
  .integration-selector {
    margin: 10px 0;
    padding: 10px;
    border-radius: 4px;
    background-color: var(--background-secondary);
  }

  .integration-selector select {
    margin-left: 10px;
    padding: 4px;
    border-radius: 4px;
    border: 1px solid var(--border-color);
  }

  .empty-silos-message {
    color: var(--warning);
    font-size: 0.9em;
    margin-top: 5px;
  }
  
  .icon-button {
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 4px;
    margin-right: 8px;
    border-radius: 4px;
    color: var(--text-1);
  }
  
  .icon-button:hover {
    background-color: var(--surface-2);
  }


  .header-controls {
        display: flex;
        gap: 8px;
    }

    .icon-button {
        background: none;


        cursor: pointer;
    }

    .column-selector {
    display: flex;
    flex-direction: column;
    gap: 8px;
    background-color: var(--background-secondary);
    border: 1px solid var(--border-color);
    padding: 12px;
    border-radius: 8px;
    margin-bottom: 16px;
    z-index: 10;
}

.column-selector label {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
}

.column-selector input[type="checkbox"] {
    appearance: auto; /* This fixes the checkbox issue */
    width: 16px;
    height: 16px;
}

    .actions-header, .actions-cell {
        width: 32px;
        padding: 0 !important;
    }

    .delete-button {
        background: none;
        border: none;
        color: var(--text-secondary);
        cursor: pointer;
        padding: 4px 8px;
    }

    .delete-button:hover {
        color: var(--error);
    }

    /* Modify existing styles */
    .task-table th {
        position: relative;
    }

    .task-table input {
        width: 100%;
        min-width: 120px;
        padding-right: 28px; /* Creates space for the icon */
        background-position: right 8px center;
    }

    .status-select, .priority-select {
        background: var(--bg-accent);
        border-radius: 4px;
        padding: 4px;
    }

    tr:hover {
        background: var(--bg-hover);
    }

    
  .task-dump-container {
    background: transparent;
    padding: 12px;
    color: var(--text-primary);
    width: 100%;

  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;

  }

  .header h2 {
    font-weight: 600;
    font-size: 1.3rem;
    color: var(--text-primary);

  }

  .help-button {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: 1px solid var(--border-color);
    cursor: pointer;
    font-size: 12px;
    color: var(--text-secondary);
  }

  .help-box {
    background-color: var(--bg-secondary);
    border-radius: 4px;
    padding: 10px 12px;
    margin-bottom: 12px;
    font-size: 0.8rem;
    color: var(--text-secondary);
  }

  .help-box ul {
    margin: 6px 0 0 0;
    padding-left: 16px;
  }

  .help-box li {
    margin-bottom: 2px;
  }

  /* Input styles when table is not visible */
  .input-container {
    position: relative;
    margin-bottom: 1rem;
}

.input-buttons {
    display: flex;
    gap: 8px;
    margin-top: 8px;
    overflow-x: auto;
    padding-bottom: 4px;
}

.input-button {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background-color: var(--background-secondary);
    border: 1px solid var(--border-color);
    border-radius: 16px;
    font-size: 0.875rem;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;
}

.input-button:hover {
    background-color: var(--background-hover);
    color: var(--text-primary);
}
.input-button.active {
  background-color: var(--bg-accent);
    color: var(--text-primary);
    border: 1px solid var(--brand-green-light);
}
.input-button:focus {
    background-color: var(--bg-accent);
    color: var(--text-primary);
    border: 1px solid var(--brand-green-light);
}

.input-button svg {
    width: 14px;
    height: 14px;
}


  .floating-input {
    width: 100%;
    padding: 8px 0px;
    background: transparent;
    border: transparent;
    border-radius: 4px;
    font-size: 14px;
    outline: none;
    color: var(--text-primary);
  }

  /* Table styles */
  .table-container {
    margin-top: 10px;
  }

  .task-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.8rem;
  }
  
  .task-table thead {
    border-bottom: 1px solid var(--border-color);
  }

  .task-table th {
    padding: 8px 10px;
    text-align: left;
    font-weight: normal;
    color: var(--text-secondary);
    font-size: 0.75rem;
    text-transform: uppercase;
  }
  
  .task-table td {
    padding: 6px 10px;
    border-bottom: 1px solid var(--border-color);
    vertical-align: middle;
  }

  /* Form controls inside table */
  .task-table input,
  .task-table select {
    width: 100%;
    background: transparent;
    border: none;
    font-size: 0.8rem;
    padding: 4px 0;
    outline: none;
    color: var(--text-primary);
  }

  .new-task-row td {
    padding: 10px;
  }

  .new-task-row input {
    width: 100%;
    border: none;
    padding: 4px 0;
    font-size: 0.8rem;
    outline: none;
    color: var(--text-secondary);
    background: transparent;
  }

  /* Status styling */
  .status-container {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .status-icon {
    display: flex;
    align-items: center;
    color: var(--text-secondary);
  }

  .status-icon.completed {
    color: var(--success);
  }

  .status-icon.in-progress {
    color: var(--warning);
  }

  .status-icon svg {
    width: 14px;
    height: 14px;
  }

  .status-select,
  .priority-select {
    flex: 1;
    color: var(--text-primary);
    background-color: transparent;
    border: none;
    outline: none;
    -webkit-appearance: none;
    appearance: none;
  }

  /* Control buttons */
  .controls {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
    margin-top: 12px;
  }

  .control-button {
    padding: 6px 12px;
    border-radius: 4px;
    border: none;
    font-size: 0.8rem;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .control-button.clear {
    background-color: transparent;
    border: 1px solid var(--border-color);
    color: var(--text-secondary);
  }

  .control-button.run {
    background-color: var(--brand-accent);
    color: var(--light-text);
  }

  /* For proper input theming in both light and dark modes */
  input::placeholder, 
  select::placeholder {
    color: var(--text-secondary);
    opacity: 0.7;
  }

  tr:hover {
    background-color: var(--bg-hover);
  }
  
  /* Remove focus outlines for cleaner appearance */
  *:focus {
    outline: none;
  }

   /* Mobile-specific styles */
  @media (max-width: 640px) {
    .task-table {
      min-width: 100%;
      width: 100%;
    }

    .task-table th,
    .task-table td {
      padding: 8px;
      min-width: 60px; /* Smaller minimum width for mobile */
    }

    .status-container {
      flex-wrap: wrap;
      gap: 4px;
    }

    .status-select,
    .priority-select {
      font-size: 0.7rem; /* Smaller font for dropdowns */
    }

    .task-table input {
      min-width: 0; /* Remove fixed minimum width */
      font-size: 0.8rem;
    }

    .controls {
      flex-direction: column;
    }

    .control-button {
      width: 100%;
      text-align: center;
    }
  }

</style>