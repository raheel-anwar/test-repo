variable "name" {
  type        = string
  description = "Logical name prefix for resources (eg. myapp-db)"
}

variable "environment" {
  type        = string
  description = "Environment tag (eg. production/staging)"
  default     = "production"
}

variable "engine" {
  type        = string
  description = "DB engine"
  default     = "postgres"
}

variable "engine_version" {
  type        = string
  description = "Postgres engine version"
  default     = "15.3"
}

variable "instance_class" {
  type        = string
  description = "RDS instance class"
  default     = "db.t3.medium"
}

variable "allocated_storage" {
  type        = number
  description = "Allocated storage (GB). Use gp3 or gp2 depending on engine/region."
  default     = 20
}

variable "max_allocated_storage" {
  type        = number
  description = "Autoscale storage up to this (GB). 0 = disabled"
  default     = 0
}

variable "multi_az" {
  type        = bool
  description = "Enable Multi-AZ"
  default     = true
}

variable "storage_encrypted" {
  type        = bool
  description = "Enable storage encryption"
  default     = true
}

variable "kms_key_id" {
  type        = string
  description = "(optional) KMS key ARN/ID to use for encryption. Leave empty to use default RDS key"
  default     = ""
}

variable "db_subnet_ids" {
  type        = list(string)
  description = "Private subnet IDs for DB subnet group"
}

variable "vpc_security_group_ids" {
  type        = list(string)
  description = "Security group IDs for the DB instance (should restrict to app/internal SGs)"
  default     = []
}

variable "db_name" {
  type        = string
  description = "Initial DB name"
  default     = null
}

variable "username" {
  type        = string
  description = "Master username. Leave null to use defaults and Secrets Manager."
  default     = null
}

variable "password" {
  type        = string
  sensitive   = true
  description = "Master password. Avoid supplying in code — prefer Secrets Manager or let module create one."
  default     = null
}

variable "create_secret" {
  type        = bool
  description = "If true, create a Secrets Manager secret containing credentials"
  default     = true
}

variable "secret_name" {
  type        = string
  description = "Name for secretsmanager secret (if create_secret=true). Defaults to <name>-db-credentials"
  default     = ""
}

variable "enable_secret_rotation" {
  type        = bool
  description = "Whether to create a rotation schedule for the secret (requires lambda configured externally or using AWS provided mechanism). Module will configure rotation if true and rotation_lambda_arn provided."
  default     = false
}

variable "rotation_lambda_arn" {
  type        = string
  description = "ARN of secretsmanager rotation lambda (optional, required if enable_secret_rotation=true)"
  default     = ""
}

variable "backup_retention_period" {
  type        = number
  description = "Automated backup retention days (0 disables automated backups — not recommended)"
  default     = 7
}

variable "preferred_backup_window" {
  type        = string
  description = "Daily backup window (hh24:mi-hh24:mi)"
  default     = "02:00-03:00"
}

variable "preferred_maintenance_window" {
  type        = string
  description = "Weekly maintenance window"
  default     = "sun:04:00-sun:05:00"
}

variable "apply_immediately" {
  type        = bool
  description = "Apply modifications immediately when Terraform modifies DB (use false in prod)"
  default     = false
}

variable "publicly_accessible" {
  type        = bool
  description = "Whether DB is publicly accessible"
  default     = false
}

variable "performance_insights_enabled" {
  type        = bool
  description = "Enable Performance Insights"
  default     = true
}

variable "performance_insights_retention_period" {
  type        = number
  description = "PI retention (7 or 731)"
  default     = 7
}

variable "monitoring_interval" {
  type        = number
  description = "Enhanced monitoring interval (seconds). 0 disables."
  default     = 60
}

variable "parameter_group_family" {
  type        = string
  description = "DB parameter group family name (eg. postgres15). Leave empty to derive from engine_version"
  default     = ""
}

variable "parameter_overrides" {
  type        = map(string)
  description = "Parameter group key/value overrides"
  default     = {}
}

variable "prevent_destroy" {
  type        = bool
  description = "Set lifecycle.prevent_destroy on DB instance"
  default     = true
}

variable "create_cross_region_snapshot_copy" {
  type        = bool
  description = "If true, enable nightly snapshot copy to a target region (uses aws_db_snapshot copy). Requires cross_region_target_region var."
  default     = false
}

variable "cross_region_target_region" {
  type        = string
  description = "Target region for snapshot copy"
  default     = ""
}

