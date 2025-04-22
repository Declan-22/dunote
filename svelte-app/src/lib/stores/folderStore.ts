// folderStore.ts
import { writable } from 'svelte/store';
import { supabase } from '$lib/supabaseClient';
import type { Space } from './spaceStore';

export type Folder = {
  id: string;
  name: string;
  color: string;
  spaces: string[]; // Array of space IDs
  user_id?: string;
  isOpen?: boolean;
};

// Create the store
export const folders = writable<Folder[]>([]);

// Initialize folders with user data
export async function initFolders(userId: string) {
  const { data, error } = await supabase
    .from('folders')
    .select('*')
    .eq('user_id', userId);

  if (!error && data) {
    const foldersWithDefaults = data.map(folder => ({
      ...folder,
      isOpen: folder.isOpen ?? false
    }));
    folders.set(foldersWithDefaults);
  } else {
    folders.set([]);
  }
}

// Add a new folder
export async function addFolder(name: string, color: string, userId: string) {
  const { data, error } = await supabase
    .from('folders')
    .insert([{
      name,
      color,
      spaces: [], // Properly typed as UUID array
      user_id: userId
    }])
    .select();

  if (error) {
    console.error('Folder creation error:', error);
    return null;
  }

  if (data) {
    const newFolder = data[0];
    folders.update(items => [...items, {
      ...newFolder,
      isOpen: true // Local UI state only
    }]);
    return newFolder;
  }
  return null;
}

// Remove a folder
export async function removeFolder(folderId: string) {
  const { error } = await supabase
    .from('folders')
    .delete()
    .eq('id', folderId);
  
  if (!error) {
    folders.update(items => items.filter(item => item.id !== folderId));
    return true;
  }
  
  return false;
}

// Add space to folder
export async function addSpaceToFolder(spaceId: string, folderId: string) {
  const { data: folderData } = await supabase
    .from('folders')
    .select('spaces')
    .eq('id', folderId)
    .single();

  if (folderData) {
    const updatedSpaces = [...folderData.spaces, spaceId];
    
    const { error } = await supabase
      .from('folders')
      .update({ spaces: updatedSpaces })
      .eq('id', folderId);

    if (!error) {
      folders.update(items => 
        items.map(folder => 
          folder.id === folderId 
            ? { ...folder, spaces: updatedSpaces } 
            : folder
        )
      );
      return true;
    }
  }
  return false;
}

// Remove space from folder
export async function removeSpaceFromFolder(spaceId: string, folderId: string) {
  // Get the folder
  let currentFolder: Folder | undefined;
  folders.update(items => {
    const folder = items.find(f => f.id === folderId);
    if (folder) {
      folder.spaces = folder.spaces.filter(id => id !== spaceId);
      currentFolder = folder;
    }
    return items;
  });
  
  if (currentFolder) {
    // Update in database
    const { error } = await supabase
      .from('folders')
      .update({ spaces: currentFolder.spaces })
      .eq('id', folderId);
    
    return !error;
  }
  
  return false;
}

// Toggle folder open/closed state
export function toggleFolder(folderId: string) {
  folders.update(items => items.map(folder => 
    folder.id === folderId ? { ...folder, isOpen: !folder.isOpen } : folder
  ));
}