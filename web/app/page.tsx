'use client';

import { useEffect, useMemo, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3210';
const PAGE_SIZE = 25;

type NodeType = 'KNOWLEDGE' | 'SKILL' | 'APPLICATION';
type Granularity = 'L1_DOMAIN' | 'L2_CONCEPT' | 'L3_CAPABILITY' | 'L4_SPECIFIC';
type EdgeType = 'PREREQUISITE' | 'PART_OF' | 'RELATED';
type EdgeStrength = 'REQUIRED' | 'IMPORTANT' | 'HELPFUL';
type EdgeReviewStatus = 'SOURCE' | 'NEEDS_REVIEW' | 'REVIEWED' | 'REJECTED';
type EdgeReviewDecision = 'APPROVE' | 'REJECT';

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
  reviewStatus: EdgeReviewStatus;
  sourceNode?: Pick<NodeItem, 'id' | 'title'>;
  targetNode?: Pick<NodeItem, 'id' | 'title'>;
  metadata?: Record<string, unknown> | null;
  reviews?: EdgeReviewEvent[];
};
type EdgeReviewEvent = { id: string; decision: EdgeReviewDecision; reviewer: string; note: string | null; createdAt: string };
type NodeDetails = NodeItem & { incomingEdges: Edge[]; outgoingEdges: Edge[] };
type NodePage = { items: NodeItem[]; page: number; pageSize: number; total: number; totalPages: number };
type EdgePage = { items: Edge[]; page: number; pageSize: number; total: number; totalPages: number; statusCounts: Partial<Record<EdgeReviewStatus, number>> };

const typeLabels: Record<NodeType, string> = { KNOWLEDGE: '知识', SKILL: '技能', APPLICATION: '应用' };
const grainLabels: Record<Granularity, string> = { L1_DOMAIN: '领域', L2_CONCEPT: '概念', L3_CAPABILITY: '能力', L4_SPECIFIC: '具体' };
const edgeLabels: Record<EdgeType, string> = { PREREQUISITE: '前置', PART_OF: '组成', RELATED: '相关' };
const strengthLabels: Record<EdgeStrength, string> = { REQUIRED: '必要', IMPORTANT: '重要', HELPFUL: '有帮助' };
const reviewStatusLabels: Record<EdgeReviewStatus, string> = { SOURCE: '上游来源', NEEDS_REVIEW: '待复核', REVIEWED: '已确认', REJECTED: '已拒绝' };