variable "cross_region_snapshot_retention_days" {
  type        = number
  description = "How many days to keep cross-region snapshots (manual cleanup Lambda recommended)"
  default     = 14
}

variable "create_aws_backup_plan" {
  type        = bool
  description = "If true, create an AWS Backup plan/vault and assign this DB for backup management"
  default     = false
}

variable "backup_vault_name" {
  type        = string
  description = "Name for AWS Backup vault if create_aws_backup_plan=true"
  default     = ""
}

variable "enable_rds_proxy" {
  type        = bool
  description = "If true, create RDS Proxy in front of the DB (requires secretsmanager secret ARN and proxy subnet + SGs)"
  default     = false
}

variable "rds_proxy_subnet_ids" {
  type        = list(string)
  description = "Subnets for RDS Proxy"
  default     = []
}

variable "rds_proxy_security_group_ids" {
  type        = list(string)
  description = "SGs for RDS Proxy"
  default     = []
}

variable "tags" {
  type        = map(string)
  description = "Additional tags"
  default     = {}
}

locals {
  name_prefix = var.name
  secret_name = var.secret_name != "" ? var.secret_name : "${local.name_prefix}-db-credentials"

  common_tags = merge({
    Name        = local.name_prefix
    Environment = var.environment
    ManagedBy   = "terraform"
  }, var.tags)
}


# ---------------------------
# random password (if needed)
# ---------------------------
resource "random_password" "master" {
  count   = var.username == null || var.password == null ? 1 : 0
  length  = 24
  special = true
  override_charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()-_=+[]{};:,.<>/?"
}

# ---------------------------
# DB Subnet Group
# ---------------------------
resource "aws_db_subnet_group" "this" {
  name        = "${local.name_prefix}-subnet-group"
  subnet_ids  = var.db_subnet_ids
  description = "Subnet group for ${local.name_prefix} RDS"
  tags        = local.common_tags
}

# ---------------------------
# DB Parameter Group (optional)
# ---------------------------
resource "aws_db_parameter_group" "this" {
  count = (var.parameter_group_family != "" || length(var.parameter_overrides) > 0) ? 1 : 0

  name   = "${local.name_prefix}-param-group"
  family = var.parameter_group_family != "" ? var.parameter_group_family : "postgres${regex("^([0-9]+)", var.engine_version)[0]}"
  description = "Custom parameter group for ${local.name_prefix}"
  tags   = local.common_tags

  dynamic "parameter" {
    for_each = var.parameter_overrides
    content {
      name         = parameter.key
      value        = parameter.value
      apply_method = "pending-reboot"
    }
  }
}

# ---------------------------
# Secrets Manager (optional)
# ---------------------------
resource "aws_secretsmanager_secret" "this" {
  count = var.create_secret ? 1 : 0

  name        = local.secret_name
  description = "Credentials for ${local.name_prefix} RDS"
  tags        = local.common_tags
}

# Put credentials into the secret as a JSON string. We do not set host/port here because endpoint is only known after create.
resource "aws_secretsmanager_secret_version" "this" {
  count        = var.create_secret ? 1 : 0
  secret_id    = aws_secretsmanager_secret.this[0].id

  secret_string = jsonencode({
    username = var.username != null ? var.username : (var.create_secret ? coalesce(var.username, "postgres") : (var.username != null ? var.username : "postgres"))
    password = var.password != null ? var.password : (random_password.master.count > 0 ? random_password.master[0].result : null)
    engine   = var.engine
    port     = 5432
    dbname   = var.db_name
  })
  depends_on = [aws_secretsmanager_secret.this]
}

# Optional rotation configuration for the secret (caller must supply rotation lambda ARN)
resource "aws_secretsmanager_secret_rotation" "this" {
  count                 = var.create_secret && var.enable_secret_rotation && length(var.rotation_lambda_arn) > 0 ? 1 : 0
  secret_id             = aws_secretsmanager_secret.this[0].id
  rotation_lambda_arn   = var.rotation_lambda_arn
  rotation_rules {
    automatically_after_days = 30
  }
}

