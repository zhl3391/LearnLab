import {
  EdgeStrength,
  EdgeType,
  Granularity,
  NodeType,
} from '../domain/model';
import { ImportGraphData } from '../application/import-model';

export interface MarbleTopic {
  id: string;
  type: 'CONCEPTUAL' | 'PROCEDURAL' | 'REPRESENTATIONAL' | 'LANGUAGE' | 'META';
  subject: string;
  domain: string;
  name: string;
  description: string;
  ageRangeStart: number;
  ageRangeEnd: number;
  centrality: number;
  evidence: string[];
  assessmentPrompt: string;
  standards: string[];
}

export interface MarbleTopicsFile {
  version: string;
  topicCount: number;
  topics: MarbleTopic[];
}

export interface MarbleDependency {
  topicId: string;
  prerequisiteId: string;
  strength: 'hard' | 'soft';
  reason: string;
}

export interface MarbleDependenciesFile {
  version: string;
  edgeCount: number;
  dependencies: MarbleDependency[];
}

export function mapMarbleTaxonomy(
  topicsFile: MarbleTopicsFile,
  dependenciesFile: MarbleDependenciesFile,
): ImportGraphData {
  const topicsById = new Map(topicsFile.topics.map((topic) => [topic.id, topic]));
  const topicKeys = new Set<string>();
  const topics: ImportGraphData['topics'] = [];
  const nodes: ImportGraphData['nodes'] = [];
  const memberships: ImportGraphData['memberships'] = [];

  for (const topic of topicsFile.topics) {
    const subjectKey = `subject:${topic.subject}`;
    const domainKey = `domain:${topic.subject}:${topic.domain}`;

    if (!topicKeys.has(subjectKey)) {
      topics.push({ key: subjectKey, name: topic.subject });
      topicKeys.add(subjectKey);
    }
    if (!topicKeys.has(domainKey)) {
      topics.push({ key: domainKey, name: topic.domain, parentKey: subjectKey });
      topicKeys.add(domainKey);
    }

    nodes.push({
      key: topic.id,
      title: topic.name,
      description: topic.description,
      type: mapNodeType(topic.type),
      granularity: mapGranularity(topic.type),
      metadata: {
        ageRange: { start: topic.ageRangeStart, end: topic.ageRangeEnd },
        centrality: topic.centrality,
        evidence: topic.evidence,
        assessmentPrompt: topic.assessmentPrompt,
        standards: topic.standards,
        taxonomyVersion: topicsFile.version,
      },
    });
    memberships.push({ topicKey: domainKey, nodeKey: topic.id });
  }

  const edges: ImportGraphData['edges'] = [];
  for (const dependency of dependenciesFile.dependencies) {
    if (!topicsById.has(dependency.topicId)) {
      throw new Error(`Marble dependency references missing topic ${dependency.topicId}`);
    }
    if (!topicsById.has(dependency.prerequisiteId)) {
      throw new Error(
        `Marble dependency references missing prerequisite ${dependency.prerequisiteId}`,
      );
    }
    edges.push({
      sourceNodeKey: dependency.prerequisiteId,
      targetNodeKey: dependency.topicId,
      type: EdgeType.PREREQUISITE,
      strength:
        dependency.strength === 'hard'
          ? EdgeStrength.REQUIRED
          : EdgeStrength.IMPORTANT,
    });
  }

  return { topics, nodes, memberships, edges };
}

function mapNodeType(type: MarbleTopic['type']): NodeType {
  switch (type) {
    case 'PROCEDURAL':
      return NodeType.SKILL;
    case 'META':
      return NodeType.APPLICATION;
    case 'CONCEPTUAL':
    case 'REPRESENTATIONAL':
    case 'LANGUAGE':
      return NodeType.KNOWLEDGE;
  }
}

function mapGranularity(type: MarbleTopic['type']): Granularity {
  switch (type) {
    case 'PROCEDURAL':
    case 'META':
      return Granularity.L3_CAPABILITY;
    case 'CONCEPTUAL':
    case 'REPRESENTATIONAL':
    case 'LANGUAGE':
      return Granularity.L2_CONCEPT;
  }
}
