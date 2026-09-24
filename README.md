# LearnLab Learning Graph

第一版 Learning Graph 后端，使用 NestJS、PostgreSQL 和 Prisma。

## 本地启动

项目不要求 Docker。只要本地 PostgreSQL 已创建数据库，并将连接地址写入 `.env` 即可。

配置 `.env` 和安装依赖后，在项目根目录用一个命令启动前后端：

```bash
npm run dev
```

后端使用 `.env` 中的 `PORT`，前端默认运行在 `http://localhost:3000`。按 `Ctrl+C` 会同时关闭两个服务；可用 `WEB_PORT` 更改前端端口。

```bash
cp .env.example .env
npm install
npm install --prefix web
npx prisma generate
npx prisma migrate dev --name init
```

例如本地 PostgreSQL 使用默认用户和端口时，`.env` 可以是：

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/learnlab?schema=public"
SHADOW_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/learnlab_shadow?schema=public"
```

`SHADOW_DATABASE_URL` 是 Prisma 开发迁移使用的临时数据库，需要提前创建，并由同一个 PostgreSQL 用户拥有。

`docker compose up -d postgres` 只是没有本地 PostgreSQL 时的可选备用方案。

后端地址由 `.env` 的 `PORT` 决定，前端地址默认为 `http://localhost:3000`。

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

## 一次性初始化北京版知识图谱

当前初始化来源是 [Beijing Skill Taxonomy](https://github.com/luw2007/os-taxonomy-beijing)。命令会先校验数据文件 checksum、上游 ID 对齐和整图 DAG，再在一个数据库事务中替换此前的 Marble 初始化图谱：

```bash
npm run import:beijing -- --dry-run
npm run import:beijing
```

这是一次性快照导入，不会持续同步上游。重复导入同一快照会跳过；发现图谱不属于已知旧 Marble 初始化批次时会中止，避免覆盖其他数据。

北京版中文译文会按 `mt_` ID 合并上游节点结构，`mtc_` 中国特有主题单独创建。来源标为 `rejected` 的关系不导入；`machine` 关系保留并标记为待复核；`reviewed` 状态、理由和审核依据保存在关系 metadata 中。边强度单独映射：`hard` → `REQUIRED`，`soft` → `IMPORTANT`。

数据遵循 ODbL 1.0 与 CC BY-SA 4.0，分发或使用时需要保留上游署名；课程标准仅保留 codes-only 映射键。详情见 [北京版初始化说明](./docs/BeijingTaxonomyBootstrap.md) 和 [来源/许可说明](https://github.com/luw2007/os-taxonomy-beijing/blob/main/PROVENANCE.md)。

## 验证

```bash
npm test
npm run build
npm run prisma:validate
```
