import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  assertCanAddEdge,
  assertValidDifficulty,
  GraphRuleError,
  normalizeEdge,
  validateGraphSnapshot,
} from '../domain/model';
import {
  CreateNodeData,
  CreateTopicData,
  LEARNING_GRAPH_REPOSITORY,
  LearningGraphRepository,
} from './learning-graph.repository';
import { ImportGraphData, ImportGraphResult } from './import-model';

@Injectable()
export class LearningGraphService {
  constructor(
    @Inject(LEARNING_GRAPH_REPOSITORY)
    private readonly repository: LearningGraphRepository,
  ) {}

  async createTopic(data: CreateTopicData) {
    if (data.parentId && !(await this.repository.topicExists(data.parentId))) {
      throw new NotFoundException(`Topic ${data.parentId} was not found`);
    }
    return this.repository.createTopic(data);
  }

  async createNode(data: CreateNodeData) {
    try {
      assertValidDifficulty(data.difficulty);
    } catch (error) {
      this.throwRuleError(error);
    }
    return this.repository.createNode(data);
  }

  async addMembership(topicId: string, nodeId: string) {
    if (!(await this.repository.topicExists(topicId))) {
      throw new NotFoundException(`Topic ${topicId} was not found`);
    }
    if (!(await this.repository.nodeExists(nodeId))) {
      throw new NotFoundException(`LearningNode ${nodeId} was not found`);
    }
    return this.repository.addMembership(topicId, nodeId);
  }

  async createEdge(data: Parameters<LearningGraphRepository['createEdge']>[0]) {
    if (!(await this.repository.nodeExists(data.sourceNodeId))) {
      throw new NotFoundException(`LearningNode ${data.sourceNodeId} was not found`);
    }
    if (!(await this.repository.nodeExists(data.targetNodeId))) {
      throw new NotFoundException(`LearningNode ${data.targetNodeId} was not found`);
    }

    try {
      const edge = normalizeEdge(assertCanAddEdge(await this.repository.getSnapshot(), data));
      return await this.repository.createEdge(edge);
    } catch (error) {
      if (error instanceof GraphRuleError) this.throwRuleError(error);
      if (isPrismaUniqueViolation(error)) {
        throw new ConflictException('The same LearningEdge already exists');
      }
      throw error;
    }
  }

  getGraph() {
    return this.repository.getGraph();
  }

  listTopics() {
    return this.repository.listTopics();
  }

  listNodes(query: Parameters<LearningGraphRepository['listNodes']>[0]) {
    return this.repository.listNodes(query);
  }

  async getNodeDetails(id: string) {
    const node = await this.repository.getNodeDetails(id);
    if (!node) throw new NotFoundException(`LearningNode ${id} was not found`);
    return node;
  }

  async importGraph(data: ImportGraphData): Promise<ImportGraphResult> {
    try {
      const normalizedData = this.validateImport(data);
      return await this.repository.importGraph(normalizedData);
    } catch (error) {
      if (error instanceof GraphRuleError) this.throwRuleError(error);
      throw error;
    }
  }

  private validateImport(data: ImportGraphData): ImportGraphData {
    assertUnique(data.topics.map((topic) => topic.key), 'topic key');
    assertUnique(data.nodes.map((node) => node.key), 'node key');

    const topicKeys = new Set(data.topics.map((topic) => topic.key));
    const nodeKeys = new Set(data.nodes.map((node) => node.key));

    for (const topic of data.topics) {
      if (topic.parentKey && !topicKeys.has(topic.parentKey)) {
        throw new GraphRuleError(
          `Topic ${topic.key} references missing parent ${topic.parentKey}`,
        );
      }
    }
    assertAcyclicTopicTree(data.topics);

    for (const node of data.nodes) {
      assertValidDifficulty(node.difficulty);
    }

    const membershipKeys = new Set<string>();
    for (const membership of data.memberships) {
      if (!topicKeys.has(membership.topicKey)) {
        throw new GraphRuleError(`Membership references missing Topic ${membership.topicKey}`);
      }
      if (!nodeKeys.has(membership.nodeKey)) {
        throw new GraphRuleError(
          `Membership references missing LearningNode ${membership.nodeKey}`,
        );
      }
      const key = `${membership.topicKey}:${membership.nodeKey}`;
      if (membershipKeys.has(key)) {
        throw new GraphRuleError(`duplicate TopicMembership: ${key}`);
      }
      membershipKeys.add(key);
    }

    const graphEdges = data.edges.map((edge) => {
      if (!nodeKeys.has(edge.sourceNodeKey) || !nodeKeys.has(edge.targetNodeKey)) {
        throw new GraphRuleError(
          `Edge references missing node: ${edge.sourceNodeKey} -> ${edge.targetNodeKey}`,
        );
      }
      return {
        sourceNodeId: edge.sourceNodeKey,
        targetNodeId: edge.targetNodeKey,
        type: edge.type,
        strength: edge.strength,
        metadata: edge.metadata,
      };
    });
    const normalizedEdges = validateGraphSnapshot({
      nodes: data.nodes.map((node) => ({ id: node.key })),
      edges: graphEdges,
    });

    return {
      ...data,
      edges: normalizedEdges.map((edge) => ({
        sourceNodeKey: edge.sourceNodeId,
        targetNodeKey: edge.targetNodeId,
        type: edge.type,
        strength: edge.strength,
        metadata: edge.metadata,
      })),
    };
  }

  private throwRuleError(error: unknown): never {
    const message = error instanceof Error ? error.message : 'Invalid graph data';
    throw new UnprocessableEntityException(message);
  }
}

function assertUnique(values: string[], label: string): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) throw new GraphRuleError(`duplicate ${label}: ${value}`);
    seen.add(value);
  }
}

function assertAcyclicTopicTree(
  topics: Array<{ key: string; parentKey?: string }>,
): void {
  const parentByKey = new Map(topics.map((topic) => [topic.key, topic.parentKey]));
  const visiting = new Set<string>();
  const visited = new Set<string>();

  const visit = (key: string) => {
    if (visiting.has(key)) throw new GraphRuleError('Topic hierarchy cannot form a cycle');
    if (visited.has(key)) return;
    visiting.add(key);
    const parentKey = parentByKey.get(key);
    if (parentKey) visit(parentKey);
    visiting.delete(key);
    visited.add(key);
  };

  for (const topic of topics) visit(topic.key);
}

function isPrismaUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  );
}
