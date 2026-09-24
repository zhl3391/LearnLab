# Use PostgreSQL in a modular monolith

Learning Graph will start as a modular NestJS application backed by PostgreSQL. The graph has a small, fixed set of relationship types and needs strong referential integrity, import transactions, and cycle validation; relational tables are sufficient for the first version and avoid premature graph-database infrastructure. A repository boundary keeps the domain model independent from this choice.
