import { Injectable } from '@nestjs/common';
import {
  Prisma,
  EdgeStrength as PrismaEdgeStrength,
  EdgeType as PrismaEdgeType,
  Granularity as PrismaGranularity,
  NodeType as PrismaNodeType,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateNodeData,
  CreateTopicData,
  LearningGraphRepository,
} from '../application/learning-graph.repository';
import { ImportGraphData, ImportGraphResult } from '../application/import-model';
import { GraphEdge, GraphNode } from '../domain/model';

@Injectable()
export class PrismaLearningGraphRepository implements LearningGraphRepository {
  constructor(private readonly prisma: PrismaService) {}

  topicExists(id: string) {
    return this.prisma.topic.count({ where: { id } }).then((count) => count > 0);
  }

  nodeExists(id: string) {
    return this.prisma.learningNode.count({ where: { id } }).then((count) => count > 0);
  }

  createTopic(data: CreateTopicData) {
    return this.prisma.topic.create({ data });
  }

  createNode(data: CreateNodeData) {
    const { metadata, ...nodeData } = data;
    return this.prisma.learningNode.create({
      data: {
        ...nodeData,
        type: data.type as PrismaNodeType,
        granularity: data.granularity as PrismaGranularity,
        ...(metadata === undefined
          ? {}
          : { metadata: metadata as Prisma.InputJsonValue }),
      },
    });
  }

  addMembership(topicId: string, nodeId: string) {
    return this.prisma.topicMembership.create({ data: { topicId, nodeId } });
  }

