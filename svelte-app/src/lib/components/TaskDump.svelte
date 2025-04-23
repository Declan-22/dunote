<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { parseTaskInput } from '$lib/utils/taskParser';
  import { fade } from 'svelte/transition';
    
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
    
  const dispatch = createEventDispatcher();
  export let value = '';
  let tasks: Task[] = [];
  let newTask = '';
  let showHelp = false;
  let tableVisible = false;
  let columnSelectorOpen = false;

  // Available columns with default visibility
  let availableColumns = [
      { id: 'name', label: 'Task Name', visible: true },
      { id: 'due_date', label: 'Due Date', visible: true },
      { id: 'status', label: 'Status', visible: true },
      { id: 'priority', label: 'Priority', visible: true },
      { id: 'resources', label: 'Resources', visible: true }
  ];

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
      }
  }

  function deleteTask(id: string) {
      tasks = tasks.filter(task => task.id !== id);
      if (tasks.length === 0) tableVisible = false;
  }

  function runDump() {
      dispatch('process', { tasks });
  }

  function clearTable() {
      tasks = [];
      tableVisible = false;
  }
  
  function toggleColumnVisibility(columnId: string) {
      const column = availableColumns.find(c => c.id === columnId);
      if (column) column.visible = !column.visible;
      availableColumns = [...availableColumns]; 
  }
</script>
  
<div class="task-dump-container">
  <div class="header">
    <h2>Task Dump</h2>
    <div class="header-controls">
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
                placeholder="Type your task and press Enter..."
                autofocus
            />
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
                <button class="control-button run" on:click={runDump}>Save</button>
            </div>
        </div>
    {/if}
</div>
<style>
  /* Global styles */


  .header-controls {
        display: flex;
        gap: 8px;
    }

    .icon-button {
        background: none;


        cursor: pointer;
    }

    .column-selector {
        background: var(--bg-secondary);
        padding: 12px;
        border-radius: 6px;
        margin-bottom: 12px;
    }

    .column-selector label {
        display: flex;
        gap: 8px;
        padding: 4px 0;
        cursor: pointer;
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
    display: flex;
    align-items: center;
    padding: 10px 0;

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
</style>