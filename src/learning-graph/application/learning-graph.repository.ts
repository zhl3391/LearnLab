import {
  EdgeStrength,
  EdgeType,
  Granularity,
  GraphEdge,
  GraphNode,
  NodeType,
} from '../domain/model';
import { ImportGraphData, ImportGraphResult } from './import-model';

export const LEARNING_GRAPH_REPOSITORY = Symbol('LEARNING_GRAPH_REPOSITORY');

export interface CreateTopicData {
  name: string;
  description?: string;
  parentId?: string;
}

export interface CreateNodeData {
  title: string;
  description?: string;
  type: NodeType;
  granularity: Granularity;
  difficulty?: number;
  metadata?: Record<string, unknown>;
}

export interface LearningGraphRepository {
  topicExists(id: string): Promise<boolean>;
  nodeExists(id: string): Promise<boolean>;
  createTopic(data: CreateTopicData): Promise<unknown>;
  createNode(data: CreateNodeData): Promise<unknown>;
  addMembership(topicId: string, nodeId: string): Promise<unknown>;
  getSnapshot(): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }>;
  createEdge(edge: {
    sourceNodeId: string;
    targetNodeId: string;
    type: EdgeType;
    strength: EdgeStrength;
  }): Promise<unknown>;
  importGraph(data: ImportGraphData): Promise<ImportGraphResult>;
  listTopics(): Promise<unknown>;
  listNodes(query: {
    page: number;
    pageSize: number;
    search?: string;
    type?: NodeType;
    granularity?: Granularity;
    topicId?: string;
  }): Promise<unknown>;
  getNodeDetails(id: string): Promise<unknown>;
  getGraph(): Promise<unknown>;
}
