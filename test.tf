############################################################
# MODULE: ecs_service
# Enterprise-grade, single file
# Supports:
# - Optional ALB attachment
# - Optional Cloud Map service discovery
# - Cluster-level execution role
# - Optional task role + custom policy JSON
# - Security groups & subnets
# - Dynamic container port
############################################################

############################################################
# VARIABLES
############################################################
variable "name" {
  description = "Name of the ECS service"
  type        = string
}

variable "cluster_arn" {
  description = "ECS cluster ARN where service will run"
  type        = string
}

variable "execution_role_arn" {
  description = "Cluster-level execution role ARN"
  type        = string
}

variable "task_role_arn" {
  description = "Optional task IAM role ARN for application permissions"
  type        = string
  default     = null
}

variable "task_policy_file" {
  description = "Optional path to a JSON file defining additional IAM policy for task role"
  type        = string
  default     = null
}

variable "container_image" {
  description = "Container image to deploy"
  type        = string
}

variable "container_port" {
  description = "Port exposed by container"
  type        = number
}

variable "desired_count" {
  description = "Number of ECS tasks"
  type        = number
  default     = 1
}

variable "security_groups" {
  description = "List of security group IDs attached to the service"
  type        = list(string)
}

variable "subnets" {
  description = "List of subnets for ECS service (Fargate)"
  type        = list(string)
}

variable "alb_target_group_arn" {
  description = "Optional ALB target group ARN if service should attach to ALB"
  type        = string
  default     = null
}

variable "cloud_map" {
  description = "Optional Cloud Map configuration"
  type = object({
    namespace_id    = string
    service_name    = string
    dns_record_type = string
    dns_ttl         = number
  })
  default = null
}

variable "tags" {
  description = "Tags to apply to ECS service and resources"
  type        = map(string)
  default     = {}
}


############################################################
# OPTIONAL TASK ROLE POLICY
############################################################
resource "aws_iam_policy" "task_policy" {
  count = var.task_policy_file != null ? 1 : 0

  name        = "${var.name}-task-policy"
  description = "Custom task policy for ECS service"

  policy = file(var.task_policy_file)
}

resource "aws_iam_role_policy_attachment" "task_policy_attachment" {
  count      = var.task_policy_file != null ? 1 : 0
  role       = var.task_role_arn
  policy_arn = aws_iam_policy.task_policy[0].arn
}


############################################################
# ECS SERVICE DISCOVERY (CLOUD MAP)
############################################################
resource "aws_service_discovery_service" "cloud_map" {
  count = var.cloud_map != null ? 1 : 0

  name         = var.cloud_map.service_name
  namespace_id = var.cloud_map.namespace_id
  dns_config {
    namespace_id   = var.cloud_map.namespace_id
    routing_policy = "MULTIVALUE"
    dns_records {
      type = var.cloud_map.dns_record_type
      ttl  = var.cloud_map.dns_ttl
    }
  }

  health_check_custom_config {
    failure_threshold = 1
  }

  tags = var.tags
}


############################################################
# ECS TASK DEFINITION
############################################################
resource "aws_ecs_task_definition" "this" {
  family                   = var.name
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = var.execution_role_arn
  task_role_arn            = var.task_role_arn

  container_definitions = jsonencode([
    {
      name      = var.name
      image     = var.container_image
      portMappings = [
        {
          containerPort = var.container_port
          protocol      = "tcp"
        }
      ]
    }
  ])
}

############################################################
# ECS SERVICE
############################################################
resource "aws_ecs_service" "this" {
  name            = var.name
  cluster         = var.cluster_arn
  task_definition = aws_ecs_task_definition.this.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"
  platform_version = "LATEST"

  network_configuration {
    subnets         = var.subnets
    security_groups = var.security_groups
    assign_public_ip = true
  }

  load_balancer {
    count            = var.alb_target_group_arn != null ? 1 : 0
    target_group_arn = var.alb_target_group_arn
    container_name   = var.name
    container_port   = var.container_port
  }

  service_registries {
    count        = var.cloud_map != null ? 1 : 0
    registry_arn = aws_service_discovery_service.cloud_map[0].arn
  }

  deployment_minimum_healthy_percent = 50
  deployment_maximum_percent         = 200

  tags = var.tags
}

############################################################
# OUTPUTS
############################################################
output "ecs_service_arn" {
  value = aws_ecs_service.this.arn
}

output "ecs_task_definition_arn" {
  value = aws_ecs_task_definition.this.arn
}

output "cloud_map_service_arn" {
  value = var.cloud_map != null ? aws_service_discovery_service.cloud_map[0].arn : null
}

############################################################
# MODULE: ecr
# Enterprise-grade single-file ECR module
############################################################

############################################################
# VARIABLES
############################################################
variable "name" {
  description = "Name of the ECR repository"
  type        = string
}

variable "tags" {
  description = "Tags to apply to the ECR repository"
  type        = map(string)
  default     = {}
}

variable "image_tag_mutability" {
  description = "ECR image tag mutability (MUTABLE or IMMUTABLE)"
  type        = string
  default     = "MUTABLE"
}

variable "lifecycle_policy" {
  description = "Optional JSON lifecycle policy document to automatically expire images"
  type        = string
  default     = null
}

variable "kms_key_id" {
  description = "Optional KMS key ID to encrypt the repository"
  type        = string
  default     = null
}

variable "repository_policy" {
  description = "Optional repository policy JSON"
  type        = string
  default     = null
}

############################################################
# CREATE ECR REPOSITORY
############################################################
resource "aws_ecr_repository" "this" {
  name                 = var.name
  image_tag_mutability = var.image_tag_mutability
  kms_key              = var.kms_key_id

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = var.tags
}

############################################################
# OPTIONAL LIFECYCLE POLICY
############################################################
resource "aws_ecr_lifecycle_policy" "this" {
  count      = var.lifecycle_policy != null ? 1 : 0
  repository = aws_ecr_repository.this.name
  policy     = var.lifecycle_policy
}

############################################################
# OPTIONAL REPOSITORY POLICY
############################################################
resource "aws_ecr_repository_policy" "this" {
  count      = var.repository_policy != null ? 1 : 0
  repository = aws_ecr_repository.this.name
  policy     = var.repository_policy
}

############################################################
# OUTPUTS
############################################################
output "repository_url" {
  description = "URL of the ECR repository"
  value       = aws_ecr_repository.this.repository_url
}

output "repository_arn" {
  description = "ARN of the ECR repository"
  value       = aws_ecr_repository.this.arn
}

output "repository_name" {
  description = "Name of the ECR repository"
  value       = aws_ecr_repository.this.name
}