  async getSnapshot(): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }> {
    const [nodes, edges] = await Promise.all([
      this.prisma.learningNode.findMany({ select: { id: true } }),
      this.prisma.learningEdge.findMany({
        select: {
          id: true,
          sourceNodeId: true,
          targetNodeId: true,
          type: true,
          strength: true,
        },
      }),
    ]);

    return {
      nodes,
      edges: edges.map((edge) => ({
        ...edge,
        type: edge.type as GraphEdge['type'],
        strength: edge.strength as GraphEdge['strength'],
      })),
    };
  }

  createEdge(edge: {
    sourceNodeId: string;
    targetNodeId: string;
    type: import('../domain/model').EdgeType;
    strength: import('../domain/model').EdgeStrength;
    metadata?: Record<string, unknown>;
  }) {
    const { metadata, ...edgeData } = edge;
    return this.prisma.learningEdge.create({
      data: {
        ...edgeData,
        type: edge.type as PrismaEdgeType,
        strength: edge.strength as PrismaEdgeStrength,
        ...(metadata === undefined
          ? {}
          : { metadata: metadata as Prisma.InputJsonValue }),
      },
    });
  }

  async importGraph(data: ImportGraphData): Promise<ImportGraphResult> {
    return this.prisma.$transaction(async (tx) => {
      if (data.source && data.version && data.checksum) {
        const existingRun = await tx.importRun.findUnique({
          where: {
            source_version_checksum: {
              source: data.source,
              version: data.version,
              checksum: data.checksum,
            },
          },
        });
        if (existingRun) {
          return {
            skipped: true,
            source: existingRun.source,
            version: existingRun.version,
            checksum: existingRun.checksum,
            topics: existingRun.topics,
            nodes: existingRun.nodes,
            memberships: existingRun.memberships,
            edges: existingRun.edges,
            topicIds: {},
            nodeIds: {},
          };
        }
      }

      const topicIds: Record<string, string> = {};
      const pendingTopics = new Map(data.topics.map((topic) => [topic.key, topic]));

      while (pendingTopics.size > 0) {
        let createdInPass = 0;

        for (const [key, topic] of pendingTopics) {
          if (topic.parentKey && !topicIds[topic.parentKey]) continue;

          const created = await tx.topic.create({
            data: {
              name: topic.name,
              description: topic.description,
              parentId: topic.parentKey ? topicIds[topic.parentKey] : undefined,
            },
          });
          topicIds[key] = created.id;
          pendingTopics.delete(key);
          createdInPass += 1;
        }

        if (createdInPass === 0) {
          throw new Error('Unable to order imported Topics');
        }
      }

      const nodeIds: Record<string, string> = {};
      for (const node of data.nodes) {
        const { key: _key, metadata, ...nodeData } = node;
        const created = await tx.learningNode.create({
          data: {
            ...nodeData,
            type: node.type as PrismaNodeType,
            granularity: node.granularity as PrismaGranularity,
            ...(metadata === undefined
              ? {}
              : { metadata: metadata as Prisma.InputJsonValue }),
          },
        });
        nodeIds[node.key] = created.id;
      }

      for (const membership of data.memberships) {
        await tx.topicMembership.create({
          data: {
            topicId: topicIds[membership.topicKey],
            nodeId: nodeIds[membership.nodeKey],
          },
        });
      }

      for (const edge of data.edges) {
        const { metadata, ...edgeData } = edge;
        await tx.learningEdge.create({
          data: {
            sourceNodeId: nodeIds[edgeData.sourceNodeKey],
            targetNodeId: nodeIds[edgeData.targetNodeKey],
            type: edgeData.type as PrismaEdgeType,
            strength: edgeData.strength as PrismaEdgeStrength,
            ...(metadata === undefined
              ? {}
              : { metadata: metadata as Prisma.InputJsonValue }),
          },
        });
      }

      if (data.source && data.version && data.checksum) {
        await tx.importRun.create({
          data: {
            source: data.source,
            version: data.version,
            checksum: data.checksum,
            topics: data.topics.length,
            nodes: data.nodes.length,
            memberships: data.memberships.length,
            edges: data.edges.length,
          },
        });
      }

      return {
        skipped: false,
        source: data.source,
        version: data.version,
        checksum: data.checksum,
        topics: data.topics.length,
        nodes: data.nodes.length,
        memberships: data.memberships.length,
        edges: data.edges.length,
        topicIds,
        nodeIds,
      };
    });
  }

  async getGraph() {
    const [topics, nodes, memberships, edges] = await Promise.all([
      this.prisma.topic.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.learningNode.findMany({ orderBy: { title: 'asc' } }),
      this.prisma.topicMembership.findMany(),
      this.prisma.learningEdge.findMany({ orderBy: { createdAt: 'asc' } }),
    ]);
    return { topics, nodes, memberships, edges };
  }

  listTopics() {
    return this.prisma.topic.findMany({
      orderBy: [{ parentId: 'asc' }, { name: 'asc' }],
      include: { parent: true },
    });
  }

  async listNodes(query: {
    page: number;
    pageSize: number;
    search?: string;
    type?: import('../domain/model').NodeType;
    granularity?: import('../domain/model').Granularity;
    topicId?: string;
  }) {
    const where: Prisma.LearningNodeWhereInput = {
      ...(query.search
        ? { title: { contains: query.search, mode: 'insensitive' } }
        : {}),
      ...(query.type ? { type: query.type as PrismaNodeType } : {}),
      ...(query.granularity
        ? { granularity: query.granularity as PrismaGranularity }
        : {}),
      ...(query.topicId ? { memberships: { some: { topicId: query.topicId } } } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.learningNode.findMany({
        where,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        orderBy: [{ title: 'asc' }, { id: 'asc' }],
        include: {
          memberships: { include: { topic: true } },
          _count: { select: { incomingEdges: true, outgoingEdges: true } },
        },
      }),
      this.prisma.learningNode.count({ where }),
    ]);
    return {
      items,
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }

  getNodeDetails(id: string) {
    return this.prisma.learningNode.findUnique({
      where: { id },
      include: {
        memberships: { include: { topic: true } },
        incomingEdges: {
          include: {
            sourceNode: { select: { id: true, title: true } },
            targetNode: { select: { id: true, title: true } },
          },
        },
        outgoingEdges: {
          include: {
            sourceNode: { select: { id: true, title: true } },
            targetNode: { select: { id: true, title: true } },
          },
        },
      },
    });
  }
}