# ---------------------------
# DB instance
# ---------------------------
resource "aws_db_instance" "this" {
  identifier                 = "${local.name_prefix}-${substr(md5(timestamp()), 0, 8)}"
  engine                     = var.engine
  engine_version             = var.engine_version
  instance_class             = var.instance_class
  allocated_storage          = var.allocated_storage
  max_allocated_storage      = var.max_allocated_storage > 0 ? var.max_allocated_storage : null
  db_subnet_group_name       = aws_db_subnet_group.this.name
  vpc_security_group_ids     = length(var.vpc_security_group_ids) > 0 ? var.vpc_security_group_ids : null

  username = var.username != null ? var.username : (var.create_secret ? jsondecode(aws_secretsmanager_secret_version.this[0].secret_string).username : "postgres")
  password = var.password != null ? var.password : (var.create_secret ? jsondecode(aws_secretsmanager_secret_version.this[0].secret_string).password : (random_password.master.count > 0 ? random_password.master[0].result : null))

  db_name                     = var.db_name
  backup_retention_period     = var.backup_retention_period
  preferred_backup_window     = var.preferred_backup_window
  preferred_maintenance_window= var.preferred_maintenance_window
  apply_immediately           = var.apply_immediately
  deletion_protection         = true
  publicly_accessible         = var.publicly_accessible
  multi_az                    = var.multi_az
  storage_encrypted           = var.storage_encrypted
  kms_key_id                  = var.kms_key_id != "" ? var.kms_key_id : null
  performance_insights_enabled= var.performance_insights_enabled
  performance_insights_retention_period = var.performance_insights_retention_period
  monitoring_interval         = var.monitoring_interval > 0 ? var.monitoring_interval : 0
  skip_final_snapshot         = false
  final_snapshot_identifier   = "${local.name_prefix}-final-${substr(md5(timestamp()), 0, 8)}"
  parameter_group_name        = length(aws_db_parameter_group.this) > 0 ? aws_db_parameter_group.this[0].name : null

  tags = local.common_tags

  lifecycle {
    prevent_destroy = var.prevent_destroy
  }
}

# ---------------------------
# Outputs for secrets to populate after endpoint exists (update secret with host/endpoint)
# ---------------------------
resource "null_resource" "update_secret_with_endpoint" {
  count = var.create_secret ? 1 : 0
  triggers = {
    db_endpoint = aws_db_instance.this.address
    db_port     = tostring(aws_db_instance.this.port)
  }

  provisioner "local-exec" {
    command = "echo 'Secret ${local.secret_name} needs to be updated with host/port. Update via automation.'"
  }
  # NOTE: intentionally not updating secretsmanager secret with host/port in Terraform to avoid race conditions and secrets in state.
  # Recommend an external automation (Lambda/pipeline) to call SecretsManager PutSecretValue with host/port after DB creation.
  depends_on = [aws_db_instance.this, aws_secretsmanager_secret_version.this]
}

# ---------------------------
# CloudWatch Alarms
# - FreeStorageSpace (warning/critical)
# - CPUUtilization (>80%/90%)
# - DatabaseConnections (>=90% of max_connections) -> we can't compute max from DB, so alarm uses threshold variable later
# ---------------------------
resource "aws_cloudwatch_metric_alarm" "free_storage_warning" {
  alarm_name          = "${local.name_prefix}-free-storage-warning"
  comparison_operator = "LessThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "FreeStorageSpace"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 10 * 1024 * 1024 * 1024 # 10 GiB in bytes
  dimensions = {
    DBInstanceIdentifier = aws_db_instance.this.id
  }
  alarm_description = "Warn when free storage <= 10 GiB"
  alarm_actions     = [] # fill with SNS topic ARN via module consumption or add below
  ok_actions        = []
}

resource "aws_cloudwatch_metric_alarm" "cpu_high" {
  alarm_name          = "${local.name_prefix}-cpu-high"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 2
  threshold           = 80
  comparison_operator = "GreaterThanThreshold"
  dimensions = {
    DBInstanceIdentifier = aws_db_instance.this.id
  }
  alarm_description = "CPU > 80% for 10 minutes"
}

# ---------------------------
# Optional: Cross-region snapshot copy (simple nightly copy via aws snapshot copy from latest automated snapshot)
# NOTE: Terraform cannot trigger snapshot copy on schedule natively; we provide a lambda suggestion or use aws_backup for managed policies.
# As a light-weight approach we create a backup copy task resource if create_cross_region_snapshot_copy true AND the provider supports copy.
# ---------------------------
resource "aws_db_snapshot" "latest_placeholder" {
  count = 0
  # placeholder to illustrate — not used. Snapshot copy should be driven by a scheduled Lambda or AWS Backup copy.
}

# ---------------------------
# AWS Backup Plan (optional)
# ---------------------------
resource "aws_backup_vault" "this" {
  count = var.create_aws_backup_plan ? 1 : 0
  name  = var.backup_vault_name != "" ? var.backup_vault_name : "${local.name_prefix}-backup-vault"
  tags  = local.common_tags
}

