export enum NodeType {
  KNOWLEDGE = 'KNOWLEDGE',
  SKILL = 'SKILL',
  APPLICATION = 'APPLICATION',
}

export enum Granularity {
  L1_DOMAIN = 'L1_DOMAIN',
  L2_CONCEPT = 'L2_CONCEPT',
  L3_CAPABILITY = 'L3_CAPABILITY',
  L4_SPECIFIC = 'L4_SPECIFIC',
}

export enum EdgeType {
  PREREQUISITE = 'PREREQUISITE',
  PART_OF = 'PART_OF',
  RELATED = 'RELATED',
}

export enum EdgeStrength {
  REQUIRED = 'REQUIRED',
  IMPORTANT = 'IMPORTANT',
  HELPFUL = 'HELPFUL',
}

export enum EdgeReviewStatus {
  SOURCE = 'SOURCE',
  NEEDS_REVIEW = 'NEEDS_REVIEW',
  REVIEWED = 'REVIEWED',
  REJECTED = 'REJECTED',
}

export enum EdgeReviewDecision {
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
}

export interface GraphNode {
  id: string;
}

export interface GraphEdge {
  id?: string;
  sourceNodeId: string;
  targetNodeId: string;
  type: EdgeType;
  strength: EdgeStrength;
  reviewStatus?: EdgeReviewStatus;
  metadata?: Record<string, unknown>;
}

export interface GraphSnapshot {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export class GraphRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GraphRuleError';
  }
}

export function normalizeEdge(edge: GraphEdge): GraphEdge {
  if (edge.type !== EdgeType.RELATED || edge.sourceNodeId <= edge.targetNodeId) {
    return edge;
  }

  return {
    ...edge,
    sourceNodeId: edge.targetNodeId,
    targetNodeId: edge.sourceNodeId,
  };
}

export function assertValidDifficulty(difficulty: number | undefined): void {
  if (difficulty === undefined) return;
  if (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > 5) {
    throw new GraphRuleError('difficulty must be an integer from 1 to 5');
  }
}

export function assertCanAddEdge(
  snapshot: GraphSnapshot,
  proposedEdge: GraphEdge,
): GraphEdge {
  const edge = normalizeEdge(proposedEdge);

  if (edge.sourceNodeId === edge.targetNodeId) {
    throw new GraphRuleError('an edge cannot connect a node to itself');
  }

  const nodeIds = new Set(snapshot.nodes.map((node) => node.id));
  if (!nodeIds.has(edge.sourceNodeId) || !nodeIds.has(edge.targetNodeId)) {
    throw new GraphRuleError('both edge endpoints must be existing LearningNodes');
  }

  if (edge.type === EdgeType.RELATED) return edge;

  const adjacency = new Map<string, string[]>();
  for (const existingEdge of snapshot.edges) {
    if (existingEdge.type !== edge.type) continue;
    const neighbors = adjacency.get(existingEdge.sourceNodeId) ?? [];
    neighbors.push(existingEdge.targetNodeId);
    adjacency.set(existingEdge.sourceNodeId, neighbors);
  }

  if (hasPath(adjacency, edge.targetNodeId, edge.sourceNodeId)) {
    throw new GraphRuleError(`${edge.type} edges cannot form a cycle`);
  }

  return edge;
}

export function validateGraphSnapshot(snapshot: GraphSnapshot): GraphEdge[] {
  const nodeIds = new Set<string>();
  for (const node of snapshot.nodes) {
    if (nodeIds.has(node.id)) {
      throw new GraphRuleError(`duplicate LearningNode id: ${node.id}`);
    }
    nodeIds.add(node.id);
  }

  const acceptedEdges: GraphEdge[] = [];
  const edgeKeys = new Set<string>();
  for (const edge of snapshot.edges) {
    const normalized = normalizeEdge(edge);
    const key = `${normalized.sourceNodeId}:${normalized.targetNodeId}:${normalized.type}`;
    if (edgeKeys.has(key)) {
      throw new GraphRuleError(`duplicate LearningEdge: ${key}`);
    }
    edgeKeys.add(key);
    acceptedEdges.push(
      assertCanAddEdge(
        { nodes: snapshot.nodes, edges: acceptedEdges },
        normalized,
      ),
    );
  }

  return acceptedEdges;
}

function hasPath(
  adjacency: Map<string, string[]>,
  from: string,
  target: string,
): boolean {
  const visited = new Set<string>();
  const pending = [from];

  while (pending.length > 0) {
    const current = pending.pop();
    if (!current || visited.has(current)) continue;
    if (current === target) return true;
    visited.add(current);
    pending.push(...(adjacency.get(current) ?? []));
  }

  return false;
}
