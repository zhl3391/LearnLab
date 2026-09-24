# Learning Graph 设计文档

## 1. 目标

Learning Graph 是自适应学习系统的知识基础层，用于描述：

* 学习系统中有哪些知识与能力
* 知识与能力之间存在什么关系
* 哪些知识是其他知识的前置条件
* 知识属于哪些主题领域
* 知识处于什么粒度

Learning Graph **不负责**：

* 学习顺序
* 学生当前掌握程度
* 复习计划
* 题目生成
* 课程编排
* 游戏表现

这些属于上层系统。

整体架构：

```text
Learning Graph
      ↓
Learning Objective
      ↓
Assessment / Tutor
      ↓
Learner Model
      ↓
Curriculum / Learning Engine
      ↓
Game System
```

---

# 2. 核心设计原则

## 2.1 Graph，而不是 Tree

知识体系不是简单的树。

一个 LearningNode 可以：

* 有多个前置知识
* 被多个知识依赖
* 属于多个 Topic
* 与多个知识存在不同关系

因此核心结构是：

```text
Node + Edge
```

而不是：

```text
Parent → Child
```

---

## 2.2 Topic 与 LearningNode 分离

### Topic

Topic 是知识的**组织区域**。

它回答：

> “这个知识属于哪个领域？”

例如：

```text
数学
└── 数与运算
    └── 加法
```

Topic 本身不需要被学生掌握。

### LearningNode

LearningNode 是真正的**学习对象**。

它回答：

> “学生需要学习什么？”

例如：

```text
加法
10以内加法
20以内加法
```

因此：

```text
Topic ≠ LearningNode
```

两者通过 `TopicMembership` 建立关系。

---

# 3. 初始数据来源的定位

