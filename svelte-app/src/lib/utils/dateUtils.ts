
export function formatDateStr(dateStr: string | Date, format: 'short' | 'long' | 'relative' = 'short'): string {
  if (!dateStr) return '';
  
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  
  if (isNaN(date.getTime())) return 'Invalid date';
  
  switch (format) {
    case 'long':
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    case 'relative':
      return formatTimeAgo(date);
    case 'short':
    default:
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
  }
}

/**
 * Calculate the number of days between two dates
 * @param start Start date
 * @param end End date
 * @returns Number of days between the dates
 */
export function getDaysBetweenDates(start: Date, end: Date): number {
  // Convert both dates to milliseconds and calculate difference
  const startMs = start.getTime();
  const endMs = end.getTime();
  
  // Convert the difference to days
  return Math.round(Math.abs((endMs - startMs) / (24 * 60 * 60 * 1000)));
}

/**
 * Format a date relative to current time (e.g., "2 days ago")
 * @param date Date to format
 * @returns Formatted relative time string
 */
export function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);
  
  if (diffSecs < 60) {
    return 'just now';
  } else if (diffMins < 60) {
    return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  } else if (diffDays < 7) {
    return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  } else if (diffWeeks < 4) {
    return `${diffWeeks} week${diffWeeks !== 1 ? 's' : ''} ago`;
  } else if (diffMonths < 12) {
    return `${diffMonths} month${diffMonths !== 1 ? 's' : ''} ago`;
  } else {
    return `${diffYears} year${diffYears !== 1 ? 's' : ''} ago`;
  }
}

/**
 * Get start of day/week/month from a date
 * @param date Date to process
 * @param unit Unit of time to get start of
 * @returns Date object for start of the specified unit
 */
export function getStartOf(date: Date, unit: 'day' | 'week' | 'month' | 'year'): Date {
  const result = new Date(date);
  
  switch (unit) {
    case 'day':
      result.setHours(0, 0, 0, 0);
      break;
    case 'week':
      result.setDate(result.getDate() - result.getDay()); // Sunday as first day
      result.setHours(0, 0, 0, 0);
      break;
    case 'month':
      result.setDate(1);
      result.setHours(0, 0, 0, 0);
      break;
    case 'year':
      result.setMonth(0, 1);
      result.setHours(0, 0, 0, 0);
      break;
  }
  
  return result;
}

/**
 * Get end of day/week/month from a date
 * @param date Date to process
 * @param unit Unit of time to get end of
 * @returns Date object for end of the specified unit
 */
export function getEndOf(date: Date, unit: 'day' | 'week' | 'month' | 'year'): Date {
  const result = new Date(date);
  
  switch (unit) {
    case 'day':
      result.setHours(23, 59, 59, 999);
      break;
    case 'week':
      result.setDate(result.getDate() + (6 - result.getDay())); // Saturday as last day
      result.setHours(23, 59, 59, 999);
      break;
    case 'month':
      result.setMonth(result.getMonth() + 1, 0); // Last day of month
      result.setHours(23, 59, 59, 999);
      break;
    case 'year':
      result.setMonth(11, 31); // December 31
      result.setHours(23, 59, 59, 999);
      break;
  }
  
  return result;
}

/**
 * Format a date range
 * @param startDate Start date
 * @param endDate End date
 * @param format Format style
 * @returns Formatted date range string
 */
export function formatDateRange(startDate: Date, endDate: Date, format: 'short' | 'long' = 'short'): string {
  if (!startDate || !endDate) return '';
  
  // Check if dates are on the same day
  const sameDay = startDate.getDate() === endDate.getDate() && 
                  startDate.getMonth() === endDate.getMonth() && 
                  startDate.getFullYear() === endDate.getFullYear();
  
  if (sameDay) {
    // Format as single date with time range
    const dateStr = startDate.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: format === 'long' ? 'long' : 'short', 
      day: 'numeric' 
    });
    
    const startTimeStr = startDate.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true
    });
    
    const endTimeStr = endDate.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true
    });
    
    return `${dateStr}, ${startTimeStr} - ${endTimeStr}`;
  } else {
    // Format as date range
    const startStr = startDate.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: format === 'long' ? 'long' : 'short', 
      day: 'numeric' 
    });
    
    const endStr = endDate.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: format === 'long' ? 'long' : 'short', 
      day: 'numeric' 
    });
    
    return `${startStr} - ${endStr}`;
  }
}