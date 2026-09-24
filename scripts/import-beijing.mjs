import { createHash, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import process from 'node:process';
import { PrismaClient } from '@prisma/client';

if (typeof process.loadEnvFile === 'function' && existsSync('.env')) {
  process.loadEnvFile('.env');
}

const dataBase = process.env.BEIJING_TAXONOMY_RAW_BASE_URL
  ?? 'https://raw.githubusercontent.com/luw2007/os-taxonomy-beijing/main/data';
const upstreamBase = process.env.MARBLE_RAW_BASE_URL
  ?? 'https://raw.githubusercontent.com/withmarbleapp/os-taxonomy/main/data';
const dryRun = process.argv.includes('--dry-run');
const filesToLoad = [
  'topics.zh.json',
  'dependencies.zh.json',
  'cn-topics.json',
  'cn-dependencies.json',
  'cn-bridge-dependencies.json',
  'domains.zh.json',
];

async function downloadJson(base, name) {
  const response = await fetch(`${base}/${name}`);
  if (!response.ok) throw new Error(`Download failed for ${name}: HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  return { bytes, value: JSON.parse(bytes.toString('utf8')) };
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

const { value: manifest } = await downloadJson(dataBase, 'manifest.json');
const [upstreamResult, ...fileResults] = await Promise.all([
  downloadJson(upstreamBase, 'topics.json'),
  ...filesToLoad.map((name) => downloadJson(dataBase, name)),
]);
const dataFiles = Object.fromEntries(filesToLoad.map((name, index) => [name, fileResults[index]]));

for (const name of filesToLoad) {
  const expected = manifest.files?.[name]?.sha256;
  if (!expected) throw new Error(`No manifest checksum for ${name}`);
  const actual = sha256(dataFiles[name].bytes);
  if (actual !== expected) throw new Error(`Checksum mismatch for Beijing taxonomy ${name}`);
}

if (upstreamResult.value.version !== manifest.upstreamVersion) {
  throw new Error(
    `Beijing data expects Marble ${manifest.upstreamVersion}, got ${upstreamResult.value.version}`,
  );
}

const translated = dataFiles['topics.zh.json'].value;
const translatedDependencies = dataFiles['dependencies.zh.json'].value;
const cnTopics = dataFiles['cn-topics.json'].value;
const cnDependencies = dataFiles['cn-dependencies.json'].value;
const bridgeDependencies = dataFiles['cn-bridge-dependencies.json'].value;
const domains = dataFiles['domains.zh.json'].value;

assertCount('topics.zh.json', translated.topics, manifest.counts.topicsZh);
assertCount('dependencies.zh.json', translatedDependencies.dependencies, manifest.counts.dependenciesZh);
assertCount('cn-topics.json', cnTopics.topics, manifest.counts.cnTopics);
assertCount('cn-dependencies.json', cnDependencies.dependencies, manifest.counts.cnDeps);

const { mapBeijingTaxonomy } = await import(
  '../dist/learning-graph/infrastructure/beijing-taxonomy.mapper.js'
);
const mapped = mapBeijingTaxonomy({
  taxonomyVersion: manifest.taxonomyVersion,
  upstreamTopics: upstreamResult.value.topics,
  translatedTopics: translated.topics,
  cnTopics: cnTopics.topics,
  upstreamDependencies: translatedDependencies.dependencies,
  cnDependencies: cnDependencies.dependencies,
  bridgeDependencies: bridgeDependencies.dependencies,
  subjectNames: domains.subjects,
  domainNames: domains.domains,
});

const snapshotHash = createHash('sha256');
snapshotHash.update(`taxonomy=${manifest.taxonomyVersion}\nupstream=${manifest.upstreamVersion}\n`);
snapshotHash.update(`upstream/topics.json=${sha256(upstreamResult.bytes)}\n`);
for (const name of filesToLoad.toSorted()) {
  snapshotHash.update(`${name}=${sha256(dataFiles[name].bytes)}\n`);
}
const checksum = snapshotHash.digest('hex');
const graph = mapped.graph;
const summary = {
  source: graph.source,
  version: graph.version,
  checksum,
  topics: graph.topics.length,
  nodes: graph.nodes.length,
  memberships: graph.memberships.length,
  edges: graph.edges.length,
  rejectedEdgesExcluded: mapped.rejectedEdges,
  machineEdgesMarkedNeedsReview: graph.edges.filter((edge) => edge.metadata?.reviewStatus === 'NEEDS_REVIEW').length,
};

if (dryRun) {
  console.log(JSON.stringify({ dryRun: true, ...summary }, null, 2));
} else {
  await replaceKnownBootstrap(graph, checksum, summary);
}

function assertCount(name, rows, expected) {
  if (!Array.isArray(rows) || rows.length !== expected) {
    throw new Error(`${name} count mismatch: expected ${expected}, got ${Array.isArray(rows) ? rows.length : 'invalid data'}`);
  }
}

async function replaceKnownBootstrap(importGraph, importChecksum, importSummary) {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required in .env');
  const prisma = new PrismaClient();
  try {
    const result = await prisma.$transaction(async (tx) => {
      const [topicCount, nodeCount, membershipCount, edgeCount, runs] = await Promise.all([
        tx.topic.count(),
        tx.learningNode.count(),
        tx.topicMembership.count(),
        tx.learningEdge.count(),
        tx.importRun.findMany(),
      ]);
      const currentCounts = {
        topics: topicCount,
        nodes: nodeCount,
        memberships: membershipCount,
        edges: edgeCount,
      };

      const priorBeijingRun = runs.find((run) => run.source === importSummary.source);
      if (priorBeijingRun) {
        if (priorBeijingRun.version === importSummary.version && priorBeijingRun.checksum === importChecksum
          && priorBeijingRun.topics === topicCount && priorBeijingRun.nodes === nodeCount
          && priorBeijingRun.memberships === membershipCount && priorBeijingRun.edges === edgeCount) {
          return { skipped: true, ...importSummary };
        }
        throw new Error('A Beijing taxonomy snapshot is already initialized. This command does not synchronize or replace it.');
      }

      const emptyDatabase = Object.values(currentCounts).every((count) => count === 0) && runs.length === 0;
      const oldMarbleRun = runs.length === 1 && runs[0].source === 'marble-os-taxonomy'
        && runs[0].version === 'v1'
        && runs[0].topics === topicCount && runs[0].nodes === nodeCount
        && runs[0].memberships === membershipCount && runs[0].edges === edgeCount;
      if (!emptyDatabase && !oldMarbleRun) {
        throw new Error(
          `Refusing to replace unrecognized graph data (${JSON.stringify(currentCounts)}; ${runs.length} import runs).`,
        );
      }

      // The checked Marble bootstrap is replaced atomically; failed writes roll back the old graph.
      await tx.learningEdge.deleteMany();
      await tx.topicMembership.deleteMany();
      await tx.learningNode.deleteMany();
      await tx.topic.deleteMany();
      await tx.importRun.deleteMany();

      const topicIds = new Map();
      const pendingTopics = new Map(importGraph.topics.map((topic) => [topic.key, topic]));
      while (pendingTopics.size) {
        let createdThisPass = 0;
        const batch = [];
        for (const [key, topic] of pendingTopics) {
          if (topic.parentKey && !topicIds.has(topic.parentKey)) continue;
          const id = randomUUID();
          topicIds.set(key, id);
          batch.push({
            id,
            name: topic.name,
            description: topic.description ?? null,
            parentId: topic.parentKey ? topicIds.get(topic.parentKey) : null,
          });
          pendingTopics.delete(key);
          createdThisPass += 1;
        }
        if (!createdThisPass) throw new Error('Imported Topic hierarchy cannot be ordered');
        await createManyBatched((data) => tx.topic.createMany({ data }), batch);
      }

      const nodeIds = new Map(importGraph.nodes.map((node) => [node.key, randomUUID()]));
      await createManyBatched((data) => tx.learningNode.createMany({ data }), importGraph.nodes.map((node) => ({
        id: nodeIds.get(node.key),
        title: node.title,
        description: node.description ?? null,
        type: node.type,
        granularity: node.granularity,
        difficulty: node.difficulty ?? null,
        metadata: node.metadata ?? {},
      })));

      await createManyBatched((data) => tx.topicMembership.createMany({ data }), importGraph.memberships.map((membership) => ({
        topicId: topicIds.get(membership.topicKey),
        nodeId: nodeIds.get(membership.nodeKey),
      })));

      await createManyBatched((data) => tx.learningEdge.createMany({ data }), importGraph.edges.map((edge) => ({
        id: randomUUID(),
        sourceNodeId: nodeIds.get(edge.sourceNodeKey),
        targetNodeId: nodeIds.get(edge.targetNodeKey),
        type: edge.type,
        strength: edge.strength,
        metadata: edge.metadata ?? {},
      })));

      await tx.importRun.create({
        data: {
          source: importSummary.source,
          version: importSummary.version,
          checksum: importChecksum,
          topics: importSummary.topics,
          nodes: importSummary.nodes,
          memberships: importSummary.memberships,
          edges: importSummary.edges,
        },
      });

      return { skipped: false, ...importSummary };
    }, { maxWait: 30_000, timeout: 300_000 });
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

async function createManyBatched(createMany, rows) {
  const size = 400;
  for (let offset = 0; offset < rows.length; offset += size) {
    await createMany(rows.slice(offset, offset + size));
  }
}
