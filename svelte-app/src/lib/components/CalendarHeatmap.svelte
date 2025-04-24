<script lang="ts">
  import { onMount } from 'svelte';
  import { format, startOfWeek, addDays, eachDayOfInterval, subMonths } from 'date-fns';
  
  export let siloId: string;
  export let months: number = 6; // How many months to display
  
  type CalendarDay = {
    date: Date;
    count: number;
    intensity: number;
  };
  
  let calendarData: CalendarDay[] = [];
  let maxCount = 0;
  let isLoading = true;
  let errorMessage = '';
  
  onMount(async () => {
    await fetchActivityData();
  });
  
  async function fetchActivityData() {
    isLoading = true;
    errorMessage = '';
    
    try {
      console.log(`Fetching activity data for silo: ${siloId}`);
      const response = await fetch(`/api/silos/${siloId}/activity`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`API error (${response.status}):`, errorText);
        throw new Error(`API returned ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      console.log(`Received ${data.length} activity records`);
      processActivityData(data);
    } catch (error) {
      console.error('Error loading activity data:', error);
      errorMessage = `Failed to load activity data. Using mock data instead.`;
      generateMockData();
    } finally {
      isLoading = false;
    }
  }
  
  function generateMockData() {
    console.log('Generating mock data');
    const today = new Date();
    const startDate = subMonths(today, months);
    const dateRange = eachDayOfInterval({ start: startDate, end: today });
    
    // Generate mock data
    calendarData = dateRange.map(date => {
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
      const randomFactor = isWeekend ? 0.3 : 1;
      const count = Math.random() > 0.6 ? Math.floor(Math.random() * 8 * randomFactor) : 0;
      return { date, count, intensity: 0 };
    });
    
    // Calculate intensities
    calculateIntensities();
  }
  
  function processActivityData(data: Array<{date: string, count: number}>) {
    console.log('Processing activity data');
    if (!Array.isArray(data)) {
      console.error('Invalid data format:', data);
      throw new Error('Invalid data format received from API');
    }
    
    // Create a map to store activity counts by date
    const activityMap = new Map<string, number>();
    
    // Process each activity record
    data.forEach(item => {
      if (item && item.date) {
        const dateKey = item.date.substring(0, 10); // Extract YYYY-MM-DD
        const count = item.count || 1;
        
        const currentCount = activityMap.get(dateKey) || 0;
        activityMap.set(dateKey, currentCount + count);
      }
    });
    
    // Create the calendar data array covering the specified months
    const today = new Date();
    const startDate = subMonths(today, months);
    const dateRange = eachDayOfInterval({ start: startDate, end: today });
    
    calendarData = dateRange.map(date => {
      const dateKey = format(date, 'yyyy-MM-dd');
      const count = activityMap.get(dateKey) || 0;
      return { date, count, intensity: 0 };
    });
    
    // Calculate intensity levels
    calculateIntensities();
  }
  
  function calculateIntensities() {
    maxCount = Math.max(1, ...calendarData.map(day => day.count));
    
    calendarData = calendarData.map(day => ({
      ...day,
      intensity: day.count === 0 ? 0 : Math.ceil((day.count / maxCount) * 4)
    }));
  }
  
  function getCalendarWeeks(): CalendarDay[][] {
    if (calendarData.length === 0) return [];
    
    const weeks: CalendarDay[][] = [];
    let currentWeek: CalendarDay[] = [];
    
    // Handle first week with potential empty days
    const firstDate = new Date(calendarData[0].date);
    const firstDayOfWeek = firstDate.getDay();
    
    // Fill initial empty days
    const firstWeekStart = startOfWeek(firstDate);
    for (let i = 0; i < firstDayOfWeek; i++) {
      const emptyDate = new Date(firstWeekStart);
      emptyDate.setDate(firstWeekStart.getDate() + i);
      currentWeek.push({ date: emptyDate, count: 0, intensity: 0 });
    }
    
    // Process all calendar days
    calendarData.forEach((day, index) => {
      // Start a new week on Sundays
      if (day.date.getDay() === 0 && currentWeek.length > 0) {
        weeks.push([...currentWeek]);
        currentWeek = [];
      }
      
      currentWeek.push(day);
      
      // Handle the last week
      if (index === calendarData.length - 1) {
        // Fill remaining days in last week
        const lastDayOfWeek = day.date.getDay();
        for (let i = 1; i <= 6 - lastDayOfWeek; i++) {
          const date = new Date(day.date);
          date.setDate(date.getDate() + i);
          currentWeek.push({ date, count: 0, intensity: 0 });
        }
        
        weeks.push([...currentWeek]);
      }
    });
    
    return weeks;
  }
  
  function getMonthLabels(): { name: string; index: number }[] {
    if (calendarData.length === 0) return [];
    
    const monthLabels: { name: string; index: number }[] = [];
    let currentMonth = -1;
    let currentYear = -1;
    
    // Get all calendar weeks
    const weeks = getCalendarWeeks();
    
    // For each day in our data
    calendarData.forEach(day => {
      const month = day.date.getMonth();
      const year = day.date.getFullYear();
      const monthYearKey = `${year}-${month}`;
      
      // If we encounter a new month
      if (month !== currentMonth || year !== currentYear) {
        // Find which week contains this month's start
        const weekIndex = weeks.findIndex(week => 
          week.some(d => 
            d.date.getMonth() === month && 
            d.date.getFullYear() === year && 
            d.date.getDate() <= 7
          )
        );
        
        if (weekIndex !== -1) {
          monthLabels.push({
            name: format(day.date, 'MMM'),
            index: weekIndex
          });
          
          currentMonth = month;
          currentYear = year;
        }
      }
    });
    
    return monthLabels;
  }
  
  function formatActivityText(count: number) {
    return count === 0 ? "No activity" : `${count} contribution${count === 1 ? '' : 's'}`;
  }
</script>

<div class="calendar-heatmap">
{#if isLoading}
  <div class="loading">Loading activity data...</div>
{:else if errorMessage}
  <div class="error-message">{errorMessage}</div>
{/if}

{#if calendarData.length > 0}
  <div class="weekday-labels">
    <div></div> <!-- Empty space for alignment -->
    <div>Sun</div>
    <div>Mon</div>
    <div>Tue</div>
    <div>Wed</div>
    <div>Thu</div>
    <div>Fri</div>
    <div>Sat</div>
  </div>
  
  <div class="heatmap-grid">
    <div class="month-labels">
      {#each getMonthLabels() as month}
        <div class="month-label" style="grid-column: {month.index + 1}">
          {month.name}
        </div>
      {/each}
    </div>
    
    <div class="days-grid">
      {#each getCalendarWeeks() as week, weekIndex}
        {#each week as day}
          <div class="day-cell intensity-{day.intensity}"
               title="{format(day.date, 'PPP')}: {formatActivityText(day.count)}"
               style="grid-row: {day.date.getDay() + 2}; grid-column: {weekIndex + 1};">
          </div>
        {/each}
      {/each}
    </div>
  </div>
  
  <div class="legend">
    <span>Less</span>
    <div class="legend-item intensity-0"></div>
    <div class="legend-item intensity-1"></div>
    <div class="legend-item intensity-2"></div>
    <div class="legend-item intensity-3"></div>
    <div class="legend-item intensity-4"></div>
    <span>More</span>
  </div>
{/if}
</div>
  
  <style>
    .calendar-heatmap {
      font-size: 12px;
      color: var(--text-secondary);
    }
    
    .weekday-labels {
      display: grid;
      grid-template-columns: 30px repeat(7, 1fr);
      text-align: center;
      margin-bottom: 8px;
    }
    
    .weekday-labels div {
      font-size: 10px;
    }
    
    .heatmap-grid {
      position: relative;
    }
    
    .month-labels {
      display: grid;
      grid-auto-flow: column;
      grid-auto-columns: 1fr;
      margin-left: 30px;
      margin-bottom: 4px;
    }
    
    .month-label {
      font-size: 10px;
    }
    
    .days-grid {
      display: grid;
      grid-template-rows: repeat(7, 1fr);
      grid-auto-flow: column;
      grid-auto-columns: minmax(12px, 1fr);
      gap: 2px;
      margin-left: 30px;
    }
    
    .day-cell {
      width: 12px;
      height: 12px;
      border-radius: 2px;
      cursor: pointer;
    }
    
    .intensity-0 {
      background-color: var(--bg-primary);
      border: 1px solid var(--border-color);
    }
    
    .intensity-1 {
      background-color: rgba(var(--brand-green-rgb), 0.25);
    }
    
    .intensity-2 {
      background-color: rgba(var(--brand-green-rgb), 0.5);
    }
    
    .intensity-3 {
      background-color: rgba(var(--brand-green-rgb), 0.75);
    }
    
    .intensity-4 {
      background-color: var(--brand-green);
    }
    
    .legend {
      display: flex;
      align-items: center;
      gap: 4px;
      margin-top: 12px;
      justify-content: flex-end;
    }
    
    .legend-item {
      width: 12px;
      height: 12px;
      border-radius: 2px;
    }
  </style>