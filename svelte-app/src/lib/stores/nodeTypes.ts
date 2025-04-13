export type NodeType = 
  | 'project'
  | 'task'
  | 'dependency'
  | 'milestone'
  | 'resource'
  | 'team'
  | 'deadline'
  | 'output';

export interface NodeStyle {
  icon: string;
  color: string;
  bgClass: string;
  borderClass: string;
  name: string;
  description?: string;
}

export const NODE_TYPES: Record<NodeType, NodeStyle> = {
  project: { 
    icon: `<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" fill="none">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
          </svg>`,
    color: '#3B82F6',
    bgClass: 'bg-blue-100',
    borderClass: 'border-blue-400',
    name: 'Project'
  },
  task: { 
    icon: `<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" fill="none">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h3.75m-3.75 3h3.75m-3.75 3h3.75M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>`,
    color: '#10B981',
    bgClass: 'bg-green-100',
    borderClass: 'border-green-400',
    name: 'Task'
  },
  dependency: { 
    icon: `<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" fill="none">
            <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
          </svg>`,
    color: '#8B5CF6',
    bgClass: 'bg-purple-100',
    borderClass: 'border-purple-400',
    name: 'Dependency'
  },
  milestone: { 
    icon: `<svg xmlns="http://www.w3.org2000/svg" class="w-5 h-5" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" fill="none">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>`,
    color: '#F59E0B',
    bgClass: 'bg-yellow-100',
    borderClass: 'border-yellow-400',
    name: 'Milestone'
  },
  resource: { 
    icon: `<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" fill="none">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375H18m-7.5 4.5v.75m3-3.75v.75m3-3.75v.75m3-3.75v.75" />
          </svg>`,
    color: '#EC4899',
    bgClass: 'bg-pink-100',
    borderClass: 'border-pink-400',
    name: 'Resource'
  },
  team: { 
    icon: `<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" fill="none">
            <path stroke-linecap="round" stroke-linejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
          </svg>`,
    color: '#14B8A6',
    bgClass: 'bg-teal-100',
    borderClass: 'border-teal-400',
    name: 'Team'
  },
  deadline: { 
    icon: `<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" fill="none">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
          </svg>`,
    color: '#EF4444',
    bgClass: 'bg-red-100',
    borderClass: 'border-red-400',
    name: 'Deadline'
  },
  output: { 
    icon: `<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" fill="none">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>`,
    color: '#64748B',
    bgClass: 'bg-gray-100',
    borderClass: 'border-gray-400',
    name: 'Output'
  }
};