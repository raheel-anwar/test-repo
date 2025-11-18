############################################################
# Networking Module - Single File
# Creates service security groups for ECS services
############################################################

############################################################
# Variables
############################################################
variable "name" {
  description = "Prefix for naming all security groups"
  type        = string
  default     = "app"
}

variable "vpc_id" {
  description = "Existing VPC ID"
  type        = string
}

variable "frontend_port" {
  description = "Port frontend listens on"
  type        = number
  default     = 3000
}

variable "backend_port" {
  description = "Port backend listens on"
  type        = number
  default     = 8080
}

variable "job_server_port" {
  description = "Port job-server listens on"
  type        = number
  default     = 9090
}

variable "backend_to_job_server" {
  description = "Allow backend to access job-server"
  type        = bool
  default     = true
}

variable "tags" {
  type    = map(string)
  default = {}
}

############################################################
# ALB Security Group (if needed for ECS tasks to connect)
# You can disable if ALB SG is in ALB module
############################################################
# resource "aws_security_group" "alb" {
#   name        = "${var.name}-alb-sg"
#   vpc_id      = var.vpc_id
#   description = "ALB Security Group (if managed here)"
#   ingress {
#     description = "HTTP"
#     from_port   = 80
#     to_port     = 80
#     protocol    = "tcp"
#     cidr_blocks = ["0.0.0.0/0"]
#   }
#   ingress {
#     description = "HTTPS"
#     from_port   = 443
#     to_port     = 443
#     protocol    = "tcp"
#     cidr_blocks = ["0.0.0.0/0"]
#   }
#   egress {
#     from_port   = 0
#     to_port     = 0
#     protocol    = "-1"
#     cidr_blocks = ["0.0.0.0/0"]
#   }
#   tags = var.tags
# }

############################################################
# FRONTEND Security Group
############################################################
resource "aws_security_group" "frontend" {
  name        = "${var.name}-frontend-sg"
  vpc_id      = var.vpc_id
  description = "Frontend ECS service SG (only ALB can reach)"

  ingress {
    description     = "Allow ALB → Frontend"
    from_port       = var.frontend_port
    to_port         = var.frontend_port
    protocol        = "tcp"
    # source_security_group_id = aws_security_group.alb.id # if using local ALB SG
    cidr_blocks     = ["0.0.0.0/0"] # optionally restrict to ALB CIDRs
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = var.tags
}

############################################################
# BACKEND Security Group
############################################################
resource "aws_security_group" "backend" {
  name        = "${var.name}-backend-sg"
  vpc_id      = var.vpc_id
  description = "Backend ECS service SG (ALB → Backend, Backend → Job-server)"

  ingress {
    description = "Allow ALB → Backend"
    from_port   = var.backend_port
    to_port     = var.backend_port
    protocol    = "tcp"
    # source_security_group_id = aws_security_group.alb.id # if using local ALB SG
    cidr_blocks = ["0.0.0.0/0"] # optionally restrict to ALB CIDRs
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = var.tags
}

############################################################
# JOB-SERVER Security Group
############################################################
resource "aws_security_group" "job_server" {
  name        = "${var.name}-job-server-sg"
  vpc_id      = var.vpc_id
  description = "Job-server SG (only Backend can reach)"

  dynamic "ingress" {
    for_each = var.backend_to_job_server ? [1] : []

    content {
      description              = "Backend → Job-server"
      from_port                = var.job_server_port
      to_port                  = var.job_server_port
      protocol                 = "tcp"
      security_groups          = [aws_security_group.backend.id]
    }
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = var.tags
}

############################################################
# Outputs
############################################################
output "frontend_sg_id" {
  value = aws_security_group.frontend.id
}

output "backend_sg_id" {
  value = aws_security_group.backend.id
}

output "job_server_sg_id" {
  value = aws_security_group.job_server.id
}

# Uncomment if ALB SG is managed here
# output "alb_sg_id" {
#   value = aws_security_group.alb.id
# }
