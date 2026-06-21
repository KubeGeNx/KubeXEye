import { refId, type GraphEdge, type NormalizedResource, type ResourceGraph, type ResourceRef } from './types';

export interface Neighborhood {
  nodes: NormalizedResource[];
  edges: GraphEdge[];
}

/** Direct (one-hop) edges where `ref` is the source — i.e. what it depends on. */
export function getForwardDependencies(graph: ResourceGraph, ref: ResourceRef): GraphEdge[] {
  const id = refId(ref);
  return graph.edges.filter((e) => refId(e.from) === id);
}

/** Direct (one-hop) edges where `ref` is the target — i.e. what depends on it. */
export function getReverseDependencies(graph: ResourceGraph, ref: ResourceRef): GraphEdge[] {
  const id = refId(ref);
  return graph.edges.filter((e) => refId(e.to) === id);
}

/** BFS outward from `center` (both directions) up to `hops` steps, for graph visualization. */
export function getNeighborhood(graph: ResourceGraph, center: ResourceRef, hops: number): Neighborhood {
  const centerId = refId(center);
  const visited = new Set<string>([centerId]);
  const edgeSet = new Map<string, GraphEdge>();
  let frontier = [centerId];

  for (let hop = 0; hop < hops; hop++) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const edge of graph.edges) {
        const fromId = refId(edge.from);
        const toId = refId(edge.to);
        if (fromId !== id && toId !== id) continue;
        const key = `${fromId}=>${toId}=${edge.relation}`;
        edgeSet.set(key, edge);
        const otherId = fromId === id ? toId : fromId;
        if (!visited.has(otherId)) {
          visited.add(otherId);
          next.push(otherId);
        }
      }
    }
    frontier = next;
    if (frontier.length === 0) break;
  }

  const nodes = Array.from(visited)
    .map((id) => graph.nodes.get(id))
    .filter((n): n is NormalizedResource => Boolean(n));

  return { nodes, edges: Array.from(edgeSet.values()) };
}
