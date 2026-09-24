# Beijing Taxonomy Bootstrap

## Snapshot source

The one-time initialization source is [luw2007/os-taxonomy-beijing](https://github.com/luw2007/os-taxonomy-beijing). The importer reads the current Beijing manifest and its listed data files, verifies their SHA-256 checksums, and merges the translated `mt_` topics with the Marble v1 upstream topic structure. China-specific `mtc_` topics are imported directly. Upstream dependency edges use the Chinese reason file; China-specific and bridge dependencies retain review annotations.

The manifest currently describes 1,590 translated topics, 2,008 China-specific topics, 3,221 upstream dependencies, 2,619 China-specific dependencies, and 47 bridge dependencies. The exact counts for each run are taken from the verified snapshot and printed by the command.

## Mapping

| Beijing data | Learning Graph |
|---|---|
| Upstream topic merged with `topics.zh.json` by `mt_` ID | LearningNode |
| `cn-topics.json` topic (`mtc_` ID) | LearningNode |
| Subject | Root Topic, with the Beijing Chinese subject label |
| Subject + domain | Child Topic, with the Beijing Chinese domain label |
| `prerequisiteId → topicId` | `PREREQUISITE` edge from prerequisite to dependent node |
| `hard` / `soft` | `REQUIRED` / `IMPORTANT` |
| Topic translation, taxonomy type, evidence, standards, age, stage, and origin | LearningNode metadata |
| Dependency reason and source provenance | LearningEdge metadata |
| Current edge review state | `LearningEdge.reviewStatus` |
| Each human decision, reviewer, time, and note | LearningEdge review history |

`reviewStatus: machine` is stored as `NEEDS_REVIEW`, `reviewStatus: reviewed` as `REVIEWED`, and source upstream edges are marked `SOURCE`. Edges marked `rejected` are excluded. Review status is independent of edge strength. Source IDs are temporary import keys and are not persisted as LearningNode IDs.

## Replacement and repeat behavior

Preview the data and graph constraints without database writes:

```bash
npm run import:beijing -- --dry-run
```

Apply the one-time bootstrap:

```bash
npm run import:beijing
```

The database write is atomic. The command replaces the exact prior Marble v1 bootstrap, or initializes an empty graph. If it finds any other graph contents or import history, it stops without deleting rows. Repeating the exact Beijing snapshot is a no-op. A newer snapshot is not synchronized automatically; this command intentionally refuses to update an already initialized Beijing graph.

The snapshot checksum and imported row counts are stored in `ImportRun`. The import itself has no runtime dependency on the source repository after it completes.

## Attribution and data rights

The Beijing repository identifies its taxonomy database under ODbL 1.0, translated and project-authored text under CC BY-SA 4.0, and code under MIT. Preserve the required Beijing Taxonomy and Marble attribution when redistributing the imported dataset. Curriculum data is codes-only; the importer does not fetch or store curriculum standard text. See the source repository's [provenance and license notes](https://github.com/luw2007/os-taxonomy-beijing/blob/main/PROVENANCE.md).
