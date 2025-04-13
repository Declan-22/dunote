// $lib/utils/graphAdapters.ts
import type { SiloNode } from '$lib/stores/siloStore';
import { NODE_TYPES } from '$lib/types/nodes';

export function adaptNodesForGraph(siloNodes: SiloNode[]) {
  return siloNodes.map(node => ({
    id: node.id,
    type: node.type,
    x: node.position.x,
    y: node.position.y,
    status: 'active', // Or determine from your data
    // Add an icon property if your DependencyGraph component expects it
    icon: NODE_TYPES[node.type]?.icon || 'default',
    data: {
      title: node.data.title,
      description: node.data.description || ''
    }
  }));
}