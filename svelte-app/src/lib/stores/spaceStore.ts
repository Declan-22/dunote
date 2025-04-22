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
  try {
    const { data, error } = await supabase
      .from('spaces')
      .select('id, name, icon, color, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (!error && data) {
      const formattedSpaces = data.map(space => ({
        ...space,
        href: `/space/${space.id}`, // Generate href client-side
        default: space.is_default
      }));
      
      spaces.set([...defaultSpaces, ...formattedSpaces]);
    }
  } catch (e) {
    console.error("Space initialization failed:", e);
  }
}

// Add a new space
export async function addSpace(name: string, icon: string, userId: string, color?: string) {
  const { data, error } = await supabase
    .from('spaces')
    .insert([{ 
      name, 
      icon, 
      color,
      user_id: userId 
    }])
    .select('id, name, icon, color, created_at');

  if (data?.[0]) {
    const newSpace = {
      ...data[0],
      href: `/space/${data[0].id}`, // Generate href here
      default: false
    };
    
    spaces.update(items => [...items, newSpace]);
    return newSpace;
  }
  
  console.error("Space creation error:", error);
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