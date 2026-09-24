import { EdgeStrength, EdgeType, Granularity, NodeType } from '../domain/model';

export interface ImportTopicData {
  key: string;
  name: string;
  description?: string;
  parentKey?: string;
}

export interface ImportNodeData {
  key: string;
  title: string;
  description?: string;
  type: NodeType;
  granularity: Granularity;
  difficulty?: number;
  metadata?: Record<string, unknown>;
}

export interface ImportMembershipData {
  topicKey: string;
  nodeKey: string;
}

export interface ImportEdgeData {
  sourceNodeKey: string;
  targetNodeKey: string;
  type: EdgeType;
  strength: EdgeStrength;
}

export interface ImportGraphData {
  source?: string;
  version?: string;
  checksum?: string;
  topics: ImportTopicData[];
  nodes: ImportNodeData[];
  memberships: ImportMembershipData[];
  edges: ImportEdgeData[];
}

export interface ImportGraphResult {
  skipped: boolean;
  source?: string;
  version?: string;
  checksum?: string;
  topics: number;
  nodes: number;
  memberships: number;
  edges: number;
  topicIds: Record<string, string>;
  nodeIds: Record<string, string>;
}
