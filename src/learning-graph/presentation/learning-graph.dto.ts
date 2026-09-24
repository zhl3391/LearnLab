import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  EdgeStrength,
  EdgeType,
  Granularity,
  NodeType,
} from '../domain/model';
import {
  ImportEdgeData,
  ImportMembershipData,
  ImportNodeData,
  ImportTopicData,
} from '../application/import-model';

export class CreateTopicDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  parentId?: string;
}

export class CreateNodeDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(NodeType)
  type!: NodeType;

  @IsEnum(Granularity)
  granularity!: Granularity;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  difficulty?: number;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class CreateMembershipDto {
  @IsUUID()
  topicId!: string;

  @IsUUID()
  nodeId!: string;
}

export class CreateEdgeDto {
  @IsUUID()
  sourceNodeId!: string;

  @IsUUID()
  targetNodeId!: string;

  @IsEnum(EdgeType)
  type!: EdgeType;

  @IsEnum(EdgeStrength)
  strength!: EdgeStrength;
}

export class ListNodesQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(NodeType)
  type?: NodeType;

  @IsOptional()
  @IsEnum(Granularity)
  granularity?: Granularity;

  @IsOptional()
  @IsUUID()
  topicId?: string;
}

export class ImportTopicDto implements ImportTopicData {
  @IsString()
  @MinLength(1)
  key!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  parentKey?: string;
}

export class ImportNodeDto implements ImportNodeData {
  @IsString()
  @MinLength(1)
  key!: string;

  @IsString()
  @MinLength(1)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(NodeType)
  type!: NodeType;

  @IsEnum(Granularity)
  granularity!: Granularity;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  difficulty?: number;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class ImportMembershipDto implements ImportMembershipData {
  @IsString()
  @MinLength(1)
  topicKey!: string;

  @IsString()
  @MinLength(1)
  nodeKey!: string;
}

export class ImportEdgeDto implements ImportEdgeData {
  @IsString()
  @MinLength(1)
  sourceNodeKey!: string;

  @IsString()
  @MinLength(1)
  targetNodeKey!: string;

  @IsEnum(EdgeType)
  type!: EdgeType;

  @IsEnum(EdgeStrength)
  strength!: EdgeStrength;
}

export class ImportGraphDto {
  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsString()
  version?: string;

  @IsOptional()
  @IsString()
  checksum?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportTopicDto)
  topics!: ImportTopicDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportNodeDto)
  nodes!: ImportNodeDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportMembershipDto)
  memberships!: ImportMembershipDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportEdgeDto)
  edges!: ImportEdgeDto[];
}
