# LearnLab Learning Graph

第一版 Learning Graph 后端，使用 NestJS、PostgreSQL 和 Prisma。

## 本地启动

项目不要求 Docker。只要本地 PostgreSQL 已创建数据库，并将连接地址写入 `.env` 即可。

```bash
cp .env.example .env
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run start:dev
```

例如本地 PostgreSQL 使用默认用户和端口时，`.env` 可以是：

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/learnlab?schema=public"
SHADOW_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/learnlab_shadow?schema=public"
```

`SHADOW_DATABASE_URL` 是 Prisma 开发迁移使用的临时数据库，需要提前创建，并由同一个 PostgreSQL 用户拥有。

`docker compose up -d postgres` 只是没有本地 PostgreSQL 时的可选备用方案。

服务默认运行在 `http://localhost:3000`。

## API

```text
GET  /learning-graph
GET  /learning-graph/topics
GET  /learning-graph/nodes?page=1&pageSize=20&search=addition
GET  /learning-graph/nodes/:id
POST /learning-graph/topics
POST /learning-graph/nodes
POST /learning-graph/memberships
POST /learning-graph/edges
POST /learning-graph/import
```

边创建时会校验：

- 两个端点都必须是已有的 LearningNode
- 不允许自环
- `PREREQUISITE` 和 `PART_OF` 不允许成环
- `RELATED` 会按节点 ID 规范化为无向关系的单一存储方向
- `difficulty` 当前约定为 1 到 5 的整数

## 导入 Marble Taxonomy

导入命令会从 Marble 的公开仓库读取并校验 `manifest.json`、`topics.json` 和
`dependencies.json`，然后调用本地的事务导入接口：

```bash
npm run import:marble
```

映射规则：

- Marble topic → LearningNode
- Marble subject → 根 Topic
- Marble domain → subject 下的子 Topic
- `topicId depends on prerequisiteId` → `prerequisiteId PREREQUISITE topicId`
- `hard` → `REQUIRED`，`soft` → `IMPORTANT`
- Marble 的 evidence、assessmentPrompt、年龄段和 standards 放入 `metadata`

导入请求会携带 Marble 的版本和文件 checksum，并记录到 `ImportRun`。相同版本和 checksum 再次导入时会返回 `skipped: true`，不会重复写入数据。

Marble 数据库使用 ODbL 1.0，Marble 编写的文本内容使用 CC BY-SA 4.0；使用或再分发导入数据时需要保留相应署名和许可信息。

## 验证

```bash
npm test
npm run build
npm run prisma:validate
```
