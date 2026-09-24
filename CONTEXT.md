# Learning Graph Context

Learning Graph describes reusable knowledge and capability units and the meaningful relationships between them. It is the foundation for later learning objectives, assessment, learner modeling, and curriculum decisions.

## Core language

**Topic**:
An organizational area used to group learning nodes. A Topic is not itself a learning object and does not participate in learning dependency edges.
_Avoid_: subject, category, course

**LearningNode**:
A knowledge, skill, or application unit that can be learned independently and whose mastery can be assessed independently.
_Avoid_: lesson, question, objective

**TopicMembership**:
The relationship that says a LearningNode belongs to a Topic. It does not imply learning dependency.
_Avoid_: topic edge, topic prerequisite

**LearningEdge**:
A meaningful relationship between two LearningNodes. Its type expresses whether the relationship is prerequisite, composition, or general relatedness; review annotations and rationale may accompany it.
_Avoid_: graph link, topic relation

**Edge review status**:
The current disposition of a LearningEdge: source-provided, awaiting review, accepted, or rejected. It is independent of the edge's learning strength.
_Avoid_: edge strength, mastery status

**Edge review**:
A recorded decision to accept or reject a LearningEdge candidate, attributed to a reviewer and time, with an optional note.
_Avoid_: edge strength adjustment

**Prerequisite**:
A LearningNode that provides an important learning foundation for another LearningNode. It describes knowledge dependency, not a mandatory teaching sequence.
_Avoid_: lesson order, curriculum step

**Objective**:
A statement of the level or observable outcome expected from learning a LearningNode. It is outside the Learning Graph core model.

**Assessment**:
Evidence or a task used to judge whether a learner has mastered a LearningNode. Concrete questions do not belong in the Learning Graph.
