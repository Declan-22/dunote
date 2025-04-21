import { writable } from 'svelte/store';
import { supabase } from '$lib/supabaseClient';

// Define space type
export type Space = {
  id: string;
  name: string;
  href: string;
  icon: string;
  default: boolean;
  user_id?: string;
  color?: string; // Add this line
};

// Default spaces
const defaultSpaces = [
  { id: 'home', name: 'Home', href: '/', icon: 'home', default: true },
  { id: 'silos', name: 'Silos', href: '/silos', icon: 'nodes', default: true },
  { id: 'notes', name: 'Notes', href: '/notes', icon: 'document', default: true },
  { id: 'pricing', name: 'Pricing', href: '/pricing', icon: 'pricing', default: true }
];

// Create the store
export const spaces = writable<Space[]>([...defaultSpaces]);

// Initialize spaces with user data
export async function initSpaces(userId: string) {
  // Start with default spaces
  let userSpaces = [...defaultSpaces];
  
  // Fetch user's custom spaces
  const { data, error } = await supabase
    .from('spaces')
    .select('*')
    .eq('user_id', userId);
  
  if (!error && data) {
    // Add custom spaces to the list
    const customSpaces = data.map(space => ({
      id: space.id,
      name: space.name,
      href: `/spaces/${space.id}`,
      icon: space.icon,
      default: false,
      user_id: space.user_id
    }));
    
    userSpaces = [...userSpaces, ...customSpaces];
  }
  
  spaces.set(userSpaces);
}

// Add a new space
export async function addSpace(name: string, icon: string, userId: string) {
  const { data, error } = await supabase
    .from('spaces')
    .insert([
      { name, icon, user_id: userId }
    ])
    .select();
  
  if (!error && data) {
    const newSpace = {
      id: data[0].id,
      name: data[0].name,
      href: `/space/${data[0].id}`,  // Consistent URL format
      icon: data[0].icon,
      default: false,
      user_id: data[0].user_id
    };
    
    spaces.update(items => [...items, newSpace]);
    return newSpace;
  }
  
  return null;
}

// Remove a space
export async function removeSpace(spaceId: string) {
  const { error } = await supabase
    .from('spaces')
    .delete()
    .eq('id', spaceId);
  
  if (!error) {
    spaces.update(items => items.filter(item => item.id !== spaceId));
    return true;
  }
  
  return false;
}