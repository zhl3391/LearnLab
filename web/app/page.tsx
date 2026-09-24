'use client';

import { useEffect, useMemo, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3210';
type NodeType = 'KNOWLEDGE' | 'SKILL' | 'APPLICATION';
type Granularity = 'L1_DOMAIN' | 'L2_CONCEPT' | 'L3_CAPABILITY' | 'L4_SPECIFIC';
type Topic = { id: string; name: string; parentId: string | null };
type NodeItem = { id: string; title: string; description: string | null; type: NodeType; granularity: Granularity; memberships: { topic: Topic }[] };
type NodeDetails = NodeItem & { incomingEdges: { strength: string; sourceNode: NodeItem }[]; outgoingEdges: { strength: string; targetNode: NodeItem }[] };

const typeLabels: Record<NodeType, string> = { KNOWLEDGE: '知识', SKILL: '技能', APPLICATION: '应用' };
const granularityLabels: Record<Granularity, string> = { L1_DOMAIN: '领域', L2_CONCEPT: '概念', L3_CAPABILITY: '能力', L4_SPECIFIC: '具体' };

export default function Home() {
  const [nodes, setNodes] = useState<NodeItem[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<NodeDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/learning-graph/topics`)
      .then((response) => { if (!response.ok) throw new Error('无法读取主题'); return response.json() as Promise<Topic[]>; })
      .then(setTopics)
      .catch((reason: Error) => setError(reason.message));
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ page: '1', pageSize: '12' });
      if (search.trim()) params.set('search', search.trim());
      if (type) params.set('type', type);
      setLoading(true);
      fetch(`${API_URL}/learning-graph/nodes?${params}`)
        .then((response) => { if (!response.ok) throw new Error('无法读取知识节点'); return response.json() as Promise<{ items: NodeItem[]; total: number }>; })
        .then((result) => { setNodes(result.items); setTotal(result.total); setError(null); })
        .catch((reason: Error) => setError(reason.message))
        .finally(() => setLoading(false));
    }, 180);
    return () => clearTimeout(timer);
  }, [search, type]);

  useEffect(() => {
    if (!selectedId) { setSelected(null); return; }
    fetch(`${API_URL}/learning-graph/nodes/${selectedId}`)
      .then((response) => { if (!response.ok) throw new Error('无法读取节点详情'); return response.json() as Promise<NodeDetails>; })
      .then(setSelected)
      .catch((reason: Error) => setError(reason.message));
  }, [selectedId]);

  const subjectCount = useMemo(() => topics.filter((topic) => !topic.parentId).length, [topics]);

  return (
    <main className="atlas-shell">
      <aside className="rail">
        <div className="brand-mark">LL</div><div className="rail-copy">LEARN<br />LAB</div><div className="rail-line" />
        <button className="rail-nav rail-nav-active" aria-label="知识地图"><MapGlyph /><span>地图</span></button>
        <button className="rail-nav" aria-label="主题"><GridGlyph /><span>主题</span></button>
        <div className="rail-bottom">v0.1</div>
      </aside>
      <section className="atlas-content">
        <header className="topbar"><div className="crumb"><span>LEARNLAB</span><i>/</i><strong>LEARNING ATLAS</strong></div><div className="connection"><span className="connection-dot" /> LIVE GRAPH <span className="connection-port">:3210</span></div></header>
        <section className="hero-grid">
          <div className="hero-copy"><p className="eyebrow">知识基础层 · KNOWLEDGE FOUNDATION</p><h1>看见知识<br /><em>如何相互依赖。</em></h1><p className="hero-lede">浏览 Learning Graph 中可独立学习的知识、技能与应用，沿着每条前置关系追溯学习基础。</p><div className="stat-row"><Stat value="1,590" label="学习节点" /><Stat value="3,221" label="前置关系" /><Stat value={String(subjectCount || 8)} label="主题领域" /></div></div>
          <GraphStamp />
        </section>
        <section className="workspace">
          <div className="workspace-head"><div><p className="eyebrow">EXPLORE THE GRAPH</p><h2>节点索引 <span>{total.toLocaleString()}</span></h2></div><div className="filter-row"><label className="search-box"><SearchGlyph /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索知识节点…" /></label><select value={type} onChange={(event) => setType(event.target.value)} aria-label="按类型筛选"><option value="">全部类型</option><option value="KNOWLEDGE">知识</option><option value="SKILL">技能</option><option value="APPLICATION">应用</option></select></div></div>
          {error && <div className="error-note">{error} · 请确认 API 正在运行于 {API_URL}</div>}
          <div className="results-layout"><div className="node-list" aria-live="polite">{loading ? <LoadingRows /> : nodes.length === 0 ? <EmptyState /> : nodes.map((node, index) => <button className={`node-row ${selectedId === node.id ? 'node-row-active' : ''}`} key={node.id} onClick={() => setSelectedId(node.id)}><span className="node-index">{String(index + 1).padStart(2, '0')}</span><span className="node-main"><strong>{node.title}</strong><small>{node.description ?? '暂无描述'}</small></span><span className={`type-pill type-${node.type.toLowerCase()}`}>{typeLabels[node.type]}</span><span className="node-grain">{granularityLabels[node.granularity]}</span><ChevronGlyph /></button>)}</div><DetailPanel node={selected} onClose={() => setSelectedId(null)} /></div>
        </section>
      </section>
    </main>
  );
}

function Stat({ value, label }: { value: string; label: string }) { return <div className="stat"><strong>{value}</strong><span>{label}</span></div>; }

function GraphStamp() { return <div className="graph-stamp" aria-label="Learning Graph prerequisite preview"><div className="stamp-label">PREREQUISITE SPINE <span>LIVE</span></div><svg viewBox="0 0 520 310" role="img"><defs><linearGradient id="spine" x1="0" x2="1"><stop offset="0" stopColor="#f5b642" /><stop offset="1" stopColor="#e36b43" /></linearGradient></defs><path className="graph-line faint" d="M65 230 C140 196, 130 130, 210 158 S300 230, 360 155 S422 76, 482 85" /><path className="graph-line faint" d="M65 230 C130 267, 176 270, 210 158 S318 86, 360 155" /><path className="graph-line main" d="M65 230 C140 196, 130 130, 210 158 S300 230, 360 155 S422 76, 482 85" /><g className="graph-node node-a"><circle cx="65" cy="230" r="13" /><circle cx="65" cy="230" r="4" /></g><g className="graph-node node-b"><circle cx="210" cy="158" r="11" /><circle cx="210" cy="158" r="4" /></g><g className="graph-node node-c"><circle cx="360" cy="155" r="15" /><circle cx="360" cy="155" r="4" /></g><g className="graph-node node-d"><circle cx="482" cy="85" r="10" /><circle cx="482" cy="85" r="4" /></g><text x="43" y="272">基础</text><text x="186" y="125">概念</text><text x="337" y="198">能力</text><text x="449" y="55">迁移</text></svg><div className="stamp-footer"><span>每个节点都是一件可被掌握的事物</span><span>↗ 关系可追溯</span></div></div>; }

function DetailPanel({ node, onClose }: { node: NodeDetails | null; onClose: () => void }) {
  if (!node) return <aside className="detail-panel detail-empty"><div className="detail-orbit" /><p>选择一个节点<br />查看它的知识邻域</p></aside>;
  return <aside className="detail-panel"><button className="close-detail" onClick={onClose} aria-label="关闭详情">×</button><p className="eyebrow">NODE DETAIL</p><h3>{node.title}</h3><div className="detail-tags"><span className={`type-pill type-${node.type.toLowerCase()}`}>{typeLabels[node.type]}</span><span className="grain-tag">{granularityLabels[node.granularity]}</span></div><p className="detail-description">{node.description ?? '这个节点暂时还没有描述。'}</p><div className="detail-section"><span className="detail-label">所属主题</span><div className="topic-stack">{node.memberships.map(({ topic }) => <span key={topic.id}>{topic.name}</span>)}</div></div><div className="relation-grid"><Relation label="前置知识" count={node.incomingEdges.length} /><Relation label="支持后续" count={node.outgoingEdges.length} /></div><div className="detail-section"><span className="detail-label">关系预览</span><div className="relation-list">{node.incomingEdges.slice(0, 3).map((edge) => <div key={edge.sourceNode.id}><span className="relation-arrow">←</span>{edge.sourceNode.title}</div>)}{node.outgoingEdges.slice(0, 3).map((edge) => <div key={edge.targetNode.id}><span className="relation-arrow">→</span>{edge.targetNode.title}</div>)}</div></div></aside>;
}

function Relation({ label, count }: { label: string; count: number }) { return <div className="relation-count"><strong>{count}</strong><span>{label}</span></div>; }
function LoadingRows() { return <>{[1, 2, 3, 4].map((key) => <div className="skeleton-row" key={key}><span /><span /><span /></div>)}</>; }
function EmptyState() { return <div className="empty-state">没有找到匹配的节点。<br /><small>试试换个关键词，或者清空筛选条件。</small></div>; }
function MapGlyph() { return <svg viewBox="0 0 24 24"><path d="M4 6.5 9 4l6 2.5L20 4v13.5L15 20l-6-2.5L4 20V6.5Z" /><path d="M9 4v13.5M15 6.5V20" /></svg>; }
function GridGlyph() { return <svg viewBox="0 0 24 24"><rect x="4" y="4" width="6" height="6" /><rect x="14" y="4" width="6" height="6" /><rect x="4" y="14" width="6" height="6" /><rect x="14" y="14" width="6" height="6" /></svg>; }
function SearchGlyph() { return <svg viewBox="0 0 24 24"><circle cx="10.8" cy="10.8" r="6.3" /><path d="m16 16 4 4" /></svg>; }
function ChevronGlyph() { return <svg className="chevron" viewBox="0 0 24 24"><path d="m9 5 7 7-7 7" /></svg>; }
