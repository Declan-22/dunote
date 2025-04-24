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

  // Normalize text for easier parsing
  const normalizedText = text.toLowerCase();

  // Extract due dates with better recognition
  extractDueDate(normalizedText, task);
  
  // Extract priority with enhanced recognition
  extractPriority(normalizedText, task);
  
  // Extract status with better contextual understanding
  extractStatus(normalizedText, task);
  
  // Extract resources needed
  extractResources(normalizedText, task);
  
  // Extract dependencies (blocked by)
  extractBlockers(normalizedText, task);

  // Clean up task name by removing extracted information
  cleanTaskName(task);

  return task;
}

function extractDueDate(text: string, task: ParsedTask): void {
  // Common date patterns
  const datePatterns = [
    // Today, tomorrow, day after tomorrow
    {
      regex: /\b(today|tomorrow|(?:day after tomorrow))\b/i,
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
    
    // Next Monday, this Friday, etc.
    {
      regex: /\b(this|next)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
      handler: (match: RegExpMatchArray) => {
        const today = new Date();
        const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
          .indexOf(match[2].toLowerCase());
        
        if (dayOfWeek !== -1) {
          let daysToAdd = (dayOfWeek - today.getDay() + 7) % 7;
          
          // If "this" day is mentioned and it's already past that day this week, 
          // or if "next" is explicitly mentioned, add 7 days
          if (match[1].toLowerCase() === 'next' || 
             (match[1].toLowerCase() === 'this' && daysToAdd === 0)) {
            daysToAdd += 7;
          }
          
          return addDays(today, daysToAdd);
        }
        return null;
      }
    },
    
    // "Due in X days/weeks"
    {
      regex: /\bdue\s+in\s+(\d+)\s+(day|week)s?\b/i,
      handler: (match: RegExpMatchArray) => {
        const amount = parseInt(match[1]);
        const unit = match[2].toLowerCase();
        
        if (!isNaN(amount)) {
          const today = new Date();
          if (unit === 'day') {
            return addDays(today, amount);
          } else if (unit === 'week') {
            return addDays(today, amount * 7);
          }
        }
        return null;
      }
    },
    
    // Due on April 15, Due 4/15, etc.
    {
      regex: /\bdue\s+(?:on\s+)?([a-z]+\s+\d{1,2}|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\b/i,
      handler: (match: RegExpMatchArray) => {
        const dateStr = match[1];
        
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
          if (isValid(parsedDate)) return parsedDate;
        } catch (e) { /* Continue to next format */ }
        
        try {
          const parsedDate = parse(dateStr, 'MMM d', new Date());
          if (isValid(parsedDate)) return parsedDate;
        } catch (e) { /* Continue to next format */ }
        
        return null;
      }
    },
    
    // Time patterns (8PM, 8:30PM, etc.)
    {
      regex: /\b(\d{1,2}(?::\d{2})?\s*(?:am|pm))\b/i,
      handler: (match: RegExpMatchArray) => {
        const timeStr = match[1].replace(/\s+/g, '');
        try {
          // Try different time formats
          const formats = ['h:mma', 'ha'];
          for (const format of formats) {
            try {
              const today = new Date();
              const parsedTime = parse(timeStr, format, today);
              if (isValid(parsedTime)) return parsedTime;
            } catch (e) { /* Try next format */ }
          }
        } catch (e) { /* Ignore parsing errors */ }
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
        break;
      }
    }
  }
}

function extractPriority(text: string, task: ParsedTask): void {
  // High priority indicators
  if (/\b(urgent|asap|immediately|highest|critical|top priority|due soon|time sensitive)\b/i.test(text)) {
    task.priority = 'high';
  }
  // Medium priority indicators
  else if (/\b(important|medium priority|significant|key|essential)\b/i.test(text)) {
    task.priority = 'medium';
  }
  // Low priority indicators
  else if (/\b(low priority|whenever|not urgent|can wait|someday|eventually|not important)\b/i.test(text)) {
    task.priority = 'low';
  }
  
  // Context-based priority detection
  if (task.due_date) {
    const today = new Date();
    const dueDate = parseISO(task.due_date);
    
    // If due today or tomorrow, bump to high priority unless explicitly set as low
    if (text.includes('low') || text.includes('not urgent')) {
      // Don't override explicit low priority
    } else {
      const diffTime = dueDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays <= 1) {
        task.priority = 'high';
      } else if (diffDays <= 3 && task.priority !== 'high') {
        task.priority = 'medium';
      }
    }
  }
}

