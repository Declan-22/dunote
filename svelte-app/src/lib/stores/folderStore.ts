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
  // Fetch user's folders
  const { data, error } = await supabase
    .from('folders')
    .select('*')
    .eq('user_id', userId);
  
  if (!error && data) {
    folders.set(data);
  } else {
    folders.set([]);
  }
}

// Add a new folder
export async function addFolder(name: string, color: string, userId: string) {
  const { data, error } = await supabase
    .from('folders')
    .insert([
      { name, color, spaces: [], user_id: userId }
    ])
    .select();
  
  if (!error && data) {
    const newFolder = data[0];
    folders.update(items => [...items, newFolder]);
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
  // Get the folder
  let currentFolder: Folder | undefined;
  folders.update(items => {
    const folder = items.find(f => f.id === folderId);
    if (folder) {
      if (!folder.spaces) folder.spaces = [];
      if (!folder.spaces.includes(spaceId)) {
        folder.spaces = [...folder.spaces, spaceId];
      }
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