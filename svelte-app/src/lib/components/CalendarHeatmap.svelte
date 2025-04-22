<script lang="ts">
    import { onMount } from 'svelte';
    import { format, startOfWeek, addDays, eachDayOfInterval, subMonths, startOfMonth, endOfMonth } from 'date-fns';
    
    export let siloId: string;
    export let months: number = 6; // How many months to display
    
    let calendarData: {
      date: Date;
      count: number;
      intensity: number;
    }[] = [];
    
    let maxCount = 0;
    
    onMount(async () => {
      await fetchActivityData();
    });
    
    async function fetchActivityData() {
      try {
        // This would be replaced with your actual API call 
        // to get activity data for this silo
        const response = await fetch(`/api/silos/${siloId}/activity`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch activity data');
        }
        
        const data = await response.json();
        
        // Process the activity data
        processActivityData(data);
      } catch (error) {
        console.error('Error loading activity data:', error);
        // Generate mock data for demonstration
        generateMockData();
      }
    }
    
    function generateMockData() {
      const today = new Date();
      const startDate = subMonths(today, months);
      
      const dateRange = eachDayOfInterval({
        start: startDate,
        end: today
      });
      
      // Generate random activity counts
      calendarData = dateRange.map(date => {
        // Generate more realistic data - weekends tend to have less activity
        const isWeekend = date.getDay() === 0 || date.getDay() === 6;
        const randomFactor = isWeekend ? 0.3 : 1;
        
        // Random count, with some days having zero
        const randomChance = Math.random();
        let count = 0;
        
        if (randomChance > 0.6) {
          count = Math.floor(Math.random() * 8 * randomFactor);
        }
        
        if (count > maxCount) maxCount = count;
        
        return { date, count, intensity: 0 };
      });
      
      // Calculate intensity levels (0-4) based on the max count
      calendarData = calendarData.map(day => ({
        ...day,
        intensity: day.count === 0 ? 0 : Math.ceil((day.count / maxCount) * 4)
      }));
    }
    
    function processActivityData(data: any) {
      // Placeholder for actual data processing
      // This would transform your API data into the calendarData format
      generateMockData(); // For now, just use mock data
    }
    
    // Group the days into weeks for the grid display
    function getCalendarWeeks() {
      if (calendarData.length === 0) return [];
      
      const firstDate = calendarData[0].date;
      const weeks: typeof calendarData[][] = [];
      let currentWeek: typeof calendarData = [];
      
      // Start the calendar from Sunday
      const firstDay = startOfWeek(firstDate, { weekStartsOn: 0 });
      
      // Fill in any empty days at the start
      const emptyDaysBefore = firstDate.getDay();
      for (let i = 0; i < emptyDaysBefore; i++) {
        const emptyDate = addDays(firstDay, i);
        currentWeek.push({ date: emptyDate, count: 0, intensity: 0 });
      }
      
      // Add all days
      calendarData.forEach((day, index) => {
        if (day.date.getDay() === 0 && currentWeek.length > 0) {
          weeks.push([...currentWeek]);
          currentWeek = [];
        }
        currentWeek.push(day);
        
        // Handle the last week
        if (index === calendarData.length - 1) {
          // Fill in any empty days at the end
          const emptyDaysAfter = 6 - day.date.getDay();
          for (let i = 1; i <= emptyDaysAfter; i++) {
            const emptyDate = addDays(day.date, i);
            currentWeek.push({ date: emptyDate, count: 0, intensity: 0 });
          }
          weeks.push([...currentWeek]);
        }
      });
      
      return weeks;
    }
    
    // Get month labels for the calendar
    function getMonthLabels() {
      if (calendarData.length === 0) return [];
      
      const months: { name: string, index: number }[] = [];
      let currentMonth = -1;
      
      calendarData.forEach(day => {
        const monthIndex = day.date.getMonth();
        if (monthIndex !== currentMonth) {
          months.push({ 
            name: format(day.date, 'MMM'), 
            index: getCalendarWeeks().findIndex(week => 
              week.some(d => d.date.getMonth() === monthIndex && d.date.getDate() <= 7)
            )
          });
          currentMonth = monthIndex;
        }
      });
      
      return months;
    }
    
    // Format activity count for display
    function formatActivityText(count: number) {
      if (count === 0) return "No activity";
      if (count === 1) return "1 contribution";
      return `${count} contributions`;
    }
  </script>
  
  <div class="calendar-heatmap">
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
            <div 
              class="day-cell intensity-{day.intensity}" 
              title="{format(day.date, 'PPP')}: {formatActivityText(day.count)}"
              style="grid-row: {day.date.getDay() + 2}; grid-column: {weekIndex + 1};"
            ></div>
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