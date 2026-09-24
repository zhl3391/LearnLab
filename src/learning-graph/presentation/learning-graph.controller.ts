import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { LearningGraphService } from '../application/learning-graph.service';
import {
  CreateEdgeDto,
  ImportGraphDto,
  CreateMembershipDto,
  CreateNodeDto,
  CreateTopicDto,
  ListNodesQueryDto,
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

  @Post('import')
  importGraph(@Body() dto: ImportGraphDto) {
    return this.service.importGraph(dto);
  }
}
