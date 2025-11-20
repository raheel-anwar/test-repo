version: 0.2

env:
  variables:
    IMAGE_REPO: "${image_repo}"
    CONTAINER_NAME: "${container_name}"

phases:
  pre_build:
    commands:
      - echo "--- PRE-BUILD PHASE ---"
      - echo "Logging into ECR..."
      - aws ecr get-login-password --region $AWS_DEFAULT_REGION | docker login --username AWS --password-stdin $IMAGE_REPO
      - COMMIT_SHORT=$(echo $CODEBUILD_RESOLVED_SOURCE_VERSION | cut -c1-7)
      - IMAGE_TAG="${COMMIT_SHORT}"
      - echo "Image Tag: $IMAGE_TAG"

      # Optional: pull cached layers to speed up Docker build
      - docker pull ${IMAGE_REPO}:$IMAGE_TAG || true

  build:
    commands:
      - echo "--- BUILD PHASE ---"
      # Build Docker image (Dockerfile handles dependencies, multi-stage, tests)
      - docker build -t ${IMAGE_REPO}:$IMAGE_TAG .

  post_build:
    commands:
      - echo "--- POST-BUILD PHASE ---"
      - echo "Pushing Docker image..."
      - docker push ${IMAGE_REPO}:$IMAGE_TAG

      - echo "Preparing imagedefinitions.json for ECS"
      - printf '[{"name":"%s","imageUri":"%s"}]' \
          "${CONTAINER_NAME}" "${IMAGE_REPO}:$IMAGE_TAG" \
          > imagedefinitions.json

artifacts:
  files:
    - imagedefinitions.json


variable "name" {
  description = "Name of the pipeline/project"
  type        = string
}

variable "container_name" {
  description = "Name of the container in ECS task"
  type        = string
}

variable "github_owner" {
  type        = string
  description = "GitHub repository owner/org"
}

variable "github_repo" {
  type        = string
  description = "GitHub repository name"
}

variable "github_connection_arn" {
  type        = string
  description = "ARN of GitHub connection in CodeStar Connections"
}

variable "ecs_cluster_name" {
  type        = string
}

variable "ecs_service_name" {
  type        = string
}

variable "compute_type" {
  type        = string
  default     = "BUILD_GENERAL1_MEDIUM"
}

variable "region" {
  type        = string
  default     = "us-east-1"
}


locals {
  ecr_repo_uri = aws_ecr_repository.app_repo.repository_url
}

resource "aws_ecr_repository" "app_repo" {
  name = var.name
}

resource "aws_iam_role" "codebuild_role" {
  name = "${var.name}-codebuild-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = { Service = "codebuild.amazonaws.com" }
        Action = "sts:AssumeRole"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "codebuild_policy" {
  role       = aws_iam_role.codebuild_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryFullAccess"
}

resource "aws_codebuild_project" "build" {
  name         = "${var.name}-build"
  service_role = aws_iam_role.codebuild_role.arn

  artifacts {
    type = "CODEPIPELINE"
  }

  environment {
    compute_type    = var.compute_type
    image           = "aws/codebuild/standard:7.0"
    type            = "LINUX_CONTAINER"
    privileged_mode = true
  }

  source {
    type      = "CODEPIPELINE"
    buildspec = templatefile("${path.module}/templates/buildspec.tftpl", {
      image_repo     = local.ecr_repo_uri
      container_name = var.container_name
    })
  }
}

resource "aws_codepipeline" "pipeline" {
  name     = "${var.name}-pipeline"
  role_arn = aws_iam_role.codepipeline_role.arn

  artifact_store {
    location = aws_s3_bucket.codepipeline_bucket.bucket
    type     = "S3"
  }

  stage {
    name = "Source"
    action {
      name             = "Source"
      category         = "Source"
      owner            = "AWS"
      provider         = "CodeStarSourceConnection"
      output_artifacts = ["source_output"]
      configuration = {
        ConnectionArn = var.github_connection_arn
        FullRepositoryId = "${var.github_owner}/${var.github_repo}"
        Branch = "main"
      }
    }
  }

  stage {
    name = "Build"
    action {
      name            = "DockerBuild"
      category        = "Build"
      owner           = "AWS"
      provider        = "CodeBuild"
      input_artifacts = ["source_output"]
      output_artifacts = ["build_output"]
      configuration = {
        ProjectName = aws_codebuild_project.build.name
      }
    }
  }

  stage {
    name = "Deploy"
    action {
      name            = "ECSDeploy"
      category        = "Deploy"
      owner           = "AWS"
      provider        = "ECS"
      input_artifacts = ["build_output"]
      configuration = {
        ClusterName = var.ecs_cluster_name
        ServiceName = var.ecs_service_name
        FileName    = "imagedefinitions.json"
      }
    }
  }
}

# Roles and S3 bucket for CodePipeline
resource "aws_iam_role" "codepipeline_role" {
  name = "${var.name}-codepipeline-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = { Service = "codepipeline.amazonaws.com" }
        Action = "sts:AssumeRole"
      }
    ]
  })
}

resource "aws_s3_bucket" "codepipeline_bucket" {
  bucket = "${var.name}-codepipeline-bucket"
}


output "ecr_repo_uri" {
  value = aws_ecr_repository.app_repo.repository_url
}

output "codebuild_project_name" {
  value = aws_codebuild_project.build.name
}

output "codepipeline_name" {
  value = aws_codepipeline.pipeline.name
}
