export enum SiloType {
    PROJECT = 'project',
    AREA = 'area',
    RESOURCE = 'resource',
    INBOX = 'inbox'
  }
  
  export interface Silo {
    id: string;
    name: string;
    description: string;
    color: string;
    parent_id: string | null;
    children: string[];
    tasks: string[];
    icon: string | null;
    created_at: string;
    updated_at: string;
    type?: SiloType;
  }
  
  export interface SiloCreateRequest {
    name: string;
    description?: string;
    color?: string;
    parent_id?: string | null;
    icon?: string | null;
  }
  
  export interface SiloUpdateRequest {
    name?: string;
    description?: string;
    color?: string;
    parent_id?: string | null;
    icon?: string | null;
  }