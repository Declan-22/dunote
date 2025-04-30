// src/lib/stores/noteStore.ts
import { writable } from 'svelte/store';
import { supabase } from '$lib/supabaseClient';
import { user } from '$lib/stores/userStore';
import { get } from 'svelte/store';

export interface Node {
  id: string;
  type: string;
  position: any;
  data: any;
  siloId?: string;
  title?: string;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  tags: string[];
  created_at: string;
  updated_at: string;
  user_id: string;
  ts_vector?: string;
  nodes?: Partial<Node>[];
  node_id?: string;
  attachedNodes?: any[];
}

function createNoteStore() {
  const { subscribe, set, update } = writable<Note[]>([]);
  
  // Get current user id helper
  const getCurrentUserId = () => {
    const currentUser = get(user);
    return currentUser?.id;
  };

  return {
    subscribe,
    set,
    update,

    async loadNotes(page = 1, itemsPerPage = 20): Promise<Note[]> {
      const userId = getCurrentUserId();
      
      // If not authenticated, return empty array or cached notes
      if (!userId) {
        console.log('No user ID found, returning empty notes array');
        return [];
      }
      
      const { data, error } = await supabase
        .from('notes')
        .select(`
          *,
          note_nodes(
            node_id,
            nodes:node_id(id, title)
          )
        `)
        .eq('user_id', userId) // Filter notes by user_id
        .order('created_at', { ascending: false });
    
      if (error) {
        console.error('Error loading notes:', error);
        return [];
      }
    
      return data?.map(note => ({
        ...note,
        attachedNodes: note.note_nodes?.map((conn: any) => conn.nodes) || []
      })) || [];
    },

    async loadNoteById(id: string) {
      const userId = getCurrentUserId();
      
      const { data, error } = await supabase
        .from('notes')
        .select(`
          *,
          note_nodes:note_nodes (
            node:node_id (id, type, position, data, siloId)
          )
        `)
        .eq('id', id)
        .eq('user_id', userId) // Only fetch if it belongs to the user
        .single();

      if (error) return null;

      return {
        ...data,
        nodes: (data as any).note_nodes?.map(({ node }: { node: Partial<Node> }) => ({
          id: node.id,
          type: node.type,
          position: node.position,
          data: node.data,
          siloId: node.siloId
        })) ?? []
      };
    },

    async createNewNote(): Promise<Note> {
      const userId = getCurrentUserId();
      
      // If not authenticated, create a local temporary note
      if (!userId) {
        return {
          id: `temp-${Date.now()}`,
          title: 'Untitled Note',
          content: '',
          tags: [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          user_id: '',
          attachedNodes: []
        };
      }
      
      try {
        const { data, error } = await supabase
          .from('notes')
          .insert({ 
            title: 'Untitled Note',
            user_id: userId // Set the user_id field
          })
          .select()
          .single();
    
        if (error) throw error;
        return data;
      } catch (error) {
        console.error('Note creation failed:', error);
        throw error;
      }
    },

    async saveNote(note: Partial<Note>) {
      const userId = getCurrentUserId();
      
      // If not authenticated, don't save to database
      if (!userId) {
        console.warn('Cannot save note: User not authenticated');
        return note as Note;
      }
      
      // Create a clean copy without virtual properties
      const { attachedNodes, nodes, ...noteToSave } = note;
      
      // Ensure the note has the current user's ID
      noteToSave.user_id = userId;
      
      // Save just the note data
      const { data, error } = await supabase
        .from('notes')
        .upsert(noteToSave)
        .select()
        .single();
    
      if (error) throw error;
      return data;
    },

    async getNoteById(id: string): Promise<Note | null> {
      const userId = getCurrentUserId();
      
      // If the ID starts with 'temp-', it's a local note
      if (id.startsWith('temp-')) {
        // Return cached local note if available
        return null;
      }
      
      const { data, error } = await supabase
        .from('notes')
        .select()
        .eq('id', id)
        .eq('user_id', userId) // Only fetch if it belongs to the user
        .single();
    
      if (error) return null;
      return data;
    },

    async deleteNote(id: string): Promise<void> {
      const userId = getCurrentUserId();
      
      // If the ID starts with 'temp-', it's a local note
      if (id.startsWith('temp-')) {
        // Remove from local cache
        noteStore.update(notes => notes.filter(n => n.id !== id));
        return;
      }
      
      // Only delete if user is authenticated and note belongs to user
      if (!userId) {
        console.warn('Cannot delete note: User not authenticated');
        return;
      }
      
      const { error } = await supabase
        .from('notes')
        .delete()
        .eq('id', id)
        .eq('user_id', userId); // Only delete if it belongs to the user
    
      if (error) throw error;
      noteStore.update(notes => notes.filter(n => n.id !== id));
    },

    async attachNodeToNote(noteId: string, nodeId: string) {
      const userId = getCurrentUserId();
      
      // If not authenticated, don't proceed
      if (!userId || noteId.startsWith('temp-')) {
        console.warn('Cannot attach node: User not authenticated or temporary note');
        return false;
      }
      
      const { error } = await supabase
        .from('note_nodes')
        .insert({ note_id: noteId, node_id: nodeId });
    
      if (!error) {
        update(notes => notes.map(n => 
          n.id === noteId ? {
            ...n,
            attachedNodes: [...(n.attachedNodes || []), nodeId]
          } : n
        ));
        return true;
      }
      return false;
    },
    
    async loadNoteWithNodes(id: string): Promise<Note | null> {
      const userId = getCurrentUserId();
      
      // If the ID starts with 'temp-', it's a local note
      if (id.startsWith('temp-')) {
        // Return cached local note
        return null;
      }
      
      // If not authenticated, don't proceed
      if (!userId) {
        console.warn('Cannot load note with nodes: User not authenticated');
        return null;
      }
      
      const { data, error } = await supabase
        .from('notes')
        .select('*, attachedNodes:note_nodes ( nodes ( id, title ) )')
        .eq('id', id)
        .eq('user_id', userId) // Only fetch if it belongs to the user
        .single();
    
      if (error) return null;
      
      return {
        ...data,
        attachedNodes: (data.attachedNodes as { nodes: any }[])?.map((an: { nodes: any }) => an.nodes) || []
      };
    },

    async attachNode(noteId: string, nodeId: string) {
      const userId = getCurrentUserId();
      
      // If not authenticated, don't proceed
      if (!userId || noteId.startsWith('temp-')) {
        console.warn('Cannot attach node: User not authenticated or temporary note');
        return false;
      }
      
      const { error } = await supabase
        .from('note_nodes')
        .insert({ note_id: noteId, node_id: nodeId });

      if (!error) {
        update(notes => notes.map(note => {
          if (note.id === noteId) {
            const existingNodes = note.nodes || [];
            return {
              ...note,
              nodes: [...existingNodes, { id: nodeId }]
            };
          }
          return note;
        }));
        return true;
      }
      return false;
    },

    async detachNode(noteId: string, nodeId: string) {
      const userId = getCurrentUserId();
      
      // If not authenticated, don't proceed
      if (!userId || noteId.startsWith('temp-')) {
        console.warn('Cannot detach node: User not authenticated or temporary note');
        return false;
      }
      
      const { error } = await supabase
        .from('note_nodes')
        .delete()
        .eq('note_id', noteId)
        .eq('node_id', nodeId);

      if (!error) {
        update(notes => notes.map(note => {
          if (note.id === noteId && note.nodes) {
            return {
              ...note,
              nodes: note.nodes.filter(n => n.id !== nodeId)
            };
          }
          return note;
        }));
        return true;
      }
      return false;
    },

    async searchNotes(query: string): Promise<Note[]> {
      const userId = getCurrentUserId();
      
      // If not authenticated, return empty array
      if (!userId) {
        console.warn('Cannot search notes: User not authenticated');
        return [];
      }
      
      const { data, error } = await supabase
        .from('notes')
        .select()
        .eq('user_id', userId) // Filter by user_id
        .or(`title.ilike.%${query}%,content.ilike.%${query}%,tags.cs.{${query}}`)
        .order('updated_at', { ascending: false });
    
      if (error) {
        console.error('Error searching notes:', error);
        return [];
      }
      
      return data || [];
    }
  };
}

export const noteStore = createNoteStore();

export const createNewNote = async (): Promise<Note> => {
  const currentUser = get(user);
  
  return {
    id: '',
    title: '',
    content: '',
    tags: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    nodes: [],
    user_id: currentUser?.id || ''
  };
};