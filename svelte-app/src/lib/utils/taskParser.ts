// src/lib/utils/taskParser.ts
import { parse, parseISO, format, addDays, isValid } from 'date-fns';

interface ParsedTask {
  id: string;
  name: string;
  priority: 'high' | 'medium' | 'low';
  due_date: string | null;
  status: 'not-started' | 'in-progress' | 'completed';
  resources: string[];
  blocked_by: string[];
  [key: string]: any; // Support for additional properties
}

export function parseTaskInput(input: string): ParsedTask[] {
  return input.split('\n')
    .filter(line => line.trim().length > 0)
    .map(line => parseSingleTask(line.trim()));
}

function parseSingleTask(text: string): ParsedTask {
  const task: ParsedTask = {
    id: crypto.randomUUID(),
    name: text,
    priority: 'medium',
    due_date: null,
    status: 'not-started',
    resources: [],
    blocked_by: []
  };

  // Extract information in a specific order for best results
  // 1. First extract due dates as they help determine priority
  extractDueDate(text.toLowerCase(), task);
  
  // 2. Extract resources and blockers to help clean up the task name
  extractResources(text, task);
  extractBlockers(text, task);
  
  // 3. Extract priority after due date is known
  extractPriority(text.toLowerCase(), task);
  
  // 4. Extract status
  extractStatus(text.toLowerCase(), task);
  
  // 5. Clean up task name last, after we've extracted all metadata
  cleanTaskName(task);
  
  return task;
}

