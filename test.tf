variable "submodules" {
  type = list(object({
    name       = string  # folder path in main repo
    repo_name  = string
    repo_branch = string
  }))
  default = []
}

submodules = [
  {
    name        = "app/shared"
    repo_name   = "shared-lib"
    repo_branch = "main"
  },
  {
    name        = "libs/common"
    repo_name   = "common-utils"
    repo_branch = "develop"
  }
]

# Main repo source
stage {
  name = "SourceMain"
  action {
    name             = "MainRepo"
    category         = "Source"
    owner            = "AWS"
    provider         = "CodeStarSourceConnection"
    version          = "1"
    output_artifacts = ["main_repo_artifact"]
    configuration = {
      ConnectionArn = var.codestar_connection_arn
      FullClone     = "false"
      Branch        = var.main_branch
      Repository    = var.main_repo
    }
  }
}

# Dynamic submodule sources
%{ for i, sub in var.submodules ~}
stage {
  name = "SourceSubmodule${i}"
  action {
    name             = "Submodule${i}"
    category         = "Source"
    owner            = "AWS"
    provider         = "CodeStarSourceConnection"
    version          = "1"
    output_artifacts = ["submodule_artifact_${i}"]
    configuration = {
      ConnectionArn = var.codestar_connection_arn
      FullClone     = "false"
      Branch        = sub.repo_branch
      Repository    = sub.repo_name
    }
  }
}
%{ endfor ~}

resource "aws_codebuild_project" "my_project" {
  name          = var.codebuild_project_name
  service_role  = aws_iam_role.codebuild_role.arn
  build_timeout = 30

  environment {
    compute_type    = "BUILD_GENERAL1_SMALL"
    image           = "aws/codebuild/standard:7.0"
    type            = "LINUX_CONTAINER"
    privileged_mode = true
  }

  source {
    type      = "CODEPIPELINE"
    buildspec = "buildspec.yml"
  }

  # Add dynamic secondary sources
  %{ for i, sub in var.submodules ~}
  secondary_source {
    identifier = "submodule_artifact_${i}"
    type       = "CODEPIPELINE"
  }
  %{ endfor ~}

  artifacts {
    type = "CODEPIPELINE"
  }
}

version: 0.2

phases:
  pre_build:
    commands:
      - echo "Merging submodules into main repo..."

      # dynamically loop through submodules
%{ for i, sub in var.submodules ~}
      - echo "Copying submodule ${sub.repo_name} into ${sub.name}..."
      - mkdir -p $CODEBUILD_SRC_DIR_MAIN_REPO_ARTIFACT/${sub.name}
      - cp -r $CODEBUILD_SRC_DIR_SUBMODULE_${i}/* $CODEBUILD_SRC_DIR_MAIN_REPO_ARTIFACT/${sub.name}/
%{ endfor ~}

      - echo "Listing main repo contents:"
      - ls -R $CODEBUILD_SRC_DIR_MAIN_REPO_ARTIFACT

  build:
    commands:
      - echo "Building Docker image..."
      - docker build -t ${var.ecr_repo_uri}:$CODEBUILD_RESOLVED_SOURCE_VERSION $CODEBUILD_SRC_DIR_MAIN_REPO_ARTIFACT
      - docker push ${var.ecr_repo_uri}:$CODEBUILD_RESOLVED_SOURCE_VERSION

  post_build:
    commands:
      - echo "Generating imagedefinitions.json for ECS..."
      - printf '[{"name":"%s","imageUri":"%s"}]' "${var.codebuild_project_name}" "${var.ecr_repo_uri}:$CODEBUILD_RESOLVED_SOURCE_VERSION" > imagedefinitions.json

