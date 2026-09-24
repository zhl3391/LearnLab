import {
  EdgeStrength,
  EdgeType,
  Granularity,
  NodeType,
  validateGraphSnapshot,
} from '../domain/model';
import { ImportEdgeData, ImportGraphData, ImportNodeData } from '../application/import-model';

interface TaxonomyTopic {
  id: string;
  type: string;
  subject: string;
  domain: string;
  name: string;
  description?: string;
  ageRangeStart?: number;
  ageRangeEnd?: number;
  centrality?: number;
  evidence?: string[];
  assessmentPrompt?: string;
  standards?: string[];
  cnStandards?: string[];
  origin?: string;
  stage?: string;
  nodeKind?: string;
  translationStatus?: string;
}

interface TaxonomyEdge {
  topicId: string;
  prerequisiteId: string;
  strength: 'hard' | 'soft';
  reason?: string;
  reviewStatus?: 'reviewed' | 'machine' | 'rejected';
  reviewProvenance?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewerRole?: string;
}

export interface BeijingTaxonomyInput {
  taxonomyVersion: string;
  upstreamTopics: TaxonomyTopic[];
  translatedTopics: Array<Pick<TaxonomyTopic, 'id' | 'name' | 'description' | 'evidence' | 'assessmentPrompt' | 'cnStandards' | 'translationStatus'>>;
  cnTopics: TaxonomyTopic[];
  upstreamDependencies: TaxonomyEdge[];
  cnDependencies: TaxonomyEdge[];
  bridgeDependencies: TaxonomyEdge[];
  subjectNames?: Record<string, string>;
  domainNames?: Record<string, string>;
}

export interface BeijingTaxonomyMapping {
  graph: ImportGraphData;
  rejectedEdges: number;
}

