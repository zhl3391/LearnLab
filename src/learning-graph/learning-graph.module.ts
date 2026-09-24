import { Module } from '@nestjs/common';
import { LEARNING_GRAPH_REPOSITORY } from './application/learning-graph.repository';
import { LearningGraphService } from './application/learning-graph.service';
import { PrismaLearningGraphRepository } from './infrastructure/prisma-learning-graph.repository';
import { LearningGraphController } from './presentation/learning-graph.controller';

@Module({
  controllers: [LearningGraphController],
  providers: [
    LearningGraphService,
    PrismaLearningGraphRepository,
    {
      provide: LEARNING_GRAPH_REPOSITORY,
      useExisting: PrismaLearningGraphRepository,
    },
  ],
})
export class LearningGraphModule {}
