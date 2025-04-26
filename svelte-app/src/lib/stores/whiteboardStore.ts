// src/lib/stores/whiteboardStore.ts
import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';
import { supabase } from '$lib/supabaseClient';

// Types
interface WhiteboardState {
    id: string;
    elements: WhiteboardElement[];
    version: number;
    lastUpdated: Date;
}

type WhiteboardElement = 
    | { type: 'path', id: string, points: Point[], color: string, size: number }
    | { type: 'shape', id: string, shape: 'rectangle'|'circle'|'triangle', start: Point, end: Point, color: string }
    | { type: 'text', id: string, content: string, position: Point, color: string }
    | { type: 'image', id: string, url: string, position: Point, size: { width: number, height: number } };

interface Point {
    x: number;
    y: number;
}

// Store implementation
function createWhiteboardStore() {
    const { subscribe, set, update } = writable<Record<string, WhiteboardState>>({});
    const history = new Map<string, WhiteboardState[]>();
    const historyIndex = new Map<string, number>();

    // Initialize a new whiteboard
    function initWhiteboard(id: string) {
        update(store => ({
            ...store,
            [id]: {
                id,
                elements: [],
                version: 1,
                lastUpdated: new Date()
            }
        }));
        history.set(id, [get(store)[id]]);
        historyIndex.set(id, 0);
    }

    // Add element to whiteboard
    function addElement(id: string, element: WhiteboardElement) {
        update(store => {
            const current = store[id] || initWhiteboard(id);
            return {
                ...store,
                [id]: {
                    ...current,
                    elements: [...current.elements, element],
                    version: current.version + 1,
                    lastUpdated: new Date()
                }
            };
        });
        saveStateToHistory(id);
    }

    // Undo last action
    function undo(id: string) {
        const index = historyIndex.get(id) || 0;
        if (index > 0) {
            historyIndex.set(id, index - 1);
            const previousState = history.get(id)?.[index - 1];
            if (previousState) {
                update(store => ({
                    ...store,
                    [id]: previousState
                }));
            }
        }
    }

    // Redo last undone action
    function redo(id: string) {
        const index = historyIndex.get(id) || 0;
        const states = history.get(id) || [];
        if (index < states.length - 1) {
            historyIndex.set(id, index + 1);
            const nextState = states[index + 1];
            update(store => ({
                ...store,
                [id]: nextState
            }));
        }
    }

    // Save current state to history
    function saveStateToHistory(id: string) {
        const currentState = get(store)[id];
        if (!currentState) return;

        const states = history.get(id) || [];
        const currentIndex = historyIndex.get(id) || 0;

        // Remove any states after current index (if we're not at the end)
        const newStates = states.slice(0, currentIndex + 1);
        newStates.push(currentState);

        history.set(id, newStates);
        historyIndex.set(id, newStates.length - 1);
    }

    // Sync with Supabase
    async function syncWithSupabase(id: string) {
        if (!browser) return;

        const currentState = get(store)[id];
        if (!currentState) return;

        const { error } = await supabase
            .from('whiteboards')
            .upsert({
                id,
                data: currentState,
                updated_at: new Date().toISOString()
            });

        if (error) {
            console.error('Error syncing whiteboard:', error);
        }
    }

    // Load from Supabase
    async function loadFromSupabase(id: string) {
        if (!browser) return;

        const { data, error } = await supabase
            .from('whiteboards')
            .select('data')
            .eq('id', id)
            .single();

        if (error) {
            console.error('Error loading whiteboard:', error);
            return null;
        }

        if (data) {
            set({
                ...get(store),
                [id]: data.data as WhiteboardState
            });
            history.set(id, [data.data]);
            historyIndex.set(id, 0);
        }

        return data?.data;
    }

    return {
        subscribe,
        initWhiteboard,
        addElement,
        undo,
        redo,
        syncWithSupabase,
        loadFromSupabase,
        reset: (id: string) => {
            initWhiteboard(id);
            syncWithSupabase(id);
        }
    };
}

export const whiteboardStore = createWhiteboardStore();