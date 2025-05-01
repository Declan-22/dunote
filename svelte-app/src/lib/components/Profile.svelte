<script lang="ts">
    import { onMount } from 'svelte';
	import { user } from '$lib/stores/userStore';
    import { 
      userStats, 
      userPreferences, 
      achievementDefinitions,
      userLevel,
      totalPoints,
      loadUserStats,
      loadUserPreferences,
      saveUserPreferences
    } from '$lib/stores/store';
    import { supabase } from '$lib/supabaseClient';
    
    let displayName = '';
    let editingName = false;
    let newDisplayName = '';
    let avatarColor = '#4CAF50';
    let loading = true;
    let saveStatus = '';
    let activeTab = 'stats'; // 'stats', 'achievements', 'preferences'
    
    // For preferences
    let theme = 'system';
    let accentColor = '#4CAF50';
    let showNotifications = true;
    let playSoundEffects = true;
    let showCompletedTasks = true;
    let defaultView = 'grid';
    let startPage = 'home';
    
    onMount(async () => {
      if ($user) {
        // Load user profile
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', $user.id)
          .single();
        
        if (!error && data) {
          displayName = data.display_name || $user.email.split('@')[0];
          avatarColor = data.avatar_color || '#4CAF50';
        } else {
          displayName = $user.email.split('@')[0];
        }
        
        // Load stats and preferences
        await loadUserStats();
        await loadUserPreferences();
        
        // Set local preference values
        theme = $userPreferences.theme;
        accentColor = $userPreferences.accentColor;
        showNotifications = $userPreferences.notifications;
        playSoundEffects = $userPreferences.soundEffects;
        showCompletedTasks = $userPreferences.showCompletedTasks;
        defaultView = $userPreferences.defaultView;
        startPage = $userPreferences.startPage;
        
        loading = false;
      }
    });
    
    async function updateDisplayName() {
      if (!newDisplayName.trim()) {
        editingName = false;
        return;
      }
      
      const { error } = await supabase
        .from('users')
        .update({ display_name: newDisplayName })
        .eq('id', $user.id);
      
      if (!error) {
        displayName = newDisplayName;
        saveStatus = 'Profile updated successfully';
        setTimeout(() => saveStatus = '', 3000);
      } else {
        saveStatus = 'Error updating profile';
        setTimeout(() => saveStatus = '', 3000);
      }
      
      editingName = false;
    }
    
    async function updateAvatarColor() {
      const { error } = await supabase
        .from('users')
        .update({ avatar_color: avatarColor })
        .eq('id', $user.id);
      
      if (!error) {
        saveStatus = 'Profile updated successfully';
        setTimeout(() => saveStatus = '', 3000);
      } else {
        saveStatus = 'Error updating profile';
        setTimeout(() => saveStatus = '', 3000);
      }
    }
    
    function savePreferences() {
      userPreferences.update(prefs => {
        prefs.theme = theme;
        prefs.accentColor = accentColor;
        prefs.notifications = showNotifications;
        prefs.soundEffects = playSoundEffects;
        prefs.showCompletedTasks = showCompletedTasks;
        prefs.defaultView = defaultView;
        prefs.startPage = startPage;
        return prefs;
      });
      
      saveUserPreferences();
      saveStatus = 'Preferences saved successfully';
      setTimeout(() => saveStatus = '', 3000);
    }
    
    // Get the achievement unlock status
    function isAchievementUnlocked(achievementId) {
      return $userStats.achievements.includes(achievementId);
    }
    
    // Calculate level progress percentage
    $: levelProgressPercent = ($userLevel.progress * 100).toFixed(0);
    
    // Format time display (convert minutes to hours and minutes)
    function formatTime(minutes) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      
      if (hours > 0) {
        return `${hours}h ${mins}m`;
      } else {
        return `${mins}m`;
      }
    }
    
    // Calculate total time
    $: totalMinutes = $userStats.focusTime.minutes + 
                      $userStats.planningTime.minutes + 
                      $userStats.learningTime.minutes + 
                      $userStats.breakTime.minutes;
  </script>
  
  <div class="container mx-auto px-4 py-8 max-w-5xl">
    {#if loading}
      <div class="flex justify-center items-center h-64">
        <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--brand-green)]"></div>
      </div>
    {:else}
      <div class="mb-8 flex flex-col md:flex-row justify-between items-start gap-6">
        <!-- Profile Overview -->
        <div class="bg-[var(--bg-secondary)] p-6 rounded-lg shadow-md w-full md:w-1/3 mb-6 md:mb-0">
          <div class="flex items-center gap-4 mb-6">
            <div 
              class="w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-bold"
              style={`background-color: ${avatarColor};`}
            >
              {displayName.charAt(0).toUpperCase()}
            </div>
            
            <div class="flex-1">
              {#if editingName}
                <div class="flex items-center gap-2">
                  <input 
                    type="text" 
                    bind:value={newDisplayName} 
                    class="p-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg" 
                    placeholder={displayName}
                  />
                  <button 
                    on:click={updateDisplayName}
                    class="p-2 bg-[var(--brand-green)] text-white rounded-lg"
                  >
                    Save
                  </button>
                  <button 
                    on:click={() => editingName = false}
                    class="p-2 bg-[var(--bg-primary)] rounded-lg"
                  >
                    Cancel
                  </button>
                </div>
              {:else}
                <h1 class="text-xl font-bold flex items-center gap-2">
                  {displayName}
                  <button 
                    on:click={() => {
                      newDisplayName = displayName;
                      editingName = true;
                    }}
                    class="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  >
                    ✏️
                  </button>
                </h1>
              {/if}
              
              <p class="text-[var(--text-secondary)]">{$user.email}</p>
            </div>
          </div>
          
          <div class="mb-4">
            <label class="block text-sm mb-1">Avatar Color</label>
            <div class="flex items-center gap-3">
              <input 
                type="color" 
                bind:value={avatarColor} 
                class="h-8 w-16 border-none cursor-pointer"
              />
              <button 
                on:click={updateAvatarColor}
                class="px-3 py-1 bg-[var(--brand-green)] text-white rounded-lg text-sm"
              >
                Update Color
              </button>
            </div>
          </div>
          
          <!-- Level and Points Overview -->
          <div class="mb-4">
            <div class="flex justify-between items-center">
              <h2 class="text-xl font-bold">Level {$userLevel.level}</h2>
              <span class="text-[var(--text-secondary)]">{$totalPoints} points</span>
            </div>
            
            <div class="w-full bg-[var(--bg-primary)] rounded-full h-2.5 my-2">
              <div 
                class="bg-[var(--brand-green)] h-2.5 rounded-full" 
                style={`width: ${levelProgressPercent}%`}
              ></div>
            </div>
            
            <p class="text-xs text-[var(--text-secondary)]">
              {$totalPoints} / {$userLevel.nextLevelPoints} XP to next level
            </p>
          </div>
          
          <!-- Quick Stats -->
          <div class="grid grid-cols-2 gap-3">
            <div class="bg-[var(--bg-primary)] p-3 rounded-lg">
              <p class="text-sm text-[var(--text-secondary)]">Tasks Completed</p>
              <p class="text-xl font-bold">{$userStats.tasksCompleted}</p>
            </div>
            
            <div class="bg-[var(--bg-primary)] p-3 rounded-lg">
              <p class="text-sm text-[var(--text-secondary)]">Login Streak</p>
              <p class="text-xl font-bold">{$userStats.loginStreak} days 🔥</p>
            </div>
            
            <div class="bg-[var(--bg-primary)] p-3 rounded-lg">
              <p class="text-sm text-[var(--text-secondary)]">Total Time</p>
              <p class="text-xl font-bold">{formatTime($userStats.minutesWorked)}</p>
            </div>
            
            <div class="bg-[var(--bg-primary)] p-3 rounded-lg">
              <p class="text-sm text-[var(--text-secondary)]">Achievements</p>
              <p class="text-xl font-bold">{$userStats.achievements.length} / {achievementDefinitions.length}</p>
            </div>
          </div>
        </div>
        
        <!-- Tabs Content Area -->
        <div class="bg-[var(--bg-secondary)] p-6 rounded-lg shadow-md w-full md:w-2/3">
          <!-- Tabs Navigation -->
          <div class="flex border-b border-[var(--border-color)] mb-6">
            <button 
              class={`px-4 py-2 font-medium ${activeTab === 'stats' ? 'text-[var(--brand-green)] border-b-2 border-[var(--brand-green)]' : 'text-[var(--text-secondary)]'}`}
              on:click={() => activeTab = 'stats'}
            >
              Statistics
            </button>
            
            <button 
              class={`px-4 py-2 font-medium ${activeTab === 'achievements' ? 'text-[var(--brand-green)] border-b-2 border-[var(--brand-green)]' : 'text-[var(--text-secondary)]'}`}
              on:click={() => activeTab = 'achievements'}
            >
              Achievements
            </button>
            
            <button 
              class={`px-4 py-2 font-medium ${activeTab === 'preferences' ? 'text-[var(--brand-green)] border-b-2 border-[var(--brand-green)]' : 'text-[var(--text-secondary)]'}`}
              on:click={() => activeTab = 'preferences'}
            >
              Preferences
            </button>
          </div>
          
          {#if saveStatus}
            <div class="bg-green-100 text-green-800 p-2 rounded-lg mb-4">
              {saveStatus}
            </div>
          {/if}
          
          <!-- Statistics Tab -->
          {#if activeTab === 'stats'}
            <h2 class="text-xl font-bold mb-4">Productivity Metrics</h2>
            
            <div class="mb-8">
              <div class="flex justify-between items-center mb-2">
                <h3 class="text-lg">Time Distribution</h3>
                <span class="text-sm text-[var(--text-secondary)]">Total: {formatTime(totalMinutes)}</span>
              </div>
              
              <!-- Focus Time (Deep Work) -->
              <div class="mb-6">
                <div class="flex justify-between items-center">
                  <div class="flex items-center">
                    <div class="w-3 h-3 rounded-full bg-[#9c27b0] mr-2"></div>
                    <span>Focus Time</span>
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="font-bold">{$userStats.focusTime.percentage}%</span>
                    <span class="text-sm text-[var(--text-secondary)]">{formatTime($userStats.focusTime.minutes)}</span>
                  </div>
                </div>
                <div class="w-full bg-[var(--bg-primary)] rounded-full h-4 mt-1 overflow-hidden">
                  <div 
                    class="bg-[#9c27b0] h-4 rounded-full" 
                    style={`width: ${$userStats.focusTime.percentage}%`}
                  ></div>
                </div>
            </div>
            
            <!-- Planning Time -->
            <div class="mb-6">
              <div class="flex justify-between items-center">
                <div class="flex items-center">
                  <div class="w-3 h-3 rounded-full bg-[#2196f3] mr-2"></div>
                  <span>Planning Time</span>
                </div>
                <div class="flex items-center gap-2">
                  <span class="font-bold">{$userStats.planningTime.percentage}%</span>
                  <span class="text-sm text-[var(--text-secondary)]">{formatTime($userStats.planningTime.minutes)}</span>
                </div>
              </div>
              <div class="w-full bg-[var(--bg-primary)] rounded-full h-4 mt-1 overflow-hidden">
                <div 
                  class="bg-[#2196f3] h-4 rounded-full" 
                  style={`width: ${$userStats.planningTime.percentage}%`}
                ></div>
              </div>
            </div>
            
            <!-- Learning Time -->
            <div class="mb-6">
              <div class="flex justify-between items-center">
                <div class="flex items-center">
                  <div class="w-3 h-3 rounded-full bg-[#ff9800] mr-2"></div>
                  <span>Learning Time</span>
                </div>
                <div class="flex items-center gap-2">
                  <span class="font-bold">{$userStats.learningTime.percentage}%</span>
                  <span class="text-sm text-[var(--text-secondary)]">{formatTime($userStats.learningTime.minutes)}</span>
                </div>
              </div>
              <div class="w-full bg-[var(--bg-primary)] rounded-full h-4 mt-1 overflow-hidden">
                <div 
                  class="bg-[#ff9800] h-4 rounded-full" 
                  style={`width: ${$userStats.learningTime.percentage}%`}
                ></div>
              </div>
            </div>
            
            <!-- Break Time -->
            <div class="mb-6">
              <div class="flex justify-between items-center">
                <div class="flex items-center">
                  <div class="w-3 h-3 rounded-full bg-[#e91e63] mr-2"></div>
                  <span>Break Time</span>
                </div>
                <div class="flex items-center gap-2">
                  <span class="font-bold">{$userStats.breakTime.percentage}%</span>
                  <span class="text-sm text-[var(--text-secondary)]">{formatTime($userStats.breakTime.minutes)}</span>
                </div>
              </div>
              <div class="w-full bg-[var(--bg-primary)] rounded-full h-4 mt-1 overflow-hidden">
                <div 
                  class="bg-[#e91e63] h-4 rounded-full" 
                  style={`width: ${$userStats.breakTime.percentage}%`}
                ></div>
              </div>
            </div>
          </div>
          
          <!-- Task Statistics -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div class="bg-[var(--bg-primary)] p-4 rounded-lg">
              <h3 class="text-lg mb-3">Task Overview</h3>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <p class="text-sm text-[var(--text-secondary)]">Created</p>
                  <p class="text-2xl font-bold">{$userStats.tasksCreated}</p>
                </div>
                <div>
                  <p class="text-sm text-[var(--text-secondary)]">Completed</p>
                  <p class="text-2xl font-bold">{$userStats.tasksCompleted}</p>
                </div>
                <div>
                  <p class="text-sm text-[var(--text-secondary)]">Completion Rate</p>
                  <p class="text-2xl font-bold">
                    {$userStats.tasksCreated > 0 
                      ? Math.round(($userStats.tasksCompleted / $userStats.tasksCreated) * 100) 
                      : 0}%
                  </p>
                </div>
              </div>
            </div>
            
            <div class="bg-[var(--bg-primary)] p-4 rounded-lg">
              <h3 class="text-lg mb-3">Organization</h3>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <p class="text-sm text-[var(--text-secondary)]">Silos Created</p>
                  <p class="text-2xl font-bold">{$userStats.silosCreated}</p>
                </div>
                <div>
                  <p class="text-sm text-[var(--text-secondary)]">Notes Created</p>
                  <p class="text-2xl font-bold">{$userStats.notesCreated}</p>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Productivity Score -->
          <div class="bg-[var(--bg-primary)] p-4 rounded-lg mb-8">
            <h3 class="text-lg mb-3">Productivity Score</h3>
            <div class="flex items-center gap-4">
              <div class="relative w-20 h-20">
                <svg class="w-20 h-20 transform -rotate-90" viewBox="0 0 100 100">
                  <circle 
                    cx="50" cy="50" r="45" 
                    fill="none" 
                    stroke="var(--bg-secondary)" 
                    stroke-width="10"
                  />
                  <circle 
                    cx="50" cy="50" r="45" 
                    fill="none" 
                    stroke="var(--brand-green)" 
                    stroke-width="10"
                    stroke-dasharray={2 * Math.PI * 45}
                    stroke-dashoffset={2 * Math.PI * 45 * (1 - $userStats.productivity / 100)}
                  />
                </svg>
                <div class="absolute inset-0 flex items-center justify-center">
                  <span class="text-2xl font-bold">{$userStats.productivity}</span>
                </div>
              </div>
              <div>
                <p class="text-sm mb-1">Your productivity score is calculated based on:</p>
                <ul class="text-sm text-[var(--text-secondary)] list-disc ml-5">
                  <li>Task completion rate</li>
                  <li>Focus time percentage</li>
                  <li>Consistency (login streak)</li>
                </ul>
              </div>
            </div>
          </div>
        {/if}
        
        <!-- Achievements Tab -->
        {#if activeTab === 'achievements'}
          <h2 class="text-xl font-bold mb-4">Achievements</h2>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {#each achievementDefinitions as achievement}
              {@const unlocked = isAchievementUnlocked(achievement.id)}
              <div class={`p-4 rounded-lg border ${unlocked ? 'bg-[var(--bg-primary)] border-[var(--brand-green)]' : 'bg-[var(--bg-primary)] border-[var(--border-color)] opacity-60'}`}>
                <div class="flex items-start gap-3">
                  <div class="text-2xl">{achievement.icon}</div>
                  <div>
                    <div class="flex items-center gap-2">
                      <h3 class="font-bold">{achievement.name}</h3>
                      {#if unlocked}
                        <span class="text-xs bg-[var(--brand-green)] text-white px-2 py-0.5 rounded-full">Unlocked</span>
                      {/if}
                    </div>
                    <p class="text-sm text-[var(--text-secondary)]">{achievement.description}</p>
                    <p class="text-xs mt-1">{achievement.points} points</p>
                  </div>
                </div>
              </div>
            {/each}
          </div>
        {/if}
        
        <!-- Preferences Tab -->
        {#if activeTab === 'preferences'}
          <h2 class="text-xl font-bold mb-4">Preferences</h2>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <!-- Theme -->
            <div class="mb-4">
              <label class="block text-sm mb-1">Theme</label>
              <select 
                bind:value={theme}
                class="w-full p-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg"
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="system">System (Auto)</option>
              </select>
            </div>
            
            <!-- Accent Color -->
            <div class="mb-4">
              <label class="block text-sm mb-1">Accent Color</label>
              <div class="flex items-center gap-2">
                <input 
                  type="color" 
                  bind:value={accentColor}
                  class="h-10 w-16 bg-[var(--bg-primary)] rounded-lg"
                />
                <span class="text-[var(--text-secondary)]">{accentColor}</span>
              </div>
            </div>
            
            <!-- Notifications -->
            <div class="mb-4">
              <label class="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  bind:checked={showNotifications}
                  class="form-checkbox h-5 w-5 text-[var(--brand-green)]"
                />
                <span>Show Notifications</span>
              </label>
            </div>
            
            <!-- Sound Effects -->
            <div class="mb-4">
              <label class="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  bind:checked={playSoundEffects}
                  class="form-checkbox h-5 w-5 text-[var(--brand-green)]"
                />
                <span>Play Sound Effects</span>
              </label>
            </div>
            
            <!-- Show Completed Tasks -->
            <div class="mb-4">
              <label class="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  bind:checked={showCompletedTasks}
                  class="form-checkbox h-5 w-5 text-[var(--brand-green)]"
                />
                <span>Show Completed Tasks</span>
              </label>
            </div>
            
            <!-- Default View -->
            <div class="mb-4">
              <label class="block text-sm mb-1">Default View</label>
              <select 
                bind:value={defaultView}
                class="w-full p-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg"
              >
                <option value="grid">Grid</option>
                <option value="list">List</option>
                <option value="kanban">Kanban</option>
              </select>
            </div>
            
            <!-- Start Page -->
            <div class="mb-4">
              <label class="block text-sm mb-1">Start Page</label>
              <select 
                bind:value={startPage}
                class="w-full p-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg"
              >
                <option value="home">Home</option>
                <option value="dashboard">Dashboard</option>
                <option value="tasks">Tasks</option>
                <option value="notes">Notes</option>
              </select>
            </div>
          </div>
          
          <div class="flex justify-end">
            <button 
              on:click={savePreferences}
              class="px-4 py-2 bg-[var(--brand-green)] text-white rounded-lg"
            >
              Save Preferences
            </button>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>