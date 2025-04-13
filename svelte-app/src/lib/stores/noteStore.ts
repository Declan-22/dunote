// src/lib/stores/noteStore.ts
import { writable } from 'svelte/store';
import { supabase } from '$lib/supabaseClient';

export interface Note {
  id: string;
  title: string;
  content: string;
  tags: string[];
  attachedNodes: Array<{ id: string; title: string }>;
  created_at: string;
  updated_at: string;
  user_id?: string;
  node_id?: string;
}

interface Node {
  id: string;
  title: string;
}

function createNoteStore() {
  const { subscribe, set, update } = writable<Note[]>([]);

  return {
    subscribe,
    set,
    update, // Expose the underlying update function
    
    async loadNotes(userId: string) {
      const { data, error } = await supabase
        .from('notes')
        .select('*, attachedNodes:node_id (id, title)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      if (!error) set(data || []);
    },

    async saveNote(note: Note) {
      const noteToSave = {
        ...note,
        // Flatten attachedNodes for Supabase storage
        node_id: note.attachedNodes.length > 0 ? note.attachedNodes[0].id : null
      };

      const { data, error } = await supabase
        .from('notes')
        .upsert(noteToSave)
        .select('*, attachedNodes:node_id (id, title)')
        .single();

      if (!error) {
        update(notes => notes.map(n => n.id === note.id ? data : n));
      }
      return data;
    },

    createNewNote(): Note {
      return {
        id: `draft-${Date.now()}`,
        title: '',
        content: '',
        tags: [],
        attachedNodes: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    },

    async deleteNote(id: string) {
      await supabase.from('notes').delete().eq('id', id);
      update(notes => notes.filter(n => n.id !== id));
    },

    // Specific update functions for common operations
    updateNoteContent(id: string, content: string) {
      update(notes => notes.map(note => 
        note.id === id 
          ? { ...note, content, updated_at: new Date().toISOString() } 
          : note
      ));
    },

    updateNoteTitle(id: string, title: string) {
      update(notes => notes.map(note => 
        note.id === id 
          ? { ...note, title, updated_at: new Date().toISOString() } 
          : note
      ));
    },

    addTagToNote(id: string, tag: string) {
      update(notes => notes.map(note => {
        if (note.id === id && !note.tags.includes(tag)) {
          return { 
            ...note, 
            tags: [...note.tags, tag],
            updated_at: new Date().toISOString()
          };
        }
        return note;
      }));
    },

    removeTagFromNote(id: string, tag: string) {
      update(notes => notes.map(note => {
        if (note.id === id) {
          return { 
            ...note, 
            tags: note.tags.filter(t => t !== tag),
            updated_at: new Date().toISOString()
          };
        }
        return note;
      }));
    },

    attachNodeToNote(noteId: string, node: Node) {
      update(notes => notes.map(note => {
        if (note.id === noteId && !note.attachedNodes.some(n => n.id === node.id)) {
          return { 
            ...note, 
            attachedNodes: [...note.attachedNodes, node],
            updated_at: new Date().toISOString()
          };
        }
        return note;
      }));
    },

    detachNodeFromNote(noteId: string, nodeId: string) {
      update(notes => notes.map(note => {
        if (note.id === noteId) {
          return { 
            ...note, 
            attachedNodes: note.attachedNodes.filter(n => n.id !== nodeId),
            updated_at: new Date().toISOString()
          };
        }
        return note;
      }));
    }
  };
}
// In noteStore.ts
async function saveNote(note: Note) {
    const noteToSave = {
      ...note,
      content: note.content || '',
      title: note.title || 'Untitled',
      ts_vector: note.title + ' ' + note.content // For full-text search
    };
  
    const { data, error } = await supabase
      .from('notes')
      .upsert(noteToSave)
      .select()
      .single();
  
    if (!error) {
      await supabase.rpc('update_note_tsvector', { note_id: data.id });
    }
    return data;
  }
  
  // Create SQL function for search:
  /*
  create or replace function update_note_tsvector(note_id uuid)
  returns void as $$
  begin
    update notes
    set ts_vector = to_tsvector('english', title || ' ' || content)
    where id = note_id;
  end;
  $$ language plpgsql;
  */


  
export const noteStore = createNoteStore();