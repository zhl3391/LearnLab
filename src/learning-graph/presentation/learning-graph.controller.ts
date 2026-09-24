import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { LearningGraphService } from '../application/learning-graph.service';
import {
  CreateEdgeDto,
  ImportGraphDto,
  CreateMembershipDto,
  CreateNodeDto,
  CreateTopicDto,
  ListNodesQueryDto,
  ListEdgesQueryDto,
  ReviewEdgeDto,
} from './learning-graph.dto';

@Controller('learning-graph')
export class LearningGraphController {
  constructor(private readonly service: LearningGraphService) {}

  @Get()
  getGraph() {
    return this.service.getGraph();
  }

  @Get('topics')
  listTopics() {
    return this.service.listTopics();
  }

  @Get('nodes')
  listNodes(@Query() query: ListNodesQueryDto) {
    return this.service.listNodes(query);
  }

  @Get('nodes/:id')
  getNodeDetails(@Param('id') id: string) {
    return this.service.getNodeDetails(id);
  }

  @Get('edges')
  listEdges(@Query() query: ListEdgesQueryDto) {
    return this.service.listEdges(query);
  }

  @Post('topics')
  createTopic(@Body() dto: CreateTopicDto) {
    return this.service.createTopic(dto);
  }

  @Post('nodes')
  createNode(@Body() dto: CreateNodeDto) {
    return this.service.createNode(dto);
  }

  @Post('memberships')
  addMembership(@Body() dto: CreateMembershipDto) {
    return this.service.addMembership(dto.topicId, dto.nodeId);
  }

  @Post('edges')
  createEdge(@Body() dto: CreateEdgeDto) {
    return this.service.createEdge(dto);
  }

  @Post('edges/:id/reviews')
  reviewEdge(@Param('id') id: string, @Body() dto: ReviewEdgeDto) {
    return this.service.reviewEdge(id, dto);
  }

  @Post('import')
  importGraph(@Body() dto: ImportGraphDto) {
    return this.service.importGraph(dto);
  }
}
