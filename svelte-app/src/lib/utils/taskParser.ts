// src/lib/utils/taskParser.ts
import { parse } from 'date-fns';

interface ParsedTask {
  id: string;
  name: string;
  priority: 'high' | 'medium' | 'low';
  due_date: string | null;
  status: 'not-started' | 'in-progress' | 'completed';
  resources: string[];
  blocked_by: string[];
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

  // Extract time (7:30AM, 7:30 AM, etc.)
  const timeRegex = /(\d{1,2}:\d{2}\s?(?:AM|PM))?\b/i;
  const timeMatch = text.match(timeRegex);
  
  if (timeMatch) {
    const timeString = timeMatch[0];
    try {
      // Try different time formats
      const formats = ['h:mma', 'h:mm a', 'HH:mm'];
      for (const format of formats) {
        const parsedDate = parse(timeString, format, new Date());
        if (!isNaN(parsedDate.getTime())) {
          task.due_date = parsedDate.toISOString();
          task.name = task.name.replace(timeString, '').replace(/\s*,\s*$/, '').trim();
          break;
        }
      }
    } catch (e) {
      console.warn('Failed to parse time:', timeString);
    }
  }

  // Extract priority
  if (/\b(due|urgent|asap)\b/i.test(task.name)) {
    task.priority = 'high';
  } else if (/\bimportant\b/i.test(task.name)) {
    task.priority = 'medium';
  }

  // Extract status
  if (/\balmost|halfway|partially\b/i.test(task.name)) {
    task.status = 'in-progress';
  } else if (/\bfinished|completed|done\b/i.test(task.name)) {
    task.status = 'completed';
  }

  // Extract resources (needs delta math, using calculator, etc.)
  const resourceMatch = task.name.match(/(?:need|using|with|require)\s+(?:a\s+)?([a-z0-9]+(?:\s+[a-z0-9]+)*)/i);
  if (resourceMatch) {
    task.resources = [resourceMatch[1].trim()];
    task.name = task.name.replace(resourceMatch[0], '').trim();
  }

  // Clean up task name
  task.name = task.name
    .replace(/\b(due|at|needs?|requires?|using|with)\b/gi, '')
    .replace(/,+/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return task;
}