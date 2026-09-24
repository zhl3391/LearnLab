import {
  assertCanAddEdge,
  EdgeStrength,
  EdgeType,
  GraphRuleError,
} from './model';

describe('Learning Graph rules', () => {
  const snapshot = {
    nodes: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
    edges: [
      {
        sourceNodeId: 'a',
        targetNodeId: 'b',
        type: EdgeType.PREREQUISITE,
        strength: EdgeStrength.REQUIRED,
      },
      {
        sourceNodeId: 'b',
        targetNodeId: 'c',
        type: EdgeType.PREREQUISITE,
        strength: EdgeStrength.REQUIRED,
      },
    ],
  };

  it('rejects a prerequisite cycle', () => {
    expect(() =>
      assertCanAddEdge(snapshot, {
        sourceNodeId: 'c',
        targetNodeId: 'a',
        type: EdgeType.PREREQUISITE,
        strength: EdgeStrength.REQUIRED,
      }),
    ).toThrow(GraphRuleError);
  });

  it('allows extending a prerequisite DAG', () => {
    expect(
      assertCanAddEdge(snapshot, {
        sourceNodeId: 'a',
        targetNodeId: 'c',
        type: EdgeType.PREREQUISITE,
        strength: EdgeStrength.IMPORTANT,
      }),
    ).toMatchObject({ sourceNodeId: 'a', targetNodeId: 'c' });
  });

  it('allows a related edge to connect nodes already in a prerequisite path', () => {
    expect(
      assertCanAddEdge(snapshot, {
        sourceNodeId: 'c',
        targetNodeId: 'a',
        type: EdgeType.RELATED,
        strength: EdgeStrength.HELPFUL,
      }),
    ).toMatchObject({ sourceNodeId: 'a', targetNodeId: 'c' });
  });

  it('rejects missing endpoints and self edges', () => {
    expect(() =>
      assertCanAddEdge(snapshot, {
        sourceNodeId: 'missing',
        targetNodeId: 'a',
        type: EdgeType.PART_OF,
        strength: EdgeStrength.IMPORTANT,
      }),
    ).toThrow(GraphRuleError);

    expect(() =>
      assertCanAddEdge(snapshot, {
        sourceNodeId: 'a',
        targetNodeId: 'a',
        type: EdgeType.RELATED,
        strength: EdgeStrength.HELPFUL,
      }),
    ).toThrow(GraphRuleError);
  });
});
