// src/lib/stores/noteStore.ts
import { writable } from 'svelte/store';
import { supabase } from '$lib/supabaseClient';
import type { Node } from '$lib/types/nodes';

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
  attachedNodes?: string[];
}

function createNoteStore() {
  const { subscribe, set, update } = writable<Note[]>([]);

  return {
    subscribe,
    set,
    update,

    async loadNotes(page = 1, itemsPerPage = 20): Promise<Note[]> {
      const { data, error } = await supabase
      .from('notes')
      .select(`
        *,
        attachedNodes:note_nodes(
          node_id,
          nodes!inner(id, title)
        )
      `)
      .order('created_at', { ascending: false });
  
    return data?.map(note => ({
      ...note,
      attachedNodes: note.attachedNodes?.map((conn: { nodes: any }) => conn.nodes) || []
    })) || [];
  },

    async loadNoteById(id: string) {
      const { data, error } = await supabase
        .from('notes')
        .select(`
          *,
          note_nodes:note_nodes (
            node:node_id (id, type, position, data, siloId)
          )
        `)
        .eq('id', id)
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
      try {
        const { data, error } = await supabase
          .from('notes')
          .insert({ title: 'Untitled Note' })
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
      const { data, error } = await supabase
        .from('notes')
        .upsert(note)
        .select()
        .single();
    
      if (error) throw error;
      return data;
    },

    async getNoteById(id: string): Promise<Note | null> {
      const { data, error } = await supabase
        .from('notes')
        .select()
        .eq('id', id)
        .single();
    
      if (error) return null;
      return data;
    },

    async deleteNote(id: string): Promise<void> {
      const { error } = await supabase
        .from('notes')
        .delete()
        .eq('id', id);
    
      if (error) throw error;
      noteStore.update(notes => notes.filter(n => n.id !== id));
    },

    async attachNodeToNote(noteId: string, nodeId: string) {
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
      }
    },
    
    async loadNoteWithNodes(id: string): Promise<Note> {
      const { data, error } = await supabase
        .from('notes')
        .select('*, attachedNodes:note_nodes ( nodes ( id, title ) )')
        .eq('id', id)
        .single();
    
      if (error) throw error;
      return {
        ...data,
        attachedNodes: (data.attachedNodes as { nodes: any }[]).map((an: { nodes: any }) => an.nodes)
      };
    },

    async attachNode(noteId: string, nodeId: string) {
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
      }
      return !error;
    },

    async detachNode(noteId: string, nodeId: string) {
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
      }
      return !error;
    },

    async searchNotes(query: string): Promise<Note[]> {
      const { data, error } = await supabase
        .from('notes')
        .select()
        .or(`title.ilike.%${query}%,content.ilike.%${query}%,tags.cs.{${query}}`)
        .order('updated_at', { ascending: false });
    
      if (error) throw error;
      return data;
    }
  };
}

export const noteStore = createNoteStore();

export const createNewNote = async (): Promise<Note> => {
  return {
    id: '',
    title: '',
    content: '',
    tags: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    nodes: [],
    user_id: ''
  };
};