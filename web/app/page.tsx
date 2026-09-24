'use client';

import { useEffect, useMemo, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3210';
const PAGE_SIZE = 25;

type NodeType = 'KNOWLEDGE' | 'SKILL' | 'APPLICATION';
type Granularity = 'L1_DOMAIN' | 'L2_CONCEPT' | 'L3_CAPABILITY' | 'L4_SPECIFIC';
type EdgeType = 'PREREQUISITE' | 'PART_OF' | 'RELATED';
type EdgeStrength = 'REQUIRED' | 'IMPORTANT' | 'HELPFUL';

type Topic = { id: string; name: string; parentId: string | null; parent?: Topic | null };
type NodeItem = {
  id: string;
  title: string;
  description: string | null;
  type: NodeType;
  granularity: Granularity;
  difficulty: number | null;
  metadata: Record<string, unknown> | null;
  memberships: { topic: Topic }[];
  _count?: { incomingEdges: number; outgoingEdges: number };
};
type Edge = {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  type: EdgeType;
  strength: EdgeStrength;
  sourceNode?: Pick<NodeItem, 'id' | 'title'>;
  targetNode?: Pick<NodeItem, 'id' | 'title'>;
  metadata?: Record<string, unknown> | null;
};
type NodeDetails = NodeItem & { incomingEdges: Edge[]; outgoingEdges: Edge[] };
type NodePage = { items: NodeItem[]; page: number; pageSize: number; total: number; totalPages: number };

const typeLabels: Record<NodeType, string> = { KNOWLEDGE: '知识', SKILL: '技能', APPLICATION: '应用' };
const grainLabels: Record<Granularity, string> = { L1_DOMAIN: '领域', L2_CONCEPT: '概念', L3_CAPABILITY: '能力', L4_SPECIFIC: '具体' };
const edgeLabels: Record<EdgeType, string> = { PREREQUISITE: '前置', PART_OF: '组成', RELATED: '相关' };
const strengthLabels: Record<EdgeStrength, string> = { REQUIRED: '必要', IMPORTANT: '重要', HELPFUL: '有帮助' };

export default function Home() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [nodes, setNodes] = useState<NodeItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [granularity, setGranularity] = useState('');
  const [topicId, setTopicId] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<NodeDetails | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API_URL}/learning-graph/topics`, { signal: controller.signal })
      .then(assertOk)
      .then((response) => response.json() as Promise<Topic[]>)
      .then(setTopics)
      .catch((reason: Error) => { if (reason.name !== 'AbortError') setError(reason.message); });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (search.trim()) params.set('search', search.trim());
      if (type) params.set('type', type);
      if (granularity) params.set('granularity', granularity);
      if (topicId) params.set('topicId', topicId);

      setLoadingList(true);
      fetch(`${API_URL}/learning-graph/nodes?${params}`, { signal: controller.signal })
        .then(assertOk)
        .then((response) => response.json() as Promise<NodePage>)
        .then((result) => {
          setNodes(result.items);
          setTotal(result.total);
          setTotalPages(result.totalPages);
          setError(null);
          if (selectedId && !result.items.some((node) => node.id === selectedId)) {
            setSelectedId(null);
            setSelected(null);
          }
        })
        .catch((reason: Error) => { if (reason.name !== 'AbortError') setError(reason.message); })
        .finally(() => { if (!controller.signal.aborted) setLoadingList(false); });
    }, search ? 180 : 0);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [page, search, type, granularity, topicId]);

  useEffect(() => {
    if (!selectedId) { setSelected(null); return; }
    const controller = new AbortController();
    setLoadingDetails(true);
    fetch(`${API_URL}/learning-graph/nodes/${selectedId}`, { signal: controller.signal })
      .then(assertOk)
      .then((response) => response.json() as Promise<NodeDetails>)
      .then(setSelected)
      .catch((reason: Error) => { if (reason.name !== 'AbortError') setError(reason.message); })
      .finally(() => { if (!controller.signal.aborted) setLoadingDetails(false); });
    return () => controller.abort();
  }, [selectedId]);

  const rootTopics = useMemo(() => topics.filter((topic) => !topic.parentId), [topics]);
  const visibleStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const visibleEnd = Math.min(page * PAGE_SIZE, total);

  function updateFilter(setter: (value: string) => void, value: string) {
    setter(value);
    setPage(1);
  }

  return (
    <main className="review-shell">
      <header className="review-header">
        <div className="review-brand"><span className="brand-mark">LL</span><div><strong>LEARNLAB</strong><span>LEARNING GRAPH / 数据核查</span></div></div>
        <div className="api-status"><i />只读检查 <span>{new URL(API_URL).host}</span></div>
      </header>

      <section className="review-toolbar" aria-label="节点筛选">
        <label className="review-search"><SearchGlyph /><input value={search} onChange={(event) => updateFilter(setSearch, event.target.value)} placeholder="按名称或描述搜索" /></label>
        <select value={topicId} onChange={(event) => updateFilter(setTopicId, event.target.value)} aria-label="按主题筛选">
          <option value="">所有主题</option>
          {rootTopics.map((root) => <optgroup label={root.name} key={root.id}>{topics.filter((topic) => topic.parentId === root.id).map((topic) => <option value={topic.id} key={topic.id}>{topic.name}</option>)}</optgroup>)}
        </select>
        <select value={type} onChange={(event) => updateFilter(setType, event.target.value)} aria-label="按节点类型筛选">
          <option value="">所有类型</option><option value="KNOWLEDGE">知识</option><option value="SKILL">技能</option><option value="APPLICATION">应用</option>
        </select>
        <select value={granularity} onChange={(event) => updateFilter(setGranularity, event.target.value)} aria-label="按粒度筛选">
          <option value="">所有粒度</option><option value="L1_DOMAIN">领域</option><option value="L2_CONCEPT">概念</option><option value="L3_CAPABILITY">能力</option><option value="L4_SPECIFIC">具体</option>
        </select>
        <button className="clear-filters" onClick={() => { setSearch(''); setType(''); setGranularity(''); setTopicId(''); setPage(1); }}>清除</button>
      </section>

      {error && <div className="review-error">读取失败：{error} <span>请确认 API 地址 {API_URL}</span></div>}

      <section className="review-heading">
        <div><p className="eyebrow">GRAPH RECORDS</p><h1>数据核查</h1></div>
        <div className="result-count"><strong>{total.toLocaleString()}</strong><span>条匹配记录</span></div>
      </section>

      <section className="review-workspace">
        <div className="table-card">
          <div className="table-caption"><span>LearningNode</span><span>{visibleStart}–{visibleEnd} / {total.toLocaleString()}</span></div>
          <div className="table-scroll">
            <div className="record-table" role="table" aria-label="LearningNode 数据列表">
              <div className="record-header" role="row"><span>节点</span><span>主题</span><span>类型 / 粒度</span><span>前置</span><span>后续</span><span>核查</span></div>
              {loadingList ? <TableLoading /> : nodes.length === 0 ? <div className="table-empty">没有匹配记录</div> : nodes.map((node) => <RecordRow node={node} selected={node.id === selectedId} key={node.id} onSelect={() => setSelectedId(node.id)} />)}
            </div>
          </div>
          <nav className="pagination" aria-label="节点分页"><span>每页 {PAGE_SIZE} 条</span><div><button disabled={page <= 1 || loadingList} onClick={() => setPage((current) => current - 1)}>上一页</button><span>{page} / {Math.max(totalPages, 1)}</span><button disabled={page >= totalPages || loadingList} onClick={() => setPage((current) => current + 1)}>下一页</button></div></nav>
        </div>

        <aside className="inspect-panel" aria-label="节点核查详情">
          {!selectedId && <div className="inspect-placeholder"><span className="placeholder-index">RECORD / —</span><h2>选择一条记录</h2><p>核对节点字段、主题归属和每条关系的方向及强度。</p></div>}
          {selectedId && loadingDetails && <div className="inspect-placeholder"><span className="placeholder-index">LOADING RECORD</span><h2>正在读取…</h2></div>}
          {selected && !loadingDetails && <NodeInspector node={selected} topics={topics} onSelectNode={setSelectedId} />}
        </aside>
      </section>
      <footer className="review-footer"><span>字段来自 Learning Graph 当前存储值</span><span>关系方向按 source → target 显示</span></footer>
    </main>
  );
}

function RecordRow({ node, selected, onSelect }: { node: NodeItem; selected: boolean; onSelect: () => void }) {
  const checks = [!node.description && '缺描述', node.memberships.length === 0 && '无主题', !node.metadata && '无来源数据'].filter(Boolean) as string[];
  return <button className={`record-row ${selected ? 'record-row-selected' : ''}`} role="row" onClick={onSelect}>
    <span className="record-node"><strong>{node.title}</strong><small className="record-id">{node.id}</small></span>
    <span className="record-topic">{node.memberships.map(({ topic }) => topic.name).join('、') || <em>未归类</em>}</span>
    <span className="record-kinds"><b className={`kind kind-${node.type.toLowerCase()}`}>{typeLabels[node.type]}</b><small>{grainLabels[node.granularity]}</small></span>
    <span className="edge-count">{node._count?.incomingEdges ?? '—'}</span><span className="edge-count">{node._count?.outgoingEdges ?? '—'}</span>
    <span className="check-flags">{checks.length ? checks.map((check) => <i key={check}>{check}</i>) : <b>字段齐全</b>}</span>
  </button>;
}

function NodeInspector({ node, topics, onSelectNode }: { node: NodeDetails; topics: Topic[]; onSelectNode: (id: string) => void }) {
  const metadata = node.metadata ?? {};
  const ageRange = asRecord(metadata.ageRange);
  const evidence = Array.isArray(metadata.evidence) ? metadata.evidence.filter((value): value is string => typeof value === 'string') : [];
  const standards = Array.isArray(metadata.standards) ? metadata.standards.filter((value): value is string => typeof value === 'string') : [];
  const topicMap = new Map(topics.map((topic) => [topic.id, topic]));
  const memberships = node.memberships.map(({ topic }) => ({ ...topic, parent: topicMap.get(topic.parentId ?? '') ?? null }));

  return <div className="inspector-content">
    <div className="inspector-kicker"><span>NODE RECORD</span><button onClick={() => navigator.clipboard?.writeText(node.id)} title="复制节点 ID">复制 ID</button></div>
    <h2>{node.title}</h2>
    <code className="full-id">{node.id}</code>

    <section className="inspect-section"><SectionTitle index="A" title="节点字段" /><div className="field-grid">
      <Field label="类型" value={typeLabels[node.type]} raw={node.type} />
      <Field label="粒度" value={grainLabels[node.granularity]} raw={node.granularity} />
      <Field label="难度" value={node.difficulty == null ? '未设置' : `${node.difficulty} / 5`} raw={node.difficulty} />
      <Field label="描述" value={node.description || '未填写'} wide />
    </div></section>

    <section className="inspect-section"><SectionTitle index="B" title="主题归属" /><div className="topic-audit">{memberships.length ? memberships.map((topic) => <div className="topic-audit-row" key={topic.id}><span>{topic.parent?.name ?? '根主题'}</span><b>›</b><strong>{topic.name}</strong><code>{topic.id}</code></div>) : <div className="missing-value">该节点没有 TopicMembership</div>}</div></section>

    <section className="inspect-section"><SectionTitle index="C" title="学习关系" /><div className="relation-summary"><span><b>{node.incomingEdges.length}</b> 条指向本节点</span><span><b>{node.outgoingEdges.length}</b> 条从本节点指出</span></div>
      <div className="edge-ledger">
        {node.incomingEdges.map((edge) => <EdgeRow edge={edge} currentId={node.id} key={edge.id} onSelectNode={onSelectNode} />)}
        {node.outgoingEdges.map((edge) => <EdgeRow edge={edge} currentId={node.id} key={edge.id} onSelectNode={onSelectNode} />)}
        {node.incomingEdges.length + node.outgoingEdges.length === 0 && <div className="missing-value">该节点当前没有关联边</div>}
      </div>
      <p className="related-note">RELATED 表示知识相关；展示的 source / target 存储方向不代表学习顺序。</p>
    </section>

    <section className="inspect-section"><SectionTitle index="D" title="来源与学习证据" /><div className="source-fields">
      <Field label="年龄段" value={ageRange ? `${String(ageRange.start ?? '—')}–${String(ageRange.end ?? '—')} 岁` : '未提供'} raw={metadata.ageRange} />
      <Field label="中心度" value={typeof metadata.centrality === 'number' ? metadata.centrality.toFixed(4) : '未提供'} raw={metadata.centrality} />
      <Field label="分类版本" value={typeof metadata.taxonomyVersion === 'string' ? metadata.taxonomyVersion : '未提供'} raw={metadata.taxonomyVersion} />
      <Field label="来源类别" value={metadata.origin === 'cn_only' ? '中国特有' : metadata.origin === 'upstream' ? '上游译文' : '未标记'} raw={metadata.origin} />
      <Field label="翻译状态" value={metadata.translationStatus === 'reviewed' ? '已校对' : metadata.translationStatus === 'machine' ? '机器翻译' : '未标记'} raw={metadata.translationStatus} />
      <Field label="原始分类 / 学段" value={`${String(metadata.taxonomyType ?? '—')} / ${String(metadata.stage ?? '—')}`} raw={metadata.nodeKind} />
      <Field label="评估提示" value={typeof metadata.assessmentPrompt === 'string' ? metadata.assessmentPrompt : '未提供'} raw={metadata.assessmentPrompt} wide />
      <div className="source-list"><span>掌握证据 · {evidence.length}</span>{evidence.length ? <ul>{evidence.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul> : <div className="missing-value">未提供 evidence</div>}</div>
      <div className="source-list"><span>课程标准 · {standards.length}</span>{standards.length ? <div className="standard-tags">{standards.map((standard) => <code key={standard}>{standard}</code>)}</div> : <div className="missing-value">未关联标准</div>}</div>
      <details className="raw-metadata"><summary>查看完整 metadata JSON</summary><pre>{JSON.stringify(metadata, null, 2)}</pre></details>
    </div></section>
  </div>;
}

function EdgeRow({ edge, currentId, onSelectNode }: { edge: Edge; currentId: string; onSelectNode: (id: string) => void }) {
  const source = edge.sourceNode ?? { id: edge.sourceNodeId, title: `未加载端点 · ${edge.sourceNodeId}` };
  const target = edge.targetNode ?? { id: edge.targetNodeId, title: `未加载端点 · ${edge.targetNodeId}` };
  const metadata = edge.metadata ?? {};
  const reviewStatus = typeof metadata.reviewStatus === 'string' ? metadata.reviewStatus : null;
  const reviewLabels: Record<string, string> = { SOURCE: '上游来源', REVIEWED: '已复核', NEEDS_REVIEW: '待复核' };
  const reason = typeof metadata.reason === 'string' ? metadata.reason : null;
  return <div className="edge-row">
    <button onClick={() => onSelectNode(source.id)} className={source.id === currentId ? 'edge-node edge-node-current' : 'edge-node'}>{source.title}</button>
    <span className="edge-arrow">→</span>
    <button onClick={() => onSelectNode(target.id)} className={target.id === currentId ? 'edge-node edge-node-current' : 'edge-node'}>{target.title}</button>
    <span className={`edge-kind edge-${edge.type.toLowerCase()}`}>{edgeLabels[edge.type]}</span>
    <span className="edge-strength">{strengthLabels[edge.strength]}</span>
    {(reviewStatus || reason) && <div className="edge-annotation">
      {reviewStatus && <span className={`edge-review edge-review-${reviewStatus.toLowerCase()}`}>{reviewLabels[reviewStatus] ?? reviewStatus}</span>}
      {reason && <p>{reason}</p>}
      {typeof metadata.reviewProvenance === 'string' && <small>依据：{metadata.reviewProvenance}</small>}
    </div>}
  </div>;
}

function Field({ label, value, raw, wide = false }: { label: string; value: string; raw?: unknown; wide?: boolean }) {
  return <div className={`field ${wide ? 'field-wide' : ''}`}><span>{label}</span><strong>{value}</strong>{raw !== undefined && raw !== null && <code>{typeof raw === 'string' ? raw : JSON.stringify(raw)}</code>}</div>;
}

function SectionTitle({ index, title }: { index: string; title: string }) { return <h3 className="section-title"><span>{index}</span>{title}</h3>; }
function TableLoading() { return <div className="table-empty">正在读取节点记录…</div>; }
function SearchGlyph() { return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.3" /><path d="m16 16 4 4" /></svg>; }
function assertOk(response: Response) { if (!response.ok) throw new Error(`HTTP ${response.status}`); return response; }
function asRecord(value: unknown): Record<string, unknown> | null { return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null; }