export default function Home() {
  const [mode, setMode] = useState<'nodes' | 'edges'>('nodes');
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
  const [detailRefresh, setDetailRefresh] = useState(0);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [edgeTotal, setEdgeTotal] = useState(0);
  const [edgeTotalPages, setEdgeTotalPages] = useState(0);
  const [edgePage, setEdgePage] = useState(1);
  const [edgeSearch, setEdgeSearch] = useState('');
  const [edgeStatus, setEdgeStatus] = useState<EdgeReviewStatus | ''>('NEEDS_REVIEW');
  const [edgeType, setEdgeType] = useState('');
  const [edgeStatusCounts, setEdgeStatusCounts] = useState<Partial<Record<EdgeReviewStatus, number>>>({});
  const [edgeLoading, setEdgeLoading] = useState(false);
  const [edgeRefresh, setEdgeRefresh] = useState(0);
  const [reviewer, setReviewer] = useState('');
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewFeedback, setReviewFeedback] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
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
  }, [selectedId, detailRefresh]);

  useEffect(() => {
    setReviewer(window.localStorage.getItem('learnlab-edge-reviewer') ?? '');
  }, []);

  useEffect(() => {
    if (mode !== 'edges') return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ page: String(edgePage), pageSize: String(PAGE_SIZE) });
      if (edgeSearch.trim()) params.set('search', edgeSearch.trim());
      if (edgeStatus) params.set('reviewStatus', edgeStatus);
      if (edgeType) params.set('type', edgeType);
      setEdgeLoading(true);
      fetch(`${API_URL}/learning-graph/edges?${params}`, { signal: controller.signal })
        .then(assertOk)
        .then((response) => response.json() as Promise<EdgePage>)
        .then((result) => {
          setEdges(result.items);
          setEdgeTotal(result.total);
          setEdgeTotalPages(result.totalPages);
          setEdgeStatusCounts(result.statusCounts);
          setError(null);
        })
        .catch((reason: Error) => { if (reason.name !== 'AbortError') setError(reason.message); })
        .finally(() => { if (!controller.signal.aborted) setEdgeLoading(false); });
    }, edgeSearch ? 180 : 0);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [mode, edgePage, edgeSearch, edgeStatus, edgeType, edgeRefresh]);

  const rootTopics = useMemo(() => topics.filter((topic) => !topic.parentId), [topics]);
  const visibleStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const visibleEnd = Math.min(page * PAGE_SIZE, total);

  function updateFilter(setter: (value: string) => void, value: string) {
    setter(value);
    setPage(1);
  }

  async function decideEdge(edge: Edge, decision: EdgeReviewDecision) {
    const reviewerName = reviewer.trim();
    const note = reviewNotes[edge.id]?.trim() ?? '';
    if (!reviewerName) {
      setReviewFeedback({ kind: 'error', text: '请先填写审核人。' });
      return;
    }
    if (decision === 'REJECT' && !note) {
      setReviewFeedback({ kind: 'error', text: '拒绝关系时请填写审核理由。' });
      return;
    }

    setReviewingId(edge.id);
    setReviewFeedback(null);
    try {
      const response = await fetch(`${API_URL}/learning-graph/edges/${edge.id}/reviews`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ decision, reviewer: reviewerName, note: note || undefined }),
      });
      await assertOk(response);
      setReviewNotes((current) => { const next = { ...current }; delete next[edge.id]; return next; });
      setReviewFeedback({ kind: 'success', text: decision === 'APPROVE' ? '关系已确认。' : '关系已拒绝。' });
      setEdgeRefresh((current) => current + 1);
      if (selectedId) setDetailRefresh((current) => current + 1);
      if (selected) fetch(`${API_URL}/learning-graph/nodes/${selected.id}`).then(assertOk).then((result) => result.json() as Promise<NodeDetails>).then(setSelected);
    } catch (reason) {
      setReviewFeedback({ kind: 'error', text: reason instanceof Error ? reason.message : '审核未保存。' });
    } finally {
      setReviewingId(null);
    }
  }

  return (
    <main className="review-shell">
      <header className="review-header">
        <div className="review-brand"><span className="brand-mark">LL</span><div><strong>LEARNLAB</strong><span>LEARNING GRAPH / 数据核查</span></div></div>
        <div className="api-status"><i />审核工作台 <span>{new URL(API_URL).host}</span></div>
      </header>

      <nav className="review-modes" aria-label="核查模式">
        <button className={mode === 'nodes' ? 'review-mode-active' : ''} onClick={() => setMode('nodes')}>节点核查</button>
        <button className={mode === 'edges' ? 'review-mode-active' : ''} onClick={() => { setMode('edges'); setReviewFeedback(null); }}>
          关系审核 <span className="pending-count">{edgeStatusCounts.NEEDS_REVIEW ?? '·'}</span>
        </button>
      </nav>

      {error && <div className="review-error">读取失败：{error} <span>请确认 API 地址 {API_URL}</span></div>}

      {mode === 'nodes' ? <>
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
        <section className="review-heading">
          <div><p className="eyebrow">GRAPH RECORDS</p><h1>节点核查</h1></div>
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
      </> : <>
        <section className="review-heading edge-review-heading">
          <div><p className="eyebrow">EDGE DECISIONS</p><h1>关系审核</h1></div>
          <div className="review-counts">
            <span><b>{edgeStatusCounts.NEEDS_REVIEW ?? 0}</b>待复核</span>
            <span><b>{edgeStatusCounts.REVIEWED ?? 0}</b>已确认</span>
            <span><b>{edgeStatusCounts.REJECTED ?? 0}</b>已拒绝</span>
          </div>
        </section>
        <section className="edge-review-toolbar">
          <label className="review-search"><SearchGlyph /><input value={edgeSearch} onChange={(event) => { setEdgeSearch(event.target.value); setEdgePage(1); }} placeholder="搜索起点或终点名称" /></label>
          <select value={edgeStatus} onChange={(event) => { setEdgeStatus(event.target.value as EdgeReviewStatus | ''); setEdgePage(1); }} aria-label="按审核状态筛选">
            <option value="NEEDS_REVIEW">待复核</option><option value="">全部状态</option><option value="REVIEWED">已确认</option><option value="REJECTED">已拒绝</option><option value="SOURCE">上游来源</option>
          </select>
          <select value={edgeType} onChange={(event) => { setEdgeType(event.target.value); setEdgePage(1); }} aria-label="按关系类型筛选">
            <option value="">所有关系类型</option><option value="PREREQUISITE">前置</option><option value="PART_OF">组成</option><option value="RELATED">相关</option>
          </select>
          <label className="reviewer-field"><span>审核人</span><input value={reviewer} maxLength={120} onChange={(event) => { const value = event.target.value; setReviewer(value); if (value.trim()) window.localStorage.setItem('learnlab-edge-reviewer', value.trim()); else window.localStorage.removeItem('learnlab-edge-reviewer'); }} placeholder="填写姓名" /></label>
        </section>
        {reviewFeedback && <div className={`review-feedback review-feedback-${reviewFeedback.kind}`}>{reviewFeedback.text}</div>}
        <section className="edge-review-card">
          <div className="edge-review-caption"><span>关系记录</span><span>{edgeTotal.toLocaleString()} 条</span></div>
          {edgeLoading ? <TableLoading /> : edges.length === 0 ? <div className="table-empty">当前筛选下没有关系记录</div> : <div className="edge-review-list">{edges.map((edge) => <EdgeReviewRow key={edge.id} edge={edge} reviewer={reviewer} note={reviewNotes[edge.id] ?? ''} busy={reviewingId === edge.id} onNote={(note) => setReviewNotes((current) => ({ ...current, [edge.id]: note }))} onDecide={(decision) => decideEdge(edge, decision)} onOpenNode={(id) => { setMode('nodes'); setSelectedId(id); }} />)}</div>}
          <nav className="pagination" aria-label="关系分页"><span>每页 {PAGE_SIZE} 条 · {edgePage === 0 ? 0 : (edgePage - 1) * PAGE_SIZE + 1}–{Math.min(edgePage * PAGE_SIZE, edgeTotal)}</span><div><button disabled={edgePage <= 1 || edgeLoading} onClick={() => setEdgePage((current) => current - 1)}>上一页</button><span>{edgePage} / {Math.max(edgeTotalPages, 1)}</span><button disabled={edgePage >= edgeTotalPages || edgeLoading} onClick={() => setEdgePage((current) => current + 1)}>下一页</button></div></nav>
        </section>
        <footer className="review-footer"><span>拒绝决定必须填写理由</span><span>每次审核都会保留审核人、时间和备注</span></footer>
      </>}
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

function EdgeReviewRow({ edge, reviewer, note, busy, onNote, onDecide, onOpenNode }: {
  edge: Edge;
  reviewer: string;
  note: string;
  busy: boolean;
  onNote: (note: string) => void;
  onDecide: (decision: EdgeReviewDecision) => void;
  onOpenNode: (id: string) => void;
}) {
  const metadata = edge.metadata ?? {};
  const reason = typeof metadata.reason === 'string' ? metadata.reason : '';
  const latestReview = edge.reviews?.[0];
  const sourceReviewer = typeof metadata.reviewedBy === 'string' ? metadata.reviewedBy : null;
  const sourceReviewedAt = typeof metadata.reviewedAt === 'string' ? metadata.reviewedAt : null;
  const hasReviewer = reviewer.trim().length > 0;
  const canApprove = edge.reviewStatus !== 'REVIEWED';
  const canReject = edge.reviewStatus !== 'REJECTED';

  return <article className="edge-review-row">
    <div className="edge-review-main">
      <div className="edge-review-path">
        <button onClick={() => onOpenNode(edge.sourceNode?.id ?? edge.sourceNodeId)}>{edge.sourceNode?.title ?? edge.sourceNodeId}</button>
        <span>→</span>
        <button onClick={() => onOpenNode(edge.targetNode?.id ?? edge.targetNodeId)}>{edge.targetNode?.title ?? edge.targetNodeId}</button>
      </div>
      <div className="edge-review-tags">
        <span className={`edge-kind edge-${edge.type.toLowerCase()}`}>{edgeLabels[edge.type]}</span>
        <span>{strengthLabels[edge.strength]}</span>
        <span className={`review-status status-${edge.reviewStatus.toLowerCase()}`}>{reviewStatusLabels[edge.reviewStatus]}</span>
      </div>
      {reason && <p className="edge-review-reason">{reason}</p>}
      {(latestReview || sourceReviewer || sourceReviewedAt) && <div className="edge-review-history">
        <span>{latestReview?.reviewer ?? sourceReviewer ?? '来源审核'}</span>
        <time>{formatReviewTime(latestReview?.createdAt ?? sourceReviewedAt)}</time>
        {(latestReview?.note || edge.reviewStatus === 'REVIEWED' && sourceReviewer) && <p>{latestReview?.note ?? '随来源数据标记为已复核'}</p>}
      </div>}
    </div>
    <div className="edge-review-controls">
      <textarea value={note} onChange={(event) => onNote(event.target.value)} maxLength={2000} rows={2} placeholder="审核备注；拒绝时必填" aria-label={`关系 ${edge.sourceNode?.title ?? edge.sourceNodeId} 到 ${edge.targetNode?.title ?? edge.targetNodeId} 的审核备注`} />
      <div>
        <button className="decision-approve" disabled={busy || !canApprove || !hasReviewer} onClick={() => onDecide('APPROVE')}>{busy ? '保存中…' : edge.reviewStatus === 'REVIEWED' ? '已确认' : '确认关系'}</button>
        <button className="decision-reject" disabled={busy || !canReject || !hasReviewer || !note.trim()} onClick={() => onDecide('REJECT')}>{busy ? '保存中…' : edge.reviewStatus === 'REJECTED' ? '已拒绝' : '拒绝关系'}</button>
      </div>
    </div>
  </article>;
}

function EdgeRow({ edge, currentId, onSelectNode }: { edge: Edge; currentId: string; onSelectNode: (id: string) => void }) {
  const source = edge.sourceNode ?? { id: edge.sourceNodeId, title: `未加载端点 · ${edge.sourceNodeId}` };
  const target = edge.targetNode ?? { id: edge.targetNodeId, title: `未加载端点 · ${edge.targetNodeId}` };
  const metadata = edge.metadata ?? {};
  const reviewStatus = edge.reviewStatus;
  const latestReview = edge.reviews?.[0];
  const reason = typeof metadata.reason === 'string' ? metadata.reason : null;
  return <div className="edge-row">
    <button onClick={() => onSelectNode(source.id)} className={source.id === currentId ? 'edge-node edge-node-current' : 'edge-node'}>{source.title}</button>
    <span className="edge-arrow">→</span>
    <button onClick={() => onSelectNode(target.id)} className={target.id === currentId ? 'edge-node edge-node-current' : 'edge-node'}>{target.title}</button>
    <span className={`edge-kind edge-${edge.type.toLowerCase()}`}>{edgeLabels[edge.type]}</span>
    <span className="edge-strength">{strengthLabels[edge.strength]}</span>
    {(reviewStatus || reason) && <div className="edge-annotation">
      {reviewStatus && <span className={`review-status status-${reviewStatus.toLowerCase()}`}>{reviewStatusLabels[reviewStatus]}</span>}
      {reason && <p>{reason}</p>}
      {latestReview && <small>最近审核：{latestReview.reviewer} · {formatReviewTime(latestReview.createdAt)}{latestReview.note ? ` · ${latestReview.note}` : ''}</small>}
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
function formatReviewTime(value?: string | null) { return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : ''; }