function extractDueDate(text: string, task: ParsedTask): void {
  // Additional date patterns
  const datePatterns = [
    // Today, tomorrow, day after tomorrow (improved matching)
    {
      regex: /\b(?:by|due|before|until|for)?\s*(today|tomorrow|(?:day after tomorrow))\b/i,
      handler: (match: RegExpMatchArray) => {
        const currentDate = new Date();
        switch (match[1].toLowerCase()) {
          case 'today':
            return currentDate;
          case 'tomorrow':
            return addDays(currentDate, 1);
          case 'day after tomorrow':
            return addDays(currentDate, 2);
        }
        return null;
      }
    },
    
    // This weekend, next week
    {
      regex: /\b(?:by|due|before|until|for)?\s*(this|next)\s+(weekend|week|month)\b/i,
      handler: (match: RegExpMatchArray) => {
        const today = new Date();
        const timeframe = match[2].toLowerCase();
        const qualifier = match[1].toLowerCase();
        
        if (timeframe === 'weekend') {
          // Calculate days until weekend (Sat)
          const daysToWeekend = (6 - today.getDay() + 7) % 7;
          const daysToAdd = qualifier === 'next' ? daysToWeekend + 7 : daysToWeekend;
          return addDays(today, daysToAdd);
        } else if (timeframe === 'week') {
          return addDays(today, qualifier === 'next' ? 7 : 0);
        } else if (timeframe === 'month') {
          const nextMonth = new Date(today);
          nextMonth.setMonth(nextMonth.getMonth() + (qualifier === 'next' ? 1 : 0));
          return nextMonth;
        }
        return null;
      }
    },
    
    // Tonight, this afternoon, this morning
    {
      regex: /\b(?:by|due|before|until|for)?\s*(tonight|this afternoon|this morning|this evening)\b/i,
      handler: (match: RegExpMatchArray) => {
        return new Date(); // Same day but different time of day
      }
    },
    
    // Next Monday, this Friday, etc. (improved with more prepositions)
    {
      regex: /\b(?:by|due|before|until|for|on)?\s*(this|next)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
      handler: (match: RegExpMatchArray) => {
        // Same as your original implementation
        const today = new Date();
        const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
          .indexOf(match[2].toLowerCase());
        
        if (dayOfWeek !== -1) {
          let daysToAdd = (dayOfWeek - today.getDay() + 7) % 7;
          
          if (match[1].toLowerCase() === 'next' || 
             (match[1].toLowerCase() === 'this' && daysToAdd === 0)) {
            daysToAdd += 7;
          }
          
          return addDays(today, daysToAdd);
        }
        return null;
      }
    },
    
    // Specific day of week without qualifier (e.g., "Monday")
    {
      regex: /\b(?:by|due|before|until|for|on)?\s*(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
      handler: (match: RegExpMatchArray) => {
        const today = new Date();
        const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
          .indexOf(match[1].toLowerCase());
        
        if (dayOfWeek !== -1) {
          let daysToAdd = (dayOfWeek - today.getDay() + 7) % 7;
          // If the day is today, push to next week
          if (daysToAdd === 0) daysToAdd = 7;
          return addDays(today, daysToAdd);
        }
        return null;
      }
    },
    
    // "Due in X days/weeks" (improved)
    {
      regex: /\b(?:due|in)\s+(\d+)\s+(day|week|hour|minute)s?\b/i,
      handler: (match: RegExpMatchArray) => {
        const amount = parseInt(match[1]);
        const unit = match[2].toLowerCase();
        
        if (!isNaN(amount)) {
          const today = new Date();
          if (unit === 'day') {
            return addDays(today, amount);
          } else if (unit === 'week') {
            return addDays(today, amount * 7);
          } else if (unit === 'hour') {
            const result = new Date(today);
            result.setHours(result.getHours() + amount);
            return result;
          } else if (unit === 'minute') {
            const result = new Date(today);
            result.setMinutes(result.getMinutes() + amount);
            return result;
          }
        }
        return null;
      }
    },
    
    // Before specific time today
    {
      regex: /\bbefore\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i,
      handler: (match: RegExpMatchArray) => {
        const hour = parseInt(match[1]);
        const minute = match[2] ? parseInt(match[2]) : 0;
        const period = match[3]?.toLowerCase() || 'pm';
        
        const today = new Date();
        today.setHours(
          period === 'pm' && hour < 12 ? hour + 12 : (period === 'am' && hour === 12 ? 0 : hour),
          minute,
          0,
          0
        );
        
        return today;
      }
    },
    
    // Month and date formats expanded (MMMM d, MMM d, MM/dd, etc.)
    {
      regex: /\b(?:by|due|before|until|for|on)?\s*([a-z]+\s+\d{1,2}(?:st|nd|rd|th)?|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\b/i,
      handler: (match: RegExpMatchArray) => {
        let dateStr = match[1].replace(/(\d{1,2})(st|nd|rd|th)/i, '$1');
        
        // Try MM/DD format
        if (dateStr.includes('/')) {
          const [month, day, year] = dateStr.split('/');
          const currentYear = new Date().getFullYear();
          const dateWithYear = `${month}/${day}/${year || currentYear}`;
          
          try {
            const parsedDate = new Date(dateWithYear);
            if (isValid(parsedDate)) return parsedDate;
          } catch (e) { /* Continue to next format */ }
        }
        
        // Try Month Day format (April 15)
        try {
          const parsedDate = parse(dateStr, 'MMMM d', new Date());
          if (isValid(parsedDate)) {
            // If date is in the past, assume next year
            if (parsedDate < new Date()) {
              parsedDate.setFullYear(parsedDate.getFullYear() + 1);
            }
            return parsedDate;
          }
        } catch (e) { /* Continue to next format */ }
        
        try {
          const parsedDate = parse(dateStr, 'MMM d', new Date());
          if (isValid(parsedDate)) {
            // If date is in the past, assume next year
            if (parsedDate < new Date()) {
              parsedDate.setFullYear(parsedDate.getFullYear() + 1);
            }
            return parsedDate;
          }
        } catch (e) { /* Continue to next format */ }
        
        return null;
      }
    }
  ];

  // Try all date patterns
  for (const pattern of datePatterns) {
    const match = text.match(pattern.regex);
    if (match) {
      const date = pattern.handler(match);
      if (date && isValid(date)) {
        task.due_date = format(date, 'yyyy-MM-dd');
        return; // Exit once we've found a date
      }
    }
  }
}

function extractPriority(text: string, task: ParsedTask): void {
  // Normalize text for easier scanning
  const normalizedText = text.toLowerCase();
  
  // High priority indicators (expanded)
  if (/\b(urgent|asap|immediately|highest|critical|top priority|time sensitive|important|rush|emergency|crucial|vital|priority|due soon|fast|quickly|rapid|expedite|hurry|now)\b/i.test(normalizedText)) {
    task.priority = 'high';
    return;
  }
  
  // Medium priority indicators
  if (/\b(important|medium priority|significant|key|essential|standard|regular|moderate|normal)\b/i.test(normalizedText)) {
    task.priority = 'medium';
    return;
  }
  
  // Low priority indicators
  if (/\b(low priority|whenever|not urgent|can wait|someday|eventually|not important|unimportant|no rush|when possible|little importance|later|sometime)\b/i.test(normalizedText)) {
    task.priority = 'low';
    return;
  }
  
  // Time-based urgency detection
  if (task.due_date) {
    const today = new Date();
    const dueDate = parseISO(task.due_date);
    
    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    // Emergency timeline (same day)
    if (diffDays === 0) {
      task.priority = 'high';
    } 
    // Urgent timeline (tomorrow)
    else if (diffDays === 1) {
      task.priority = 'high';
    }
    // Soon timeline (within 3 days)
    else if (diffDays <= 3) {
      task.priority = 'medium';
    }
  }
  
  // Look for deadlines or time constraints in text that indicate urgency
  if (/\b(deadline|by end of|eod|end of day|by tomorrow|tonight|this morning|asap|right now)\b/i.test(normalizedText)) {
    task.priority = 'high';
  }
}

function extractStatus(text: string, task: ParsedTask): void {
  const normalizedText = text.toLowerCase();
  
  // Completed status indicators (expanded)
  if (/\b(finished|completed|done|wrapped up|delivered|submitted|turned in|finalized|concluded|ended|closed|ready|over|resolved|achieved|accomplished|fulfilled)\b/i.test(normalizedText)) {
    task.status = 'completed';
    return;
  }
  
  // In progress indicators (expanded)
  if (/\b(started|beginning|in progress|working on|half|partial|halfway|almost|began|continuing|ongoing|resume|underway|developing|processing|mid-way|constructing|building|drafting|editing|revising|reviewing|outlining)\b/i.test(normalizedText)) {
    task.status = 'in-progress';
    return;
  }
  
  // Not started indicators (expanded)
  if (/\b(need to|haven't started|not started|to begin|will start|plan to|going to|must|should|would|upcoming|pending|scheduled|future|todo|to do|to-do|planned|intended|proposed|considering)\b/i.test(normalizedText)) {
    task.status = 'not-started';
    return;
  }
  
  // Default to not-started if no status indicators found
  task.status = 'not-started';
}

function extractResources(text: string, task: ParsedTask): void {
  const normalizedText = text.toLowerCase();
  
  // Resource patterns (expanded)
  const resourcePatterns = [
    // Using X, With X, Need X, Requires X
    /(?:using|with|need|needs|requiring|requires?|through|via|utilize|employ|apply|leverage)\s+(?:a|an|the|my|our)?\s*([a-z0-9]+(?: [a-z0-9]+)*)/gi,
    
    // X is required, X is needed
    /([a-z0-9]+(?: [a-z0-9]+)*)\s+(?:is|are)\s+(?:required|needed|necessary|essential)/gi,
    
    // In X, On X, At X (for platforms/locations)
    /(?:in|on|at)\s+(?:the|a|an)?\s*([A-Z][a-z0-9]+(?: [A-Z][a-z0-9]+)*)/g, // Capitalized platforms like "in Slack", "on GitHub"
    
    // Parent-child indicators for documents
    /([a-z0-9]+(?: [a-z0-9]+)*)\s+(?:folder|file|document|spreadsheet|presentation|database)/gi
  ];

  // Check for items in parentheses which often indicate resources
  const parenthesesMatch = text.match(/\(([^)]+)\)/g);
  if (parenthesesMatch) {
    parenthesesMatch.forEach(match => {
      // Clean up the parenthetical content
      const content = match.replace(/[()]/g, '').trim();
      if (content.length > 2 && !task.resources.includes(content)) {
        task.resources.push(content);
      }
    });
  }

  // Extract from patterns
  for (const pattern of resourcePatterns) {
    const matches = Array.from(normalizedText.matchAll(pattern));
    matches.forEach(match => {
      if (match[1]) {
        const resource = match[1].trim();
        if (resource.length > 2 && !task.resources.includes(resource)) {
          task.resources.push(resource);
        }
      }
    });
  }
  
  // Special handling for common resource indicators
  const specialResourceIndicators = [
    {regex: /\bhw packet\b/i, resource: "HW packet"},
    {regex: /\bfridge\b/i, resource: "fridge"},
    {regex: /\breference #(\d+)/i, handler: (m: RegExpMatchArray) => `reference #${m[1]}`},
    {regex: /\bpdf\b/i, resource: "PDF export"},
    {regex: /\bchapter \d+\b/i, handler: (m: RegExpMatchArray) => m[0]},
    {regex: /\b([A-Za-z]+) auto-layout\b/i, handler: (m: RegExpMatchArray) => `${m[1]} auto-layout`},
    {regex: /\bexternal SSD\b/i, resource: "external SSD"},
    {regex: /\bProject folder\b/i, resource: "project folder"},
    {regex: /\bSlack\b/i, resource: "Slack"},
    {regex: /\bDownloads folder\b/i, resource: "Downloads folder"}
  ];
  
  specialResourceIndicators.forEach(indicator => {
    const match = text.match(indicator.regex);
    if (match) {
      const resource = indicator.handler ? indicator.handler(match) : indicator.resource;
      if (!task.resources.includes(resource)) {
        task.resources.push(resource);
      }
    }
  });
}

function extractBlockers(text: string, task: ParsedTask): void {
  const normalizedText = text.toLowerCase();
  
  // Expanded blocker patterns
  const blockerPatterns = [
    // Direct dependencies
    /(?:after|depends on|blocked by|waiting for|following|can't start until|requires|dependent on)\s+([a-z0-9]+(?: [a-z0-9]+)*)/i,
    
    // Sequential tasks
    /(?:can't do until|need)\s+([a-z0-9]+(?: [a-z0-9]+)*)\s+(?:to be|is)\s+(?:done|finished|completed)/i,
    
    // Prerequisite actions
    /(?:first|before)\s+(?:I|we)?\s*(?:need to|must|should|have to)\s+([a-z0-9]+(?: [a-z0-9]+)*)/i,
    
    // Check dependencies
    /(?:check|verify|confirm)\s+([a-z0-9]+(?: [a-z0-9]+)*)\s+(?:first|before|initially)/i
  ];

  for (const pattern of blockerPatterns) {
    const match = normalizedText.match(pattern);
    if (match && match[1]) {
      const blocker = match[1].trim();
      if (blocker.length > 2 && !task.blocked_by.includes(blocker)) {
        task.blocked_by.push(blocker);
      }
    }
  }

  // Special case for "check X first" pattern
  const checkFirstMatch = normalizedText.match(/check\s+([a-z0-9]+(?: [a-z0-9]+)*)\s+first/i);
  if (checkFirstMatch && checkFirstMatch[1]) {
    const blocker = checkFirstMatch[1].trim();
    if (blocker.length > 2 && !task.blocked_by.includes(blocker)) {
      task.blocked_by.push(blocker);
    }
  }
}

function cleanTaskName(task: ParsedTask): void {
  let cleanName = task.name;
  
  // Remove parenthetical content (often contains context but not the core task)
  cleanName = cleanName.replace(/\([^)]*\)/g, ' ');
  
  // Remove common date/time phrases (expanded patterns)
  const dateTimePatterns = [
    /\b(?:due|at|on|by|before|until|for)\s+(?:today|tomorrow|(?:day after tomorrow))\b/i,
    /\b(?:due|at|on|by|before|until|for)\s+(?:this|next)\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|week|weekend|month)\b/i,
    /\bdue\s+(?:on|by)?\s+(?:[a-z]+\s+\d{1,2}|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\b/i,
    /\bdue\s+in\s+\d+\s+(?:day|week|hour|minute)s?\b/i,
    /\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/i,
    /\b(?:before|after|around|by)\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b/i,
    /\btonight\b/i,
    /\bthis (?:morning|afternoon|evening|week|month|weekend)\b/i
  ];
  
  // Apply date removal
  for (const pattern of dateTimePatterns) {
    cleanName = cleanName.replace(pattern, ' ');
  }
  
  // Remove resource references that we've already captured
  task.resources.forEach(resource => {
    // Escape for regex
    const escapedResource = resource.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const resourcePattern = new RegExp(`\\b(?:using|with|in|on|at|for|from)\\s+(?:the|a|an)?\\s*${escapedResource}\\b`, 'i');
    cleanName = cleanName.replace(resourcePattern, ' ');
    
    // Also remove just the resource itself if it's a proper noun (starts with capital)
    if (/^[A-Z]/.test(resource)) {
      const simplePattern = new RegExp(`\\b${escapedResource}\\b`, 'i');
      cleanName = cleanName.replace(simplePattern, ' ');
    }
  });
  
  // Remove status indicators
  const statusPatterns = [
    /\b(?:finished|completed|done|wrapped up|delivered|submitted|turned in)\b.*$/i,
    /\b(?:started|beginning|in progress|working on|half|partial|halfway|almost|began|continuing|ongoing|resume)\b.*$/i,
    /\b(?:need to|haven't started|not started|to begin|will start|plan to|going to)\b/i,
    /\balready started it\b.*$/i,
    /\bI already\b.*$/i,
    /\balready\b.*$/i
  ];
  
  for (const pattern of statusPatterns) {
    cleanName = cleanName.replace(pattern, ' ');
  }
  
  // Remove filler phrases and task initiation language
  const fillerPhrases = [
    /\b(?:I need to|I have to|I must|I should|I want to|help me|please|remind me to|don't forget to)\b/i,
    /\b(?:I'll|we'll|we should|we need to|we must|we have to)\b/i,
    /\b(?:remember to|make sure to|be sure to)\b/i,
    /\b(?:let's|let me|allow me to)\b/i
  ];
  
  for (const pattern of fillerPhrases) {
    cleanName = cleanName.replace(pattern, ' ');
  }

  // Remove priority indicators
  const priorityPatterns = [
    /\b(?:urgent|asap|immediately|highest|critical|top priority|due soon|time sensitive)\b/i,
    /\b(?:important|medium priority|significant|key|essential)\b/i,
    /\b(?:low priority|whenever|not urgent|can wait|someday|eventually|not important)\b/i
  ];
  
  for (const pattern of priorityPatterns) {
    cleanName = cleanName.replace(pattern, ' ');
  }
  
  // Cleanup multiple spaces
  cleanName = cleanName.replace(/\s{2,}/g, ' ').trim();
  
  // If task name is too short after cleanup, use a more intelligent approach
  if (cleanName.length < 5) {
    // Identify the core verb-noun structure
    const mainContent = task.name.match(/\b((?:re-?)?(?:write|read|finish|update|clean|call|email|schedule|watch|research|buy|pick|backup|brainstorm))\b.+?(?=\b(?:by|due|before|until|for|on|using|with|in|at)\b|\.|$)/i);
    
    if (mainContent) {
      cleanName = mainContent[0].trim();
    } else {
      // Fall back to first sentence
      cleanName = task.name.split(/[.!?]/)[0].trim();
    }
  }
  
  // Capitalize first letter and ensure the task name doesn't end with a punctuation
  cleanName = cleanName.charAt(0).toUpperCase() + cleanName.slice(1).toLowerCase();
  cleanName = cleanName.replace(/[.!?:;,]$/, '');
  
  task.name = cleanName;
}