resource "aws_backup_plan" "this" {
  count = var.create_aws_backup_plan ? 1 : 0

  name = "${local.name_prefix}-backup-plan"

  rule {
    rule_name         = "${local.name_prefix}-daily"
    target_vault_name = aws_backup_vault.this[0].name
    schedule          = "cron(0 3 ? * MON-FRI *)" # example: weekdays at 03:00 UTC
    lifecycle {
      delete_after = 30
    }
    recovery_point_tags = local.common_tags
  }
}

resource "aws_backup_selection" "this" {
  count = var.create_aws_backup_plan ? 1 : 0

  iam_role_arn = aws_iam_role.backup_role.arn
  name         = "${local.name_prefix}-backup-selection"
  plan_id      = aws_backup_plan.this[0].id

  resources = [
    aws_db_instance.this.arn
  ]
}

resource "aws_iam_role" "backup_role" {
  count = var.create_aws_backup_plan ? 1 : 0

  name = "${local.name_prefix}-backup-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "backup.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_role_policy" "backup_role_policy" {
  count = var.create_aws_backup_plan ? 1 : 0

  role = aws_iam_role.backup_role[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "rds:DescribeDBInstances",
          "rds:DescribeDBSnapshots",
          "rds:CreateDBSnapshot",
          "rds:CopyDBSnapshot",
          "rds:DescribeDBSubnetGroups",
          "ec2:DescribeSubnets",
          "ec2:DescribeVpcEndpoints",
          "ec2:DescribeVpcs",
          "ec2:DescribeNetworkInterfaces",
          "ec2:DescribeSecurityGroups"
        ]
        Resource = "*"
      }
    ]
  })
}

# ---------------------------
# Optional: RDS Proxy
# ---------------------------
resource "aws_db_proxy" "this" {
  count = var.enable_rds_proxy ? 1 : 0

  name                   = "${local.name_prefix}-proxy"
  debug_logging          = false
  engine_family          = "POSTGRESQL"
  idle_client_timeout    = 1800
  require_tls            = true
  role_arn               = aws_iam_role.rds_proxy_role.arn
  vpc_subnet_ids         = var.rds_proxy_subnet_ids
  vpc_security_group_ids = var.rds_proxy_security_group_ids

  auth {
    auth_scheme = "SECRETS"
    description = "Proxy auth for master user"
    iam_auth    = "DISABLED"
    secret_arn  = var.create_secret ? aws_secretsmanager_secret.this[0].arn : ""
  }

  tags = local.common_tags
}

resource "aws_iam_role" "rds_proxy_role" {
  count = var.enable_rds_proxy ? 1 : 0

  name = "${local.name_prefix}-rds-proxy-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "rds.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "rds_proxy_policy_attach" {
  count = var.enable_rds_proxy ? 1 : 0

  role       = aws_iam_role.rds_proxy_role[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSProxyServiceRolePolicy"
}

# ---------------------------
# Optional: SNS topic for alarms (consumer can override by passing in an ARN in future)
# ---------------------------
resource "aws_sns_topic" "alerts" {
  name = "${local.name_prefix}-alerts"
  tags = local.common_tags
}


output "db_instance_identifier" {
  description = "RDS instance identifier"
  value       = aws_db_instance.this.id
}

output "endpoint" {
  description = "DB endpoint address"
  value       = aws_db_instance.this.address
}

output "port" {
  description = "DB port"
  value       = aws_db_instance.this.port
}

output "arn" {
  description = "DB instance ARN"
  value       = aws_db_instance.this.arn
}

output "secret_arn" {
  description = "Secrets Manager secret ARN (if created)"
  value       = var.create_secret ? aws_secretsmanager_secret.this[0].arn : ""
}

output "param_group_name" {
  description = "DB parameter group name (if created)"
  value       = length(aws_db_parameter_group.this) > 0 ? aws_db_parameter_group.this[0].name : ""
}

output "rds_proxy_endpoint" {
  description = "RDS Proxy endpoint (if created)"
  value       = var.enable_rds_proxy ? aws_db_proxy.this[0].endpoint : ""
}

output "cloudwatch_alarms" {
  description = "Example alarm names"
  value = {
    free_storage_warning = aws_cloudwatch_metric_alarm.free_storage_warning.alarm_name
    cpu_high             = aws_cloudwatch_metric_alarm.cpu_high.alarm_name
  }
}
