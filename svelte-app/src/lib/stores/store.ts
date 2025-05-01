import { writable, derived, type Writable, type Readable } from 'svelte/store';
import { supabase } from '$lib/supabaseClient';
import type { User } from '@supabase/supabase-js';

// Define types for the user stats
interface TimeMetric {
    minutes: number;
    percentage: number;
  }
  
  export interface UserStats {
    minutesWorked: number;
    tasksCreated: number;
    tasksCompleted: number;
    silosCreated: number;
    notesCreated: number;
    loginStreak: number;
    lastLogin: string | null;
    level: number;
    points: number;
    focusTime: TimeMetric;
    planningTime: TimeMetric;
    learningTime: TimeMetric;
    breakTime: TimeMetric;
    productivity: number;
    achievements: string[];
  }
  

// User preferences store 
export const userPreferences = writable({
  theme: 'system',
  accentColor: '#4CAF50',
  notifications: true,
  soundEffects: true,
  showCompletedTasks: true,
  defaultView: 'grid',
  startPage: 'home'
});

interface Achievement {
    id: string;
    name: string;
    description: string;
    icon: string;
    points: number;
    condition: (stats: UserStats) => boolean;
  }
  
  interface TimerState {
    running: boolean;
    startTime: Date | null;
    type: 'focus' | 'planning' | 'learning' | 'break';
    elapsedSeconds: number;
    intervalId: NodeJS.Timeout | null;
  }
  
  // User statistics store
  export const userStats: Writable<UserStats> = writable({
    minutesWorked: 0,
    tasksCreated: 0,
    tasksCompleted: 0,
    silosCreated: 0,
    notesCreated: 0,
    loginStreak: 0,
    lastLogin: null,
    level: 1,
    points: 0,
    focusTime: { minutes: 0, percentage: 0 },
    planningTime: { minutes: 0, percentage: 0 },
    learningTime: { minutes: 0, percentage: 0 },
    breakTime: { minutes: 0, percentage: 0 },
    productivity: 0,
    achievements: []
  });

// Achievement definitions
export const achievementDefinitions = [
  {
    id: 'first_login',
    name: 'First Steps',
    description: 'Log in for the first time',
    icon: '🎯',
    points: 10,
    condition: (stats) => stats.loginStreak >= 1
  },
  {
    id: 'streak_3',
    name: 'Consistency is Key',
    description: 'Log in for 3 days in a row',
    icon: '🔥',
    points: 30,
    condition: (stats) => stats.loginStreak >= 3
  },
  {
    id: 'streak_7',
    name: 'Week Warrior',
    description: 'Log in for 7 days in a row',
    icon: '🏆',
    points: 50,
    condition: (stats) => stats.loginStreak >= 7
  },
  {
    id: 'productive_hour',
    name: 'Focus Session',
    description: 'Record over 60 minutes of productive time in a day',
    icon: '⏱️',
    points: 25,
    condition: (stats) => stats.focusTime.minutes >= 60
  },
  {
    id: 'task_master',
    name: 'Task Master',
    description: 'Complete 10 tasks',
    icon: '✓',
    points: 50,
    condition: (stats) => stats.tasksCompleted >= 10
  },
  {
    id: 'note_taker',
    name: 'Note Taker',
    description: 'Create 5 notes',
    icon: '📝',
    points: 25,
    condition: (stats) => stats.notesCreated >= 5
  },
  {
    id: 'organization_guru',
    name: 'Organization Guru',
    description: 'Create 3 silos',
    icon: '🧠',
    points: 35, 
    condition: (stats) => stats.silosCreated >= 3
  }
];

// Derived store for unlocked achievements
export const unlockedAchievements: Readable<Achievement[]> = derived(
    userStats,
    ($userStats) => {
      return achievementDefinitions.filter(achievement => 
        achievement.condition($userStats) && 
        !$userStats.achievements.includes(achievement.id)
      );
    }
  );
  
  // Total points calculation
  export const totalPoints: Readable<number> = derived(
    userStats,
    ($userStats) => {
      let points = $userStats.points;
      const achievementPoints = $userStats.achievements.reduce((total, achievementId) => {
        const achievement = achievementDefinitions.find(a => a.id === achievementId);
        return total + (achievement ? achievement.points : 0);
      }, 0);
      return points + achievementPoints;
    }
  );
  
  // Level calculation
  export const userLevel = derived(
    totalPoints,
    ($totalPoints) => {
      let level = 1;
      let pointsRequired = 100;
      
      while ($totalPoints >= pointsRequired) {
        level++;
        pointsRequired += 100 * level;
      }
      
      const progress = ($totalPoints - (pointsRequired - 100 * level)) / (100 * level);
      
      return {
        level,
        progress,
        nextLevelPoints: pointsRequired
      };
    }
  );

  async function getCurrentUser(): Promise<User | null> {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  }
  


// Functions to track various metrics
export async function trackWorkMinutes(minutes: number, type: 'focus' | 'planning' | 'learning' | 'break') {
    userStats.update(stats => {
      const updated = { ...stats };
      updated[`${type}Time`].minutes += minutes;
      updated.minutesWorked += minutes;
  
      const totalMinutes = Object.values({
        focus: updated.focusTime.minutes,
        planning: updated.planningTime.minutes,
        learning: updated.learningTime.minutes,
        break: updated.breakTime.minutes
      }).reduce((sum, val) => sum + val, 0);
  
      if (totalMinutes > 0) {
        updated.focusTime.percentage = Math.round((updated.focusTime.minutes / totalMinutes) * 100);
        updated.planningTime.percentage = Math.round((updated.planningTime.minutes / totalMinutes) * 100);
        updated.learningTime.percentage = Math.round((updated.learningTime.minutes / totalMinutes) * 100);
        updated.breakTime.percentage = Math.round((updated.breakTime.minutes / totalMinutes) * 100);
      }
  
      if (type !== 'break') {
        updated.points += minutes;
      }
  
      return updated;
    });
  
    await saveUserStats();
  }
  

