# Marble Import

## Source

The initial taxonomy source is [withmarbleapp/os-taxonomy](https://github.com/withmarbleapp/os-taxonomy), read from its `main` branch data files:

- `data/manifest.json`
- `data/topics.json`
- `data/dependencies.json`

The importer verifies the SHA-256 values recorded in `manifest.json` before mapping the data.

## Mapping

| Marble | Learning Graph |
|---|---|
| topic | LearningNode |
| subject | root Topic |
| subject + domain | child Topic |
| `prerequisiteId → topicId` | `sourceNodeId → targetNodeId` with `PREREQUISITE` |
| `hard` | `REQUIRED` |
| `soft` | `IMPORTANT` |
| `CONCEPTUAL`, `REPRESENTATIONAL`, `LANGUAGE` | `KNOWLEDGE` + `L2_CONCEPT` |
| `PROCEDURAL` | `SKILL` + `L3_CAPABILITY` |
| `META` | `APPLICATION` + `L3_CAPABILITY` |

Marble IDs are used only as temporary import keys. They are not persisted as external IDs in the Learning Graph. Marble evidence, assessment prompts, age ranges, centrality, and standards are preserved under `LearningNode.metadata` because they are useful source metadata without becoming new core domain models.

The imported data is written through `POST /learning-graph/import` in one database transaction. A validation error prevents the entire import from being written.