export function mapBeijingTaxonomy(input: BeijingTaxonomyInput): BeijingTaxonomyMapping {
  const upstreamById = uniqueById(input.upstreamTopics, 'upstream topic');
  const translatedById = uniqueById(input.translatedTopics, 'translated topic');
  const cnById = uniqueById(input.cnTopics, 'China-specific topic');
  for (const id of cnById.keys()) {
    if (upstreamById.has(id)) throw new Error(`China-specific topic reuses upstream id ${id}`);
  }
  const topicsById = new Map([...upstreamById, ...cnById]);

  for (const id of translatedById.keys()) {
    if (!upstreamById.has(id)) throw new Error(`Chinese translation references missing upstream topic ${id}`);
  }

  const topics: ImportGraphData['topics'] = [];
  const memberships: ImportGraphData['memberships'] = [];
  const nodes: ImportNodeData[] = [];
  const nodeKeys = new Set<string>();
  const topicKeys = new Set<string>();

  for (const baseTopic of input.upstreamTopics) {
    const translation = translatedById.get(baseTopic.id);
    if (!translation) throw new Error(`Missing Chinese translation for upstream topic ${baseTopic.id}`);
    addTopicAndMembership(baseTopic, mergeTopic(baseTopic, translation), 'upstream');
  }
  for (const cnTopic of input.cnTopics) addTopicAndMembership(cnTopic, cnTopic, 'cn_only');

  const mappedEdges: ImportEdgeData[] = [];
  let rejectedEdges = 0;

  appendEdges(input.upstreamDependencies, 'UPSTREAM_SOURCE');
  appendEdges(input.cnDependencies, 'REVIEWED_OR_MACHINE');
  appendEdges(input.bridgeDependencies, 'REVIEWED_OR_MACHINE');

  const validatedEdges = validateGraphSnapshot({
    nodes: nodes.map((node) => ({ id: node.key })),
    edges: mappedEdges.map((edge) => ({
      sourceNodeId: edge.sourceNodeKey,
      targetNodeId: edge.targetNodeKey,
      type: edge.type,
      strength: edge.strength,
      metadata: edge.metadata,
    })),
  });

  return {
    graph: {
      source: 'beijing-skill-taxonomy',
      version: input.taxonomyVersion,
      topics,
      nodes,
      memberships,
      edges: validatedEdges.map((edge) => ({
        sourceNodeKey: edge.sourceNodeId,
        targetNodeKey: edge.targetNodeId,
        type: edge.type,
        strength: edge.strength,
        metadata: edge.metadata,
      })),
    },
    rejectedEdges,
  };

  function addTopicAndMembership(base: TaxonomyTopic, localized: TaxonomyTopic, origin: string) {
    if (nodeKeys.has(base.id)) throw new Error(`Duplicate LearningNode id ${base.id}`);
    const subjectKey = `subject:${base.subject}`;
    const domainKey = `domain:${base.subject}:${base.domain}`;
    if (!topicKeys.has(subjectKey)) {
      topics.push({ key: subjectKey, name: input.subjectNames?.[base.subject] ?? base.subject });
      topicKeys.add(subjectKey);
    }
    if (!topicKeys.has(domainKey)) {
      const domainLookupKey = `${base.subject} / ${base.domain}`;
      topics.push({
        key: domainKey,
        name: input.domainNames?.[domainLookupKey] ?? base.domain,
        parentKey: subjectKey,
      });
      topicKeys.add(domainKey);
    }

    const nodeType = mapNodeType(base.type);
    nodes.push({
      key: base.id,
      title: localized.name,
      description: localized.description,
      type: nodeType,
      granularity: mapGranularity(base.type),
      metadata: {
        ageRange: { start: base.ageRangeStart ?? null, end: base.ageRangeEnd ?? null },
        centrality: base.centrality ?? null,
        evidence: localized.evidence ?? [],
        assessmentPrompt: localized.assessmentPrompt ?? null,
        standards: localized.cnStandards ?? localized.standards ?? [],
        taxonomyVersion: input.taxonomyVersion,
        taxonomyType: base.type,
        origin,
        stage: localized.stage ?? base.stage ?? null,
        nodeKind: localized.nodeKind ?? base.nodeKind ?? null,
        translationStatus: localized.translationStatus ?? null,
      },
    });
    nodeKeys.add(base.id);
    memberships.push({ topicKey: domainKey, nodeKey: base.id });
  }

  function appendEdges(edges: TaxonomyEdge[], source: 'UPSTREAM_SOURCE' | 'REVIEWED_OR_MACHINE') {
    for (const edge of edges) {
      if (source === 'REVIEWED_OR_MACHINE' && edge.reviewStatus === 'rejected') {
        rejectedEdges += 1;
        continue;
      }
      if (source === 'REVIEWED_OR_MACHINE' && !['reviewed', 'machine'].includes(edge.reviewStatus ?? '')) {
        throw new Error(`Unsupported reviewStatus ${edge.reviewStatus} on dependency ${edge.prerequisiteId} -> ${edge.topicId}`);
      }
      if (!topicsById.has(edge.topicId) || !topicsById.has(edge.prerequisiteId)) {
        throw new Error(`Dependency references missing topic ${edge.prerequisiteId} -> ${edge.topicId}`);
      }
      if (!nodeKeys.has(edge.topicId) || !nodeKeys.has(edge.prerequisiteId)) {
        throw new Error(`Dependency endpoint was not mapped ${edge.prerequisiteId} -> ${edge.topicId}`);
      }
      const reviewStatus = source === 'UPSTREAM_SOURCE'
        ? 'SOURCE'
        : edge.reviewStatus === 'machine' ? 'NEEDS_REVIEW' : 'REVIEWED';
      mappedEdges.push({
        sourceNodeKey: edge.prerequisiteId,
        targetNodeKey: edge.topicId,
        type: EdgeType.PREREQUISITE,
        strength: mapEdgeStrength(edge.strength),
        metadata: {
          reviewStatus,
          reviewProvenance: edge.reviewProvenance ?? (source === 'UPSTREAM_SOURCE' ? 'beijing-upstream' : null),
          reason: edge.reason ?? null,
          reviewedBy: edge.reviewedBy ?? null,
          reviewedAt: edge.reviewedAt ?? null,
          reviewerRole: edge.reviewerRole ?? null,
        },
      });
    }
  }
}

function uniqueById<T extends { id: string }>(items: T[], label: string): Map<string, T> {
  const result = new Map<string, T>();
  for (const item of items) {
    if (result.has(item.id)) throw new Error(`Duplicate ${label} id ${item.id}`);
    result.set(item.id, item);
  }
  return result;
}

function mergeTopic(base: TaxonomyTopic, translation: BeijingTaxonomyInput['translatedTopics'][number]): TaxonomyTopic {
  return { ...base, ...translation };
}

function mapNodeType(type: string): NodeType {
  switch (type) {
    case 'PROCEDURAL': return NodeType.SKILL;
    case 'META': return NodeType.APPLICATION;
    case 'CONCEPTUAL':
    case 'REPRESENTATIONAL':
    case 'LANGUAGE': return NodeType.KNOWLEDGE;
    default: throw new Error(`Unsupported Beijing taxonomy topic type ${type}`);
  }
}

function mapGranularity(type: string): Granularity {
  switch (type) {
    case 'PROCEDURAL':
    case 'META': return Granularity.L3_CAPABILITY;
    case 'CONCEPTUAL':
    case 'REPRESENTATIONAL':
    case 'LANGUAGE': return Granularity.L2_CONCEPT;
    default: throw new Error(`Unsupported Beijing taxonomy topic type ${type}`);
  }
}

function mapEdgeStrength(strength: string): EdgeStrength {
  switch (strength) {
    case 'hard': return EdgeStrength.REQUIRED;
    case 'soft': return EdgeStrength.IMPORTANT;
    default: throw new Error(`Unsupported Beijing taxonomy edge strength ${strength}`);
  }
}
