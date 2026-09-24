import { Module } from '@nestjs/common';
import { LearningGraphModule } from './learning-graph/learning-graph.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [PrismaModule, LearningGraphModule],
})
export class AppModule {}