当前初始化快照为 [Beijing Skill Taxonomy](https://github.com/luw2007/os-taxonomy-beijing)。该项目衍生自 Marble Skill Taxonomy，并包含中文译文、中国特有主题与中国课程标准映射。

数据流：

```text
Beijing Skill Taxonomy snapshot
       ↓ one-time bootstrap
 Learning Graph
       ↓
 自己的数据
```

初始化后，Learning Graph 使用自己的模型，不在运行时依赖上游数据结构，也不自动同步上游更新。上游 ID 只用于导入时关联和校验，不作为 LearningNode 的领域 ID。

Marble 是北京版的上游来源。导入时通过临时 ID 合并译文与上游结构；上游 ID 不作为 LearningNode 的领域 ID。

未来可以：

* 人工修改
* AI 修改
* 合并其他知识来源
* 建立自己的知识体系
* 重新设计节点粒度

因此：

> Beijing Skill Taxonomy 是一次性初始化来源，不是 Learning Graph 的领域模型。

---

# 4. 核心数据模型

第一版只保留四个核心模型：

```text
LearningGraph
├── Topic
├── LearningNode
├── TopicMembership
└── LearningEdge
```

---

# 5. Topic

Topic 用于组织知识领域。

```text
Topic
├── id
├── name
├── description
└── parentId
```

示例：

```text
数学
└── 数与运算
    └── 加法
```

第一版使用简单的 `parentId` 构建 Topic Tree。

Topic 不参与 LearningNode 的学习依赖计算。

---

# 6. LearningNode

## 6.1 定义

> LearningNode 是学习系统中可以被独立学习、练习，并且可以独立判断掌握程度的知识/能力单元。

核心判断：

> 如果系统需要独立判断学生是否掌握这个对象，那么它可以成为 LearningNode。

---

## 6.2 数据结构

```text
LearningNode
├── id
├── title
├── description
├── type
├── granularity
├── difficulty
└── metadata
```

---

# 7. LearningNode Type

第一版只保留三个类型：

```text
KNOWLEDGE
SKILL
APPLICATION
```

### KNOWLEDGE

表示需要理解、知道的概念或规则。

例如：

```text
数量
加法
三角形
加法交换律
```

### SKILL

表示可以执行的能力。

例如：

```text
10以内加法
竖式加法
使用直尺测量长度
```

### APPLICATION

表示把知识或技能应用于实际问题。

例如：

```text
解决简单加法应用题
根据实际情境选择计算方法
```

Type 的作用主要是描述 Node 性质，不用于决定学习顺序。

---

# 8. Granularity

Granularity 表示 LearningNode 在知识体系中的粒度。

第一版定义：

```text
L1 DOMAIN
L2 CONCEPT
L3 CAPABILITY
L4 SPECIFIC
```

一般情况下：

```text
L1 → 通常属于 Topic
L2 → 通常是 LearningNode
L3 → 通常是 LearningNode
L4 → 需要进一步判断
```

L4 不代表一定要创建 Node。

例如：

```text
加法
→ LearningNode

10以内加法
→ LearningNode

5 + 3 = 8
→ Assessment

理解加法的合并意义
→ Objective
```

因此：

> Granularity 用来描述 Node 的粒度，而不是直接决定一个对象是不是 Node。

---

# 9. LearningNode 的判断规则

候选知识进入 Graph 前，可以按照以下规则判断：

```text
候选对象
   ↓
是否属于知识 / 技能 / 应用？
   ↓
是否具有独立学习价值？
   ↓
是否可以独立判断掌握？
   ↓
是否具有一定可迁移性？
   ↓
是 → LearningNode
否 → Objective / Assessment / Metadata
```

核心原则：

> Graph 描述可迁移的知识与能力，Assessment 描述具体表现。

因此：

```text
3 + 5 = ?
```

不是 LearningNode。

而：

```text
10以内加法
```

可以是 LearningNode。

---

# 10. LearningNode 与 Objective 的边界

两者分别回答：

```text
LearningNode
“学什么？”

Objective
“学到什么程度？”
```

例如：

```text
LearningNode
加法
```

可以拥有：

```text
Objective

理解加法表示数量合并
理解 + 符号
能够根据情境列出加法算式
能够计算简单加法
```

Objective 暂时不属于 Learning Graph 核心模型。

---

# 11. LearningNode 与 Assessment 的边界

Assessment 回答：

> “如何证明学生掌握了这个知识？”

例如：

```text
LearningNode
10以内加法
        ↓
Assessment
1 + 2 = ?
3 + 5 = ?
7 + 2 = ?
```

具体题目不进入 Learning Graph。

这样可以避免 Graph 被大量题目污染。

---

# 12. TopicMembership

用于连接 Topic 与 LearningNode。

```text
TopicMembership
├── topicId
└── nodeId
```

一个 Node 可以属于多个 Topic。

例如：

```text
Topic：加法
    ├── 加法
    ├── 10以内加法
    └── 20以内加法
```

同时某个 Node 也可以属于其他 Topic。

TopicMembership 不代表学习依赖。

---

# 13. LearningEdge

## 13.1 定义

> LearningEdge 描述两个 LearningNode 之间具有学习意义的关系。

LearningEdge 只能连接：

```text
LearningNode → LearningNode
```

不能连接 Topic。

---

# 14. LearningEdge Type

第一版只保留三个：

```text
PREREQUISITE
PART_OF
RELATED
```

---

## 14.1 PREREQUISITE

表示：

> A 是学习 B 时的重要前置知识。

方向统一：

```text
A ──PREREQUISITE──> B
```

表示：

```text
A 是 B 的 prerequisite
```

例如：

```text
数量概念
    ↓
  加法
    ↓
10以内加法
    ↓
20以内加法
```

---

## 14.2 PART_OF

表示：

> A 是 B 的组成部分。

例如：

```text
个位加法
    │
    └── PART_OF ──> 两位数加法
```

`PART_OF` 与 `PREREQUISITE` 不是同一个概念。

一个关系可以存在：

```text
A PART_OF B
```

同时另一个关系也可以存在：

```text
A PREREQUISITE B
```

因为它们表达不同的信息。

---

## 14.3 RELATED

表示：

> A 与 B 存在知识关联，但没有明确的学习依赖。

例如：

```text
加法
  ↕
减法
```

RELATED 不应该影响：

* 学习顺序
* prerequisite 检查
* 掌握条件

主要用于：

* 知识探索
* 推荐相关知识
* Graph 可视化
* AI 辅助理解

---

# 15. 暂不使用 ENABLES

第一版不加入：

```text
ENABLES
```

原因是它与：

```text
PREREQUISITE
```

语义存在较大重叠。

后续如果实际数据证明需要，再增加新的 Edge Type。

第一版优先保持简单。

---

# 16. Edge Strength

LearningEdge 可以具有强度：

```text
REQUIRED
IMPORTANT
HELPFUL
```

含义：

### REQUIRED

强依赖。

```text
A → B
```

没有 A，通常不应该认为 B 已经具备完整学习基础。

### IMPORTANT

重要前置知识，但不是绝对条件。

### HELPFUL

有帮助，但不是必要条件。

第一版不使用：

```text
0.73
0.82
0.95
```

这类任意数值。

原因是数值缺乏稳定语义，也容易导致 AI 随意赋值。

---

# 17. LearningEdge 数据结构

```text
LearningEdge
├── id
├── sourceNodeId
├── targetNodeId
├── type
├── strength
└── metadata
```

示例：

```json
{
  "id": "edge_001",
  "sourceNodeId": "addition",
  "targetNodeId": "addition_10",
  "type": "PREREQUISITE",
  "strength": "REQUIRED"
}
```

---

# 18. Graph 约束

## 18.1 PREREQUISITE 不允许形成环

错误：

```text
A → B
B → C
C → A
```

否则无法确定前置知识。

---

## 18.2 PART_OF 不允许形成环

错误：

```text
A PART_OF B
B PART_OF C
C PART_OF A
```

---

## 18.3 RELATED 可以形成环

例如：

```text
A RELATED B
B RELATED A
```

或者在内部视为无向关系。

---

## 18.4 LearningEdge 不连接 Topic

错误：

```text
Topic → LearningNode
Topic → Topic
```

Topic 与 Node 的关联统一通过：

```text
TopicMembership
```

---

# 19. Learning Graph 与学习流程的边界

非常重要：

```text
PREREQUISITE
```

描述的是：

> 知识之间的依赖关系。

它不等于：

> 系统必须按照这个顺序教学。

例如：

```text
加法
 ↓
10以内加法
```

学生学习 10 以内加法时，可以发现问题：

```text
10以内加法
      ↓
发现基础薄弱
      ↓
回到加法概念
      ↓
再次学习10以内加法
```

因此 Learning Graph 描述的是：

```text
Knowledge Dependency
```

而不是：

```text
Learning Flow
```

真正的学习路径由后续的：

```text
Curriculum / Learning Engine
```

决定。

---

# 20. 完整示例

## Topic Tree

```text
数学
└── 数与运算
    └── 加法
```

## LearningNodes

```text
N1 数量概念
N2 加法
N3 10以内加法
N4 20以内加法
N5 加法应用
N6 减法
```

## LearningEdges

```text
N1 ──PREREQUISITE [REQUIRED]──> N2

N2 ──PREREQUISITE [REQUIRED]──> N3

N3 ──PREREQUISITE [REQUIRED]──> N4

N3 ──PREREQUISITE [IMPORTANT]──> N5

N2 ──RELATED──> N6

N3 ──PART_OF──> N4
```

形成：

```text
                 数量概念
                     │
                     │ prerequisite
                     ↓
                    加法
                  /      \
                 /        \
        prerequisite      related
               ↓             \
         10以内加法           减法
            │  \
            │   \
            │    prerequisite
            ↓       \
       20以内加法    加法应用
```

---

# 21. 当前完整模型

```text
LearningGraph
│
├── Topic
│   ├── id
│   ├── name
│   ├── description
│   └── parentId
│
├── LearningNode
│   ├── id
│   ├── title
│   ├── description
│   ├── type
│   ├── granularity
│   ├── difficulty
│   └── metadata
│
├── TopicMembership
│   ├── topicId
│   └── nodeId
│
└── LearningEdge
    ├── id
    ├── sourceNodeId
    ├── targetNodeId
    ├── type
    └── strength
    └── metadata
```

---

# 22. 当前明确不属于 Learning Graph 的内容

以下内容暂时不要加入：

```text
Student
Mastery
Confidence
Review
Forgetting Curve
Learning Session
Curriculum
Course
Tutor
Question
Assessment
Game
Reward
XP
Map
Mission
```

这些属于后续系统。

---

# 23. 下一阶段

Beijing Skill Taxonomy `1.2.0-zh.0` 已作为一次性快照初始化。当前下一步是人工核对标记为 `NEEDS_REVIEW` 的 machine 关系；后续快照不会自动同步。

---

## 当前版本结论

第一版 Learning Graph 的核心原则可以浓缩成：

```text
Topic = 知识地图上的区域

LearningNode = 可独立掌握的知识/能力

TopicMembership = Node 属于哪个区域

LearningEdge = Node 之间为什么存在学习关系

PREREQUISITE = 学习依赖
PART_OF = 组成关系
RELATED = 相关关系
```

**Beijing Skill Taxonomy 负责提供初始快照；Learning Graph 从导入完成后就属于自己的模型。**
