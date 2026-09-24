import { createHash } from 'node:crypto';

process.loadEnvFile?.();

const rawBase =
  process.env.MARBLE_RAW_BASE_URL ??
  'https://raw.githubusercontent.com/withmarbleapp/os-taxonomy/main/data';
const importUrl =
  process.env.MARBLE_IMPORT_URL ??
  `http://127.0.0.1:${process.env.PORT ?? '3000'}/learning-graph/import`;

async function fetchBytes(fileName) {
  const response = await fetch(`${rawBase}/${fileName}`);
  if (!response.ok) {
    throw new Error(`Marble download failed for ${fileName}: ${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

const [manifestBytes, topicsBytes, dependenciesBytes] = await Promise.all([
  fetchBytes('manifest.json'),
  fetchBytes('topics.json'),
  fetchBytes('dependencies.json'),
]);
const manifest = JSON.parse(manifestBytes.toString('utf8'));

for (const [fileName, bytes] of [
  ['topics.json', topicsBytes],
  ['dependencies.json', dependenciesBytes],
]) {
  const expected = manifest.files?.[fileName]?.sha256;
  if (expected && expected !== sha256(bytes)) {
    throw new Error(`Checksum mismatch for Marble ${fileName}`);
  }
}

const { mapMarbleTaxonomy } = await import(
  '../dist/learning-graph/infrastructure/marble-taxonomy.mapper.js'
);
const graph = mapMarbleTaxonomy(
  JSON.parse(topicsBytes.toString('utf8')),
  JSON.parse(dependenciesBytes.toString('utf8')),
);
graph.source = 'marble-os-taxonomy';
graph.version = manifest.taxonomyVersion;
graph.checksum = `${manifest.files?.['topics.json']?.sha256}:${manifest.files?.['dependencies.json']?.sha256}`;

let response;
try {
  response = await fetch(importUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(graph),
  });
} catch (error) {
  if (error?.cause?.code === 'ECONNREFUSED' || error?.code === 'ECONNREFUSED') {
    throw new Error(
      `Cannot reach ${importUrl}. Start NestJS first, or set MARBLE_IMPORT_URL to the running API address.`,
    );
  }
  throw error;
}
if (!response.ok) {
  throw new Error(`Learning Graph import failed: ${response.status} ${await response.text()}`);
}

const result = await response.json();
if (process.env.MARBLE_IMPORT_VERBOSE === '1') {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(
    JSON.stringify(
      {
        skipped: result.skipped,
        source: result.source,
        version: result.version,
        topics: result.topics,
        nodes: result.nodes,
        memberships: result.memberships,
        edges: result.edges,
      },
      null,
      2,
    ),
  );
}
