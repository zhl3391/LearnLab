import { EdgeStrength, EdgeType, Granularity, NodeType } from '../domain/model';
import { mapMarbleTaxonomy } from './marble-taxonomy.mapper';

describe('Marble taxonomy mapper', () => {
  it('maps Marble topics and dependency direction into the Learning Graph model', () => {
    const graph = mapMarbleTaxonomy(
      {
        version: 'v1',
        topicCount: 2,
        topics: [
          {
            id: 'mt_a',
            type: 'CONCEPTUAL',
            subject: 'Mathematics',
            domain: 'Number',
            name: 'Counting',
            description: 'Count objects',
            ageRangeStart: 4,
            ageRangeEnd: 6,
            centrality: 0.5,
            evidence: ['Counts ten objects'],
            assessmentPrompt: 'Can they count?',
            standards: [],
          },
          {
            id: 'mt_b',
            type: 'PROCEDURAL',
            subject: 'Mathematics',
            domain: 'Number',
            name: 'Addition',
            description: 'Add numbers',
            ageRangeStart: 5,
            ageRangeEnd: 7,
            centrality: 0.4,
            evidence: [],
            assessmentPrompt: 'Can they add?',
            standards: [],
          },
        ],
      },
      {
        version: 'v1',
        edgeCount: 1,
        dependencies: [
          { topicId: 'mt_b', prerequisiteId: 'mt_a', strength: 'hard', reason: 'Counting first' },
        ],
      },
    );

    expect(graph.nodes[0]).toMatchObject({
      key: 'mt_a',
      type: NodeType.KNOWLEDGE,
      granularity: Granularity.L2_CONCEPT,
    });
    expect(graph.nodes[1]).toMatchObject({
      key: 'mt_b',
      type: NodeType.SKILL,
      granularity: Granularity.L3_CAPABILITY,
    });
    expect(graph.topics).toHaveLength(2);
    expect(graph.memberships).toHaveLength(2);
    expect(graph.edges).toEqual([
      {
        sourceNodeKey: 'mt_a',
        targetNodeKey: 'mt_b',
        type: EdgeType.PREREQUISITE,
        strength: EdgeStrength.REQUIRED,
      },
    ]);
  });
});
