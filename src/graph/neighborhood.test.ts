import { describe, it, expect } from 'vitest';
import { getForwardDependencies, getNeighborhood, getReverseDependencies } from './neighborhood';
import { refId, type GraphEdge, type NormalizedResource, type ResourceGraph, type ResourceRef } from './types';

const A: ResourceRef = { kind: 'Deployment', name: 'a', namespace: 'ns' };
const B: ResourceRef = { kind: 'Pod', name: 'b', namespace: 'ns' };
const C: ResourceRef = { kind: 'ConfigMap', name: 'c', namespace: 'ns' };
const D: ResourceRef = { kind: 'Secret', name: 'd', namespace: 'ns' };

function node(ref: ResourceRef): NormalizedResource {
  return { ref, status: 'Healthy' };
}

// A --manages-pods--> B --mounts-configmap--> C --(nothing)--> ... D is unrelated, linked only to C
function buildChainGraph(): ResourceGraph {
  const nodes = new Map<string, NormalizedResource>();
  for (const ref of [A, B, C, D]) nodes.set(refId(ref), node(ref));

  const edges: GraphEdge[] = [
    { from: A, to: B, relation: 'manages-pods', broken: false },
    { from: B, to: C, relation: 'mounts-configmap', broken: false },
    { from: C, to: D, relation: 'mounts-secret', broken: false },
  ];

  return { nodes, edges };
}

describe('getForwardDependencies / getReverseDependencies', () => {
  it('returns only the direct outgoing edges for forward dependencies', () => {
    const graph = buildChainGraph();
    const forward = getForwardDependencies(graph, B);
    expect(forward).toHaveLength(1);
    expect(forward[0].to).toEqual(C);
  });

  it('returns only the direct incoming edges for reverse dependencies', () => {
    const graph = buildChainGraph();
    const reverse = getReverseDependencies(graph, B);
    expect(reverse).toHaveLength(1);
    expect(reverse[0].from).toEqual(A);
  });

  it('returns an empty list for a leaf node with no dependents', () => {
    const graph = buildChainGraph();
    expect(getForwardDependencies(graph, D)).toHaveLength(0);
  });
});

describe('getNeighborhood', () => {
  it('includes only the center at 0 hops', () => {
    const graph = buildChainGraph();
    const { nodes } = getNeighborhood(graph, B, 0);
    expect(nodes.map((n) => refId(n.ref))).toEqual([refId(B)]);
  });

  it('expands one hop in both directions', () => {
    const graph = buildChainGraph();
    const { nodes } = getNeighborhood(graph, B, 1);
    const ids = nodes.map((n) => refId(n.ref));
    expect(ids).toContain(refId(A));
    expect(ids).toContain(refId(B));
    expect(ids).toContain(refId(C));
    expect(ids).not.toContain(refId(D));
  });

  it('expands further with more hops', () => {
    const graph = buildChainGraph();
    const { nodes } = getNeighborhood(graph, B, 2);
    const ids = nodes.map((n) => refId(n.ref));
    expect(ids).toContain(refId(D));
  });

  it('does not include duplicate edges when traversing back through an already-visited node', () => {
    const graph = buildChainGraph();
    const { edges } = getNeighborhood(graph, B, 3);
    expect(edges).toHaveLength(graph.edges.length);
  });
});