function extractStatus(text: string, task: ParsedTask): void {
  // Completed status indicators
  if (/\b(finished|completed|done|wrapped up|delivered|submitted|turned in)\b/i.test(text)) {
    task.status = 'completed';
  }
  // In progress indicators
  else if (/\b(started|beginning|in progress|working on|half|partial|halfway|almost|began|continuing|ongoing|resume)\b/i.test(text)) {
    task.status = 'in-progress';
  }
  // Not started indicators
  else if (/\b(need to|haven't started|not started|to begin|will start|plan to|going to)\b/i.test(text)) {
    task.status = 'not-started';
  }
}

function extractResources(text: string, task: ParsedTask): void {
  // Resources needed patterns
  const resourcePatterns = [
    // "Using X", "With X", "Need X", "Requires X"
    /(?:using|with|need|needs|requiring|requires?)\s+(?:a\s+)?([a-z0-9]+(?: [a-z0-9]+)*)/i,
    
    // "X is required", "X is needed" 
    /([a-z0-9]+(?: [a-z0-9]+)*)\s+(?:is|are)\s+(?:required|needed)/i
  ];

  for (const pattern of resourcePatterns) {
    const match = text.match(pattern);
    if (match) {
      // Clean up resource name - remove common articles and fillers
      const resource = match[1].replace(/^(a|an|the)\s+/i, '').trim();
      if (resource && !task.resources.includes(resource)) {
        task.resources.push(resource);
      }
    }
  }
}

function extractBlockers(text: string, task: ParsedTask): void {
  // Blocked by patterns
  const blockerPatterns = [
    // "After X", "Depends on X", "Blocked by X", "Waiting for X"
    /(?:after|depends on|blocked by|waiting for|following|can't start until)\s+([a-z0-9]+(?: [a-z0-9]+)*)/i,
    
    // "Can't do until X is done", "Need X to be finished first"
    /(?:can't do until|need)\s+([a-z0-9]+(?: [a-z0-9]+)*)\s+(?:to be|is)\s+(?:done|finished|completed)/i
  ];

  for (const pattern of blockerPatterns) {
    const match = text.match(pattern);
    if (match) {
      const blocker = match[1].trim();
      if (blocker && !task.blocked_by.includes(blocker)) {
        task.blocked_by.push(blocker);
      }
    }
  }
}

function cleanTaskName(task: ParsedTask): void {
  let cleanName = task.name;
  
  // Remove date/time phrases
  const dateTimePatterns = [
    /\b(?:due|at|on|by)\s+(?:today|tomorrow|(?:day after tomorrow))\b/i,
    /\b(?:due|at|on|by)\s+(?:this|next)\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
    /\bdue\s+(?:on|by)?\s+(?:[a-z]+\s+\d{1,2}|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\b/i,
    /\bdue\s+in\s+\d+\s+(?:day|week)s?\b/i,
    /\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/i
  ];
  
  // Remove priority indicators
  const priorityPatterns = [
    /\b(?:urgent|asap|immediately|highest|critical|top priority|due soon|time sensitive)\b/i,
    /\b(?:important|medium priority|significant|key|essential)\b/i,
    /\b(?:low priority|whenever|not urgent|can wait|someday|eventually|not important)\b/i
  ];
  
  // Remove status indicators - these should be more aggressive
  const statusPatterns = [
    /\b(?:finished|completed|done|wrapped up|delivered|submitted|turned in)\b/i,
    /\b(?:started|beginning|in progress|working on|half|partial|halfway|almost|began|continuing|ongoing|resume)\b/i,
    /\b(?:need to|haven't started|not started|to begin|will start|plan to|going to)\b/i,
    // More aggressive patterns for removing sentences about status
    /\balready started it\b.*$/i,
    /\bI already\b.*$/i,
    /\balready\b.*$/i,
    /\bhave\s+(?:little|some|no)?\s*time\s+(?:left|remaining).*$/i,
    /\bbut\b.*$/i,  // Often introduces status information after the main task
    /\bI\s+(?:have|need|want|must)\b.*$/i
  ];
  
  // Remove resource patterns
  const resourcePatterns = [
    /(?:using|with|need|needs|requiring|requires?)\s+(?:a\s+)?([a-z0-9]+(?: [a-z0-9]+)*)/i,
    /([a-z0-9]+(?: [a-z0-9]+)*)\s+(?:is|are)\s+(?:required|needed)/i
  ];
  
  // Remove blocker patterns
  const blockerPatterns = [
    /(?:after|depends on|blocked by|waiting for|following|can't start until)\s+([a-z0-9]+(?: [a-z0-9]+)*)/i,
    /(?:can't do until|need)\s+([a-z0-9]+(?: [a-z0-9]+)*)\s+(?:to be|is)\s+(?:done|finished|completed)/i
  ];
  
  // Common phrases that should be removed but aren't task metadata
  const fillerPhrases = [
    /\bI need to\b/i,
    /\bI have to\b/i,
    /\bI must\b/i,
    /\bI should\b/i,
    /\bI want to\b/i,
    /\bhelp me\b/i,
    /\bplease\b/i,
    /\bremind me to\b/i,
    /\bdon't forget to\b/i,
  ];
  
  // Apply all removal patterns
  const allPatterns = [
    ...dateTimePatterns,
    ...priorityPatterns,
    ...statusPatterns,
    ...resourcePatterns,
    ...blockerPatterns,
    ...fillerPhrases
  ];
  
  for (const pattern of allPatterns) {
    cleanName = cleanName.replace(pattern, '');
  }
  
  // Remove common personal pronouns and articles
  cleanName = cleanName
    .replace(/\b(?:the|a|an|my|our|your|their|his|her|its|I|we|you|they|he|she|it)\b/gi, '')
    .replace(/\b(?:for|to|in|on|at|by|with|from|about|as|into|of)\b/gi, '') // Common prepositions
    .replace(/\b(?:need|have|must|should|would|could|can|will|shall|may|might)\b/gi, '') // Modal/auxiliary verbs
    .replace(/\b(?:only|just|very|really|quite|pretty|so|too|also|then|now)\b/gi, '') // Common adverbs
    .replace(/,|\.|\!|\?|;|:|\(|\)|\[|\]|\{|\}|"|'|`|\/|\\/g, '') // All punctuation
    .replace(/\s{2,}/g, ' ') // Multiple spaces
    .trim();
  
  // Check for complete sentences and try to extract just the subject/task part
  // Look for first few words before conjunctions or personal pronouns
  const conjunctions = /\b(?:and|but|or|because|since|if|although|though|unless|due|until|while)\b/i;
  const match = cleanName.match(conjunctions);
  if (match && match.index && match.index > 3) { // At least a few characters before conjunction
    cleanName = cleanName.substring(0, match.index).trim();
  }
  
  // If task name becomes too short after cleanup or empty, extract key nouns
  if (cleanName.length < 3) {
    // Extract key nouns - usually subject + object combinations
    // Start by splitting the original text into words
    const words = task.name.split(/\s+/);
    
    // Look for common academic/task subjects
    const subjectMatches = task.name.match(/\b(?:math|algebra|geometry|calculus|physics|chemistry|biology|history|english|essay|report|presentation|homework|hw|assignment|project|exam|test|quiz|reading|writing|lab|exercise|problem set|research|study|review)\b/i);
    
    if (subjectMatches) {
      // If we find a subject, use that plus 1-2 words around it
      const subjectIndex = words.findIndex(word => 
        word.toLowerCase() === subjectMatches[0].toLowerCase());
      
      if (subjectIndex >= 0) {
        // Take the subject and up to 2 words before and after
        const start = Math.max(0, subjectIndex - 2);
        const end = Math.min(words.length, subjectIndex + 3);
        cleanName = words.slice(start, end).join(' ');
      }
    } else {
      // If no specific subject found, just take the first 2-3 words
      // This is often the core task description
      cleanName = words.slice(0, Math.min(3, words.length)).join(' ');
    }
  }
  
  // Final cleanup of any lingering issues
  cleanName = cleanName
    .replace(/^\s*(?:to|and|but|or|for|the)\s+/i, '') // Remove leading conjunctions/prepositions
    .replace(/\s+(?:to|and|but|or|for|the)\s*$/i, '') // Remove trailing conjunctions/prepositions
    .trim();
  
  task.name = cleanName;
}