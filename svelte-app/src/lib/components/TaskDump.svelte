<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { parseTaskInput } from '$lib/utils/taskParser';
    import { fade } from 'svelte/transition';
      
    const dispatch = createEventDispatcher();
    export let value = '';
    let tasks: any[] = [];
    let newTask = '';
    let showHelp = false;
    let tableVisible = false;
  
    const columns = [
      { id: 'name', label: 'Task Name' },
      { id: 'class', label: 'Class' },
      { id: 'due_date', label: 'Due Date' },
      { id: 'status', label: 'Status' },
      { id: 'priority', label: 'Priority' },
      { id: 'time_estimate', label: 'Time Estimate' },
      { id: 'resources', label: 'Resources' }
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
        tasks = [...tasks, ...parsed];
        tableVisible = true;
        newTask = '';
        e.preventDefault();
      }
    }
  
    function runDump() {
      dispatch('process', { tasks });
    }
  
    function clearTable() {
      tasks = [];
      tableVisible = false;
    }
  </script>
  
  <div class="task-dump-container">
    <div class="header">
      <h2>Task Dump</h2>
      <button class="help-button" on:click={() => showHelp = !showHelp}>?</button>
    </div>
  
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
              {#each columns as col}
                <th>{col.label}</th>
              {/each}
            </tr>
          </thead>
          <tbody>
            {#each tasks as task, i (task.id)}
              <tr>
                <td><input class="font-mono" bind:value={task.name} /></td>
                <td>
                  <input class="font-mono" bind:value={task.class} placeholder="Class" />
                </td>
                <td><input class="font-mono" type="text" bind:value={task.due_date} placeholder="YYYY-MM-DD" /></td>
                <td>
                  <div class="status-container">
                    <span class="status-icon" class:completed={task.status === 'completed'} class:in-progress={task.status === 'in-progress'}>
                      {@html statusIcons[task.status] || statusIcons['not-started']}
                    </span>
                    <select bind:value={task.status} class="status-select font-mono">
                      <option value="not-started">Not Started</option>
                      <option value="in-progress">In Progress</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>
                </td>
                <td>
                  <select bind:value={task.priority} class="priority-select font-mono">
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </td>
                <td>
                  <input class="font-mono" bind:value={task.time_estimate} placeholder="Time" />
                </td>
                <td>
                  <input class="font-mono" bind:value={task.resources} placeholder="Resources" />
                </td>
              </tr>
            {/each}
            <tr class="new-task-row">
              <td colspan={columns.length}>
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
          <button class="control-button clear" on:click={clearTable}>Clear</button>
          <button class="control-button run" on:click={runDump}>Save</button>
        </div>
      </div>
    {/if}
  </div>
    
  <style>
    /* Global styles */
    .task-dump-container {
      background-color: var(--bg-secondary);
      border-radius: 4px;
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
      font-weight: 500;
      font-size: 1.1rem;
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
      background-color: var(--bg-accenttwo);
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
      padding: 8px 10px;
      background: transparent;
      border: 1px solid var(--border-color);
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