export function trackTaskCreation() {
  userStats.update(stats => {
    stats.tasksCreated++;
    stats.points += 5; // 5 points for creating a task
    return stats;
  });
  
  if (supabase && supabase.auth.user()) {
    // Save to database
    saveUserStats();
  }
}

export function trackTaskCompletion() {
  userStats.update(stats => {
    stats.tasksCompleted++;
    stats.points += 10; // 10 points for completing a task
    return stats;
  });
  
  if (supabase && supabase.auth.user()) {
    // Save to database
    saveUserStats();
  }
}

export function trackNoteCreation() {
  userStats.update(stats => {
    stats.notesCreated++;
    stats.points += 5; // 5 points for creating a note
    return stats;
  });
  
  if (supabase && supabase.auth.user()) {
    // Save to database
    saveUserStats();
  }
}

export function trackSiloCreation() {
  userStats.update(stats => {
    stats.silosCreated++;
    stats.points += 15; // 15 points for creating a silo
    return stats;
  });
  
  if (supabase && supabase.auth.user()) {
    // Save to database
    saveUserStats();
  }
}

export function updateLoginStreak() {
  userStats.update(stats => {
    const now = new Date();
    const lastLogin = stats.lastLogin ? new Date(stats.lastLogin) : null;
    
    // Check if this is the first login or if it's a new day
    if (!lastLogin) {
      stats.loginStreak = 1;
    } else {
      const dayDiff = Math.floor((now.getTime() - lastLogin.getTime()) / (1000 * 60 * 60 * 24));
      
      if (dayDiff === 0) {
        // Already logged in today, don't increment streak
      } else if (dayDiff === 1) {
        // Consecutive day, increment streak
        stats.loginStreak++;
        stats.points += 5 * stats.loginStreak; // More points for longer streaks
      } else {
        // Streak broken, reset to 1
        stats.loginStreak = 1;
      }
    }
    
    stats.lastLogin = now.toISOString();
    
    return stats;
  });
  
  if (supabase && supabase.auth.user()) {
    // Save to database
    saveUserStats();
  }
}

// Check for new achievements
export function checkAchievements() {
  let newAchievements = false;
  
  userStats.update(stats => {
    achievementDefinitions.forEach(achievement => {
      if (achievement.condition(stats) && !stats.achievements.includes(achievement.id)) {
        stats.achievements.push(achievement.id);
        stats.points += achievement.points;
        newAchievements = true;
      }
    });
    
    return stats;
  });
  
  return newAchievements;
}

// Save stats to Supabase
export async function saveUserStats() {
  let statsValue;
  userStats.subscribe(value => {
    statsValue = value;
  })();
  
  const user = await getCurrentUser();
  if (!user) return;
  
  const { error } = await supabase
    .from('user_stats')
    .upsert({ 
      user_id: user.id,
      stats: statsValue
    });
  
  if (error) {
    console.error('Error saving user stats:', error);
  }
}

// Load stats from Supabase

export async function loadUserStats() {
    const user = await getCurrentUser();
    if (!user) return;
  
    const { data, error } = await supabase
      .from('user_stats')
      .select('stats')
      .eq('user_id', user.id)
      .single();
  
    if (!error && data?.stats) {
      userStats.set(data.stats);
    }
  }
  

// Load preferences from Supabase
export async function loadUserPreferences() {
  const user = getCurrentUser();
  if (!user) return;
  
  const { data, error } = await supabase
    .from('user_preferences')
    .select('preferences')
    .eq('user_id', user.id)
    .single();
  
  if (error) {
    console.error('Error loading user preferences:', error);
    return;
  }
  
  if (data && data.preferences) {
    userPreferences.set(data.preferences);
  }
}

// Save preferences to Supabase
export async function saveUserPreferences() {
  let preferencesValue;
  userPreferences.subscribe(value => {
    preferencesValue = value;
  })();
  
  const user = await getCurrentUser();
  if (!user) return;
  
  const { error } = await supabase
    .from('user_preferences')
    .upsert({ 
      user_id: user.id,
      preferences: preferencesValue
    });
  
  if (error) {
    console.error('Error saving user preferences:', error);
  }
}

// Timer functionality
export const activeTimer: Writable<TimerState> = writable({
    running: false,
    startTime: null,
    type: 'focus',
    elapsedSeconds: 0,
    intervalId: null
  });
  
  export function startTimer(type: TimerState['type'] = 'focus') {
    activeTimer.update(timer => {
      if (timer.intervalId) clearInterval(timer.intervalId);
      
      const startTime = new Date();
      let intervalId: NodeJS.Timeout | null = null;
      
      intervalId = setInterval(() => {
        activeTimer.update(t => ({
          ...t,
          elapsedSeconds: Math.floor((Date.now() - startTime.getTime()) / 1000)
        }));
      }, 1000);
  
      return {
        running: true,
        startTime,
        type,
        elapsedSeconds: 0,
        intervalId
      };
    });
  }

  export async function stopTimer() {
    let timer: TimerState;
    activeTimer.subscribe(t => { timer = t; })();
    
    if (timer.running) {
      if (timer.intervalId) clearInterval(timer.intervalId);
      
      const minutes = Math.floor(timer.elapsedSeconds / 60);
      if (minutes > 0 && timer.startTime) {
        await trackWorkMinutes(minutes, timer.type);
      }
      
      activeTimer.set({
        running: false,
        startTime: null,
        type: 'focus',
        elapsedSeconds: 0,
        intervalId: null
      });
    }
  }