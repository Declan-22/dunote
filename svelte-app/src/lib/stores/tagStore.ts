

import { writable } from 'svelte/store';
import { supabase } from '$lib/supabaseClient';
import { noteStore, } from '$lib/stores/noteStore';

// Create a store for all tags
export const allTagsStore = writable([]);
const isValidUUID = (uuid: string) => {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid);
  };

// Function to get tags for a specific note
export async function getNoteTagsByNoteId(noteId: string): Promise<string[]> {
    try {
      if (!noteId) {
        throw new Error('Missing note ID');
      }
      
      const { data, error } = await supabase
        .from('note_tags')
        .select('tag_name')
        .eq('note_id', noteId)
        .order('created_at', { ascending: true });
  
      if (error) {
        console.error('Supabase error:', error);
        throw new Error('Failed to fetch tags');
      }
  
      return data.map(item => item.tag_name);
    } catch (error) {
      console.error('Error in getNoteTagsByNoteId:', error);
      return [];
    }
  }


  // Function to load all tags from Supabase
export async function loadAllTags() {
  try {
    const { data, error } = await supabase
      .from('tags')
      .select('*')
      .order('used_count', { ascending: false });
      
    if (error) throw error;
    
    allTagsStore.set(data.map(t => t.name));
    return data;
  } catch (error) {
    console.error('Error loading tags:', error);
    return [];
  }
}


export async function saveNoteTags(noteId: string, tags: string[]): Promise<{ success: boolean; error?: any }> {
  try {
    if (!isValidUUID(noteId)) {
      throw new Error(`Invalid note ID: ${noteId}`);
    }
    // First remove all existing tags for this note
    const { error: deleteError } = await supabase
      .from('note_tags')
      .delete()
      .eq('note_id', noteId);
      
    if (deleteError) throw deleteError;
    
    // Then add all current tags
    if (tags.length > 0) {
      const tagRows = tags.map(tag => ({
        note_id: noteId,
        tag_name: tag
      }));
      
      const { error: insertError } = await supabase
        .from('note_tags')
        .insert(tagRows);
        
      if (insertError) throw insertError;
    }
    
    // Update tag usage counts or add new tags
    for (const tag of tags) {
      // Check if tag exists
      const { data, error: selectError } = await supabase
        .from('tags')
        .select('*')
        .eq('name', tag)
        .single();
        
      if (selectError && selectError.code !== 'PGRST116') {
        // Error other than "not found"
        throw selectError;
      }
      
      if (data) {
        // Update existing tag count
        const { error: updateError } = await supabase
          .from('tags')
          .update({ used_count: data.used_count + 1, last_used: new Date() })
          .eq('name', tag);
          
        if (updateError) throw updateError;
      } else {
        // Insert new tag
        const { error: insertError } = await supabase
          .from('tags')
          .insert({ name: tag, used_count: 1, last_used: new Date() });
          
        if (insertError) throw insertError;
      }
    }
    
    // Reload all tags to update the store
    await loadAllTags();
    
    return { success: true };
  } catch (error) {
    console.error('Error saving note tags:', error);
    return { success: false, error };
  }
}

