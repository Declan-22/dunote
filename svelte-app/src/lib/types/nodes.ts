// Define node categories
export const NODE_CATEGORIES = {
  CORE: 'Core Nodes',
  FUNCTION: 'Function Nodes',
  TRIGGER: 'Trigger Nodes',
  CREDENTIAL: 'Credential Nodes',
  ADVANCED: 'Advanced Nodes'
};

// Define node types
export type NodeType = 
  // Core nodes
  'resource' | 'task' | 'milestone' | 'project' | 'output' |
  // Function nodes
  'extract' | 'summarize' | 'transform' | 
  // Trigger nodes
  'webhook' | 'schedule' | 'event' |
  // Credential nodes
  'apiKey' | 'oauth' |
  // Advanced nodes
  'code' | 'condition';

// Define node icons and metadata
export const NODE_TYPES: Record<NodeType, { 
  name: string, 
  icon: string,
  category: string,
  description?: string
}> = {
  // Core Nodes
  'resource': { 
    name: 'Resource',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"></path></svg>',
    category: NODE_CATEGORIES.CORE,
    description: 'Store and reference external content'
  },
  'task': {
    name: 'Task',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"></rect><path d="m9 12 2 2 4-4"></path></svg>',
    category: NODE_CATEGORIES.CORE,
    description: 'Track actionable items and assignments'
  },
  'milestone': {
    name: 'Milestone',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 6v6l4 2"></path></svg>',
    category: NODE_CATEGORIES.CORE,
    description: 'Mark significant project achievements'
  },

  'project': {
    name: 'Project',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3h18v18H3V3z"></path><path d="M9 3v18"></path><path d="M3 9h18"></path></svg>',
    category: NODE_CATEGORIES.CORE,
    description: 'Organize and manage project components'
  },

  'output': {
    name: 'Output',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 17l5-5-5-5"></path><path d="M12 12h10"></path><path d="M3 4v16"></path></svg>',
    category: NODE_CATEGORIES.CORE,
    description: 'Generate final results or reports'
  },

  // Function Nodes
  'extract': {
    name: 'Extract Quotes',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10h18"></path><path d="M3 14h18"></path><path d="m8 18 4 4 4-4"></path><path d="m16 6-4-4-4 4"></path></svg>',
    category: NODE_CATEGORIES.FUNCTION,
    description: 'Extract relevant quotes from resources based on thesis'
  },
  'summarize': {
    name: 'Summarize',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>',
    category: NODE_CATEGORIES.FUNCTION,
    description: 'Generate concise summaries from resources'
  },
  'transform': {
    name: 'Transform',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"></path><path d="M13 13h6"></path><path d="M16 16v-6"></path></svg>',
    category: NODE_CATEGORIES.FUNCTION,
    description: 'Convert data between different formats'
  },
  
  // Trigger Nodes
  'webhook': {
    name: 'Webhook',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>',
    category: NODE_CATEGORIES.TRIGGER,
    description: 'Trigger flows from external HTTP requests'
  },
  'schedule': {
    name: 'Schedule',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>',
    category: NODE_CATEGORIES.TRIGGER,
    description: 'Trigger flows at scheduled intervals'
  },
  'event': {
    name: 'Event',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>',
    category: NODE_CATEGORIES.TRIGGER,
    description: 'Trigger flows based on system events'
  },
  
  // Credential Nodes
  'apiKey': {
    name: 'API Key',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>',
    category: NODE_CATEGORIES.CREDENTIAL,
    description: 'Store and manage API keys securely'
  },
  'oauth': {
    name: 'OAuth',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"></path></svg>',
    category: NODE_CATEGORIES.CREDENTIAL,
    description: 'Handle OAuth authentication flows'
  },
  
  // Advanced Nodes
  'code': {
    name: 'Code',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m18 16 4-4-4-4"></path><path d="m6 8-4 4 4 4"></path><path d="m14.5 4-5 16"></path></svg>',
    category: NODE_CATEGORIES.ADVANCED,
    description: 'Run custom code snippets'
  },
  'condition': {
    name: 'Condition',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2h8"></path><path d="M4 6h16"></path><path d="M2 10h20"></path><path d="M14 18h2"></path><path d="M8 18h2"></path><path d="M16 22h2"></path><path d="M6 22h2"></path><path d="m22 14-4.5 4.5"></path><path d="m21 18.5-4.5-4.5"></path><path d="m2 14 4.5 4.5"></path><path d="m2.5 18.5 4.5-4.5"></path><path d="M12 22v-6.5"></path></svg>',
    category: NODE_CATEGORIES.ADVANCED,
    description: 'Create conditional logic branches'
  }
};