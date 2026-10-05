terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.40"
    }
  }
}

provider "aws" {
  region = var.aws_region
  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}

data "aws_caller_identity" "current" {}
data "aws_availability_zones" "available" {
  state = "available"
}

# ==============================================================================
# KMS Customer Managed Key (CMK) for Unified Encryption-at-Rest
# ==============================================================================
resource "aws_kms_key" "biocloud_key" {
  description             = "KMS Key for ${var.project_name} storage, database, and logs"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Enable IAM User Permissions"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "Allow CloudWatch Logs"
        Effect = "Allow"
        Principal = {
          Service = "logs.${var.aws_region}.amazonaws.com"
        }
        Action = [
          "kms:Encrypt*",
          "kms:Decrypt*",
          "kms:ReEncrypt*",
          "kms:GenerateDataKey*",
          "kms:Describe*"
        ]
        Resource = "*"
      }
    ]
  })
}

resource "aws_kms_alias" "biocloud_key_alias" {
  name          = "alias/${var.project_name}-${var.environment}"
  target_key_id = aws_kms_key.biocloud_key.key_id
}

# ==============================================================================
# Amazon Elastic Container Registry (ECR) Repositories
# ==============================================================================
resource "aws_ecr_repository" "backend" {
  name                 = "${var.project_name}-backend"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "KMS"
    kms_key         = aws_kms_key.biocloud_key.arn
  }

  tags = {
    Name = "${var.project_name}-backend-ecr"
  }
}

resource "aws_ecr_repository" "frontend" {
  name                 = "${var.project_name}-frontend"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "KMS"
    kms_key         = aws_kms_key.biocloud_key.arn
  }

  tags = {
    Name = "${var.project_name}-frontend-ecr"
  }
}

resource "aws_ecr_repository" "worker_ecg" {
  name                 = "${var.project_name}-worker-ecg"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "KMS"
    kms_key         = aws_kms_key.biocloud_key.arn
  }

  tags = {
    Name = "${var.project_name}-worker-ecg-ecr"
  }
}

resource "aws_ecr_repository" "worker_protein" {
  name                 = "${var.project_name}-worker-protein"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "KMS"
    kms_key         = aws_kms_key.biocloud_key.arn
  }

  tags = {
    Name = "${var.project_name}-worker-protein-ecr"
  }
}

resource "aws_ecr_lifecycle_policy" "backend_policy" {
  repository = aws_ecr_repository.backend.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep last 10 images"
        selection = {
          tagStatus   = "any"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = 30
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}

# ==============================================================================
# Dedicated Virtual Private Cloud (VPC)
# ==============================================================================
resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "${var.project_name}-vpc"
  }
}

resource "aws_internet_gateway" "igw" {
  vpc_id = aws_vpc.main.id
  tags = {
    Name = "${var.project_name}-igw"
  }
}

# Public subnets (ALB & NAT Gateways)
resource "aws_subnet" "public" {
  count                   = 2
  vpc_id                  = aws_vpc.main.id
  cidr_block              = cidrsubnet(var.vpc_cidr, 4, count.index)
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true

  tags = {
    Name = "${var.project_name}-public-subnet-${count.index + 1}"
    Type = "Public"
  }
}

# Private subnets (ECS, Aurora, AWS Batch)
resource "aws_subnet" "private" {
  count             = 2
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 4, count.index + 4)
  availability_zone = data.aws_availability_zones.available.names[count.index]

  tags = {
    Name = "${var.project_name}-private-subnet-${count.index + 1}"
    Type = "Private"
  }
}

resource "aws_eip" "nat" {
  domain = "vpc"
  tags = {
    Name = "${var.project_name}-nat-eip"
  }
}

resource "aws_nat_gateway" "nat" {
  allocation_id = aws_eip.nat.id
  subnet_id     = aws_subnet.public[0].id

  tags = {
    Name = "${var.project_name}-nat-gw"
  }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.igw.id
  }
  tags = {
    Name = "${var.project_name}-public-rt"
  }
}

resource "aws_route_table_association" "public" {
  count          = 2
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table" "private" {
  vpc_id = aws_vpc.main.id
  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.nat.id
  }
  tags = {
    Name = "${var.project_name}-private-rt"
  }
}

resource "aws_route_table_association" "private" {
  count          = 2
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private.id
}

# ==============================================================================
# Amazon S3 Secure Storage (ECG & Protein Datasets)
# ==============================================================================
resource "aws_s3_bucket" "workbench_data" {
  bucket        = "${var.project_name}-data-${data.aws_caller_identity.current.account_id}-${var.aws_region}"
  force_destroy = false
}

resource "aws_s3_bucket_versioning" "workbench_versioning" {
  bucket = aws_s3_bucket.workbench_data.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "workbench_sse" {
  bucket = aws_s3_bucket.workbench_data.id

  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = aws_kms_key.biocloud_key.arn
      sse_algorithm     = "aws:kms"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "workbench_pab" {
  bucket = aws_s3_bucket.workbench_data.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_cors_configuration" "workbench_cors" {
  bucket = aws_s3_bucket.workbench_data.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["PUT", "POST", "GET", "HEAD"]
    allowed_origins = ["https://*"]
    expose_headers  = ["ETag", "x-amz-server-side-encryption"]
    max_age_seconds = 3600
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "workbench_lifecycle" {
  bucket = aws_s3_bucket.workbench_data.id

  rule {
    id     = "expire-noncurrent-versions-and-abort-uploads"
    status = "Enabled"

    filter {}

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }

    noncurrent_version_expiration {
      noncurrent_days = 90
    }
  }
}


# ==============================================================================
# Amazon Cognito Authentication & User Management
# ==============================================================================
resource "aws_cognito_user_pool" "pool" {
  name = "${var.project_name}-user-pool"

  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  password_policy {
    minimum_length    = 10
    require_lowercase = true
    require_numbers   = true
    require_symbols   = true
    require_uppercase = true
  }

  admin_create_user_config {
    allow_admin_create_user_only = false
  }

  schema {
    name                = "role"
    attribute_data_type = "String"
    mutable             = true
    required            = false
    string_attribute_constraints {
      min_length = "1"
      max_length = "20"
    }
  }
}

resource "aws_cognito_user_group" "researchers" {
  name         = "Researchers"
  user_pool_id = aws_cognito_user_pool.pool.id
  description  = "BioCloud Workbench Research Staff"
}

resource "aws_cognito_user_group" "admins" {
  name         = "Administrators"
  user_pool_id = aws_cognito_user_pool.pool.id
  description  = "BioCloud Workbench System Administrators"
}

resource "aws_cognito_user_pool_client" "client" {
  name         = "${var.project_name}-web-client"
  user_pool_id = aws_cognito_user_pool.pool.id

  generate_secret = false
  explicit_auth_flows = [
    "ALLOW_USER_SRP_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
    "ALLOW_USER_PASSWORD_AUTH"
  ]

  prevent_user_existence_errors = "ENABLED"
}

# ==============================================================================
# Amazon Aurora Serverless v2 PostgreSQL (Metadata & Audit)
# ==============================================================================
resource "aws_db_subnet_group" "db_subnets" {
  name       = "${var.project_name}-db-subnet-group"
  subnet_ids = aws_subnet.private[*].id

  tags = {
    Name = "${var.project_name}-db-subnets"
  }
}

resource "aws_security_group" "db_sg" {
  name        = "${var.project_name}-db-sg"
  description = "Access to Aurora PostgreSQL"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "PostgreSQL from Backend ECS"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.backend_sg.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "random_password" "db_master_password" {
  length  = 24
  special = false
}

resource "aws_rds_cluster" "aurora" {
  cluster_identifier      = "${var.project_name}-cluster"
  engine                  = "aurora-postgresql"
  engine_mode             = "provisioned"
  engine_version          = "16.1"
  database_name           = var.db_name
  master_username         = var.db_username
  master_password         = random_password.db_master_password.result
  db_subnet_group_name    = aws_db_subnet_group.db_subnets.name
  vpc_security_group_ids  = [aws_security_group.db_sg.id]
  kms_key_id              = aws_kms_key.biocloud_key.arn
  storage_encrypted       = true
  skip_final_snapshot     = true
  backup_retention_period = 7

  serverlessv2_scaling_configuration {
    min_capacity = var.db_min_acu
    max_capacity = var.db_max_acu
  }
}

resource "aws_rds_cluster_instance" "aurora_instance" {
  cluster_identifier = aws_rds_cluster.aurora.id
  instance_class     = "db.serverless"
  engine             = aws_rds_cluster.aurora.engine
  engine_version     = aws_rds_cluster.aurora.engine_version
}

# Store database master credentials securely in AWS Secrets Manager
resource "aws_secretsmanager_secret" "db_credentials" {
  name                    = "${var.project_name}-db-credentials-${var.environment}"
  description             = "Aurora PostgreSQL database connection string and credentials"
  kms_key_id              = aws_kms_key.biocloud_key.arn
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "db_credentials_val" {
  secret_id = aws_secretsmanager_secret.db_credentials.id
  secret_string = jsonencode({
    engine       = "postgres"
    host         = aws_rds_cluster.aurora.endpoint
    port         = 5432
    username     = var.db_username
    password     = random_password.db_master_password.result
    database     = var.db_name
    database_url = "postgresql+psycopg2://${var.db_username}:${random_password.db_master_password.result}@${aws_rds_cluster.aurora.endpoint}:5432/${var.db_name}"
  })
}


# ==============================================================================
# Amazon SQS Decoupled Job Queues (FIFO for Sequential Processing)
# ==============================================================================
resource "aws_sqs_queue" "ecg_dlq" {
  name                      = "${var.project_name}-ecg-dlq.fifo"
  fifo_queue                = true
  kms_master_key_id         = aws_kms_key.biocloud_key.id
  message_retention_seconds = 1209600 # 14 days
}

resource "aws_sqs_queue" "ecg_queue" {
  name                        = "${var.project_name}-ecg-queue.fifo"
  fifo_queue                  = true
  content_based_deduplication = true
  kms_master_key_id           = aws_kms_key.biocloud_key.id
  visibility_timeout_seconds  = 300

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.ecg_dlq.arn
    maxReceiveCount     = 3
  })
}

resource "aws_sqs_queue" "protein_dlq" {
  name                      = "${var.project_name}-protein-dlq.fifo"
  fifo_queue                = true
  kms_master_key_id         = aws_kms_key.biocloud_key.id
  message_retention_seconds = 1209600
}

resource "aws_sqs_queue" "protein_queue" {
  name                        = "${var.project_name}-protein-queue.fifo"
  fifo_queue                  = true
  content_based_deduplication = true
  kms_master_key_id           = aws_kms_key.biocloud_key.id
  visibility_timeout_seconds  = 900 # 15 minutes for GPU model runs

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.protein_dlq.arn
    maxReceiveCount     = 2
  })
}

# ==============================================================================
# CloudWatch Log Groups & Alarms
# ==============================================================================
resource "aws_cloudwatch_log_group" "backend_logs" {
  name              = "/ecs/${var.project_name}-backend"
  retention_in_days = var.retention_in_days
  kms_key_id        = aws_kms_key.biocloud_key.arn
}

resource "aws_cloudwatch_log_group" "batch_logs" {
  name              = "/aws/batch/${var.project_name}-protein"
  retention_in_days = var.retention_in_days
  kms_key_id        = aws_kms_key.biocloud_key.arn
}

resource "aws_cloudwatch_metric_alarm" "ecg_dlq_alarm" {
  alarm_name          = "${var.project_name}-ecg-dlq-messages"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 60
  statistic           = "Maximum"
  threshold           = 0
  alarm_description   = "Alarm when ECG jobs land in Dead Letter Queue"
  dimensions = {
    QueueName = aws_sqs_queue.ecg_dlq.name
  }
}

# ==============================================================================
# Security Groups & ECS Fargate Service (API Backend)
# ==============================================================================
resource "aws_security_group" "alb_sg" {
  name        = "${var.project_name}-alb-sg"
  description = "Public HTTP/HTTPS traffic to ALB"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "backend_sg" {
  name        = "${var.project_name}-backend-sg"
  description = "Traffic to FastAPI backend containers"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 8000
    to_port         = 8000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb_sg.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_ecs_cluster" "cluster" {
  name = "${var.project_name}-ecs-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

# IAM Role for ECS Task Execution
resource "aws_iam_role" "ecs_execution_role" {
  name = "${var.project_name}-ecs-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_execution_attach" {
  role       = aws_iam_role.ecs_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Allow ECS Execution Role to fetch database secrets at container startup
resource "aws_iam_policy" "ecs_execution_secrets" {
  name        = "${var.project_name}-execution-secrets"
  description = "Allow ECS Execution Agent to retrieve Secrets Manager secrets and decrypt with KMS"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["secretsmanager:GetSecretValue"]
        Resource = [aws_secretsmanager_secret.db_credentials.arn]
      },
      {
        Effect   = "Allow"
        Action   = ["kms:Decrypt"]
        Resource = [aws_kms_key.biocloud_key.arn]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_execution_secrets_attach" {
  role       = aws_iam_role.ecs_execution_role.name
  policy_arn = aws_iam_policy.ecs_execution_secrets.arn
}

# IAM Role for ECS Task Runtime (Access S3, SQS, KMS, Batch)
resource "aws_iam_role" "ecs_task_role" {
  name = "${var.project_name}-ecs-task-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })
}

resource "aws_iam_policy" "ecs_task_policy" {
  name        = "${var.project_name}-task-permissions"
  description = "Permissions for FastAPI backend to access S3, SQS, KMS, Batch, and Secrets Manager"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:ListBucket",
          "s3:DeleteObject"
        ]
        Resource = [
          aws_s3_bucket.workbench_data.arn,
          "${aws_s3_bucket.workbench_data.arn}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "sqs:SendMessage",
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes"
        ]
        Resource = [
          aws_sqs_queue.ecg_queue.arn,
          aws_sqs_queue.protein_queue.arn
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey"
        ]
        Resource = [aws_kms_key.biocloud_key.arn]
      },
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = [aws_secretsmanager_secret.db_credentials.arn]
      },
      {
        Effect = "Allow"
        Action = [
          "batch:SubmitJob",
          "batch:DescribeJobs",
          "batch:TerminateJob"
        ]
        Resource = "*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_task_attach" {
  role       = aws_iam_role.ecs_task_role.name
  policy_arn = aws_iam_policy.ecs_task_policy.arn
}

resource "aws_ecs_task_definition" "backend" {
  family                   = "${var.project_name}-backend"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "1024"
  memory                   = "2048"
  execution_role_arn       = aws_iam_role.ecs_execution_role.arn
  task_role_arn            = aws_iam_role.ecs_task_role.arn

  container_definitions = jsonencode([
    {
      name      = "api"
      image     = var.backend_container_image
      essential = true
      portMappings = [
        {
          containerPort = 8000
          hostPort      = 8000
        }
      ]
      environment = [
        { name = "STORAGE_TYPE", value = "s3" },
        { name = "QUEUE_TYPE", value = "sqs" },
        { name = "LOCAL_DEV_MODE", value = "false" },
        { name = "AWS_REGION", value = var.aws_region },
        { name = "AWS_S3_BUCKET", value = aws_s3_bucket.workbench_data.id },
        { name = "AWS_KMS_KEY_ID", value = aws_kms_key.biocloud_key.id },
        { name = "COGNITO_USER_POOL_ID", value = aws_cognito_user_pool.pool.id },
        { name = "COGNITO_CLIENT_ID", value = aws_cognito_user_pool_client.client.id },
        { name = "COGNITO_REGION", value = var.aws_region },
        { name = "SQS_ECG_QUEUE_URL", value = aws_sqs_queue.ecg_queue.url },
        { name = "SQS_PROTEIN_QUEUE_URL", value = aws_sqs_queue.protein_queue.url },
        { name = "BATCH_PROTEIN_JOB_QUEUE", value = aws_batch_job_queue.protein_queue.name },
        { name = "BATCH_PROTEIN_JOB_DEFINITION", value = "${var.project_name}-esmfold-prediction" }
      ]
      secrets = [
        {
          name      = "DATABASE_URL"
          valueFrom = "${aws_secretsmanager_secret.db_credentials.arn}:database_url::"
        }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.backend_logs.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "api"
        }
      }
    }
  ])
}


# ==============================================================================
# AWS Batch GPU Compute Environment (ESMFold Protein Prediction)
# ==============================================================================
resource "aws_iam_role" "batch_service_role" {
  name = "${var.project_name}-batch-service-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "batch.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "batch_service_attach" {
  role       = aws_iam_role.batch_service_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSBatchServiceRole"
}

resource "aws_security_group" "batch_sg" {
  name        = "${var.project_name}-batch-gpu-sg"
  description = "Security group for AWS Batch GPU instances"
  vpc_id      = aws_vpc.main.id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_batch_compute_environment" "protein_gpu_env" {
  compute_environment_name = "${var.project_name}-gpu-env"
  type                     = "MANAGED"
  service_role             = aws_iam_role.batch_service_role.arn

  compute_resources {
    type                = "EC2"
    instance_type       = [var.protein_gpu_instance_type]
    max_vcpus           = 32
    min_vcpus           = 0
    desired_vcpus       = 0
    security_group_ids  = [aws_security_group.batch_sg.id]
    subnets             = aws_subnet.private[*].id
    allocation_strategy = "BEST_FIT_PROGRESSIVE"
    instance_role       = aws_iam_instance_profile.batch_instance_profile.arn
  }

  depends_on = [aws_iam_role_policy_attachment.batch_service_attach]
}

resource "aws_iam_role" "batch_instance_role" {
  name = "${var.project_name}-batch-instance-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "batch_instance_attach" {
  role       = aws_iam_role.batch_instance_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonEC2ContainerServiceforEC2Role"
}

resource "aws_iam_instance_profile" "batch_instance_profile" {
  name = "${var.project_name}-batch-instance-profile"
  role = aws_iam_role.batch_instance_role.name
}

resource "aws_batch_job_queue" "protein_queue" {
  name     = "${var.project_name}-protein-batch-queue"
  state    = "ENABLED"
  priority = 1

  compute_environment_order {
    order               = 1
    compute_environment = aws_batch_compute_environment.protein_gpu_env.arn
  }
}

# IAM Role for AWS Batch Job Container (Fetches FASTA securely, saves predicted PDB to S3)
resource "aws_iam_role" "batch_job_role" {
  name = "${var.project_name}-batch-job-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })
}

resource "aws_iam_policy" "batch_job_policy" {
  name        = "${var.project_name}-batch-job-permissions"
  description = "Permissions for ESMFold Batch GPU container to access S3 dataset bucket, KMS, and Secrets"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject"
        ]
        Resource = [
          "${aws_s3_bucket.workbench_data.arn}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey"
        ]
        Resource = [aws_kms_key.biocloud_key.arn]
      },
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = [aws_secretsmanager_secret.db_credentials.arn]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "batch_job_attach" {
  role       = aws_iam_role.batch_job_role.name
  policy_arn = aws_iam_policy.batch_job_policy.arn
}

# AWS Batch Job Definition for ESMFold Protein Structure Prediction
resource "aws_batch_job_definition" "protein_prediction" {
  name                  = "${var.project_name}-esmfold-prediction"
  type                  = "container"
  platform_capabilities = ["EC2"]

  container_properties = jsonencode({
    image            = var.protein_worker_image
    command          = ["python", "-m", "backend.app.workers.protein_worker", "--job-id", "Ref::job_id"]
    jobRoleArn       = aws_iam_role.batch_job_role.arn
    executionRoleArn = aws_iam_role.ecs_execution_role.arn
    resourceRequirements = [
      { type = "GPU", value = "1" },
      { type = "VCPU", value = "4" },
      { type = "MEMORY", value = "16384" }
    ]
    environment = [
      { name = "STORAGE_TYPE", value = "s3" },
      { name = "AWS_S3_BUCKET", value = aws_s3_bucket.workbench_data.id },
      { name = "AWS_REGION", value = var.aws_region },
      { name = "AWS_KMS_KEY_ID", value = aws_kms_key.biocloud_key.id },
      { name = "LOCAL_DEV_MODE", value = "false" },
      { name = "ESMFOLD_MODEL_ENABLED", value = "true" }
    ]
    secrets = [
      {
        name      = "DATABASE_URL"
        valueFrom = "${aws_secretsmanager_secret.db_credentials.arn}:database_url::"
      }
    ]
  })
}

# ==============================================================================
# Application Load Balancer (Public Ingress to API)
# ==============================================================================
resource "aws_lb" "api" {
  name               = "${var.project_name}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb_sg.id]
  subnets            = aws_subnet.public[*].id

  enable_deletion_protection = false

  tags = {
    Name = "${var.project_name}-alb"
  }
}

resource "aws_lb_target_group" "api" {
  name        = "${var.project_name}-api-tg"
  port        = 8000
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"

  health_check {
    enabled             = true
    path                = "/api/v1/health"
    port                = "8000"
    protocol            = "HTTP"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
    matcher             = "200"
  }

  tags = {
    Name = "${var.project_name}-api-tg"
  }
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.api.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }
}

# ==============================================================================
# ECS Fargate Service (API Backend)
# ==============================================================================
resource "aws_ecs_service" "backend" {
  name            = "${var.project_name}-backend-service"
  cluster         = aws_ecs_cluster.cluster.id
  task_definition = aws_ecs_task_definition.backend.arn
  desired_count   = var.backend_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.backend_sg.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.api.arn
    container_name   = "api"
    container_port   = 8000
  }

  depends_on = [
    aws_lb_listener.http,
    aws_rds_cluster_instance.aurora_instance
  ]

  tags = {
    Name = "${var.project_name}-backend-service"
  }
}

# ==============================================================================
# ECS Fargate Service (ECG SQS Background Consumer Worker)
# ==============================================================================
resource "aws_ecs_task_definition" "ecg_worker" {
  family                   = "${var.project_name}-ecg-worker"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "512"
  memory                   = "1024"
  execution_role_arn       = aws_iam_role.ecs_execution_role.arn
  task_role_arn            = aws_iam_role.ecs_task_role.arn

  container_definitions = jsonencode([
    {
      name      = "ecg-consumer"
      image     = var.backend_container_image
      essential = true
      command   = ["python", "-m", "backend.app.workers.sqs_consumer", "--workflow", "ecg"]
      environment = [
        { name = "STORAGE_TYPE", value = "s3" },
        { name = "QUEUE_TYPE", value = "sqs" },
        { name = "LOCAL_DEV_MODE", value = "false" },
        { name = "AWS_REGION", value = var.aws_region },
        { name = "AWS_S3_BUCKET", value = aws_s3_bucket.workbench_data.id },
        { name = "AWS_KMS_KEY_ID", value = aws_kms_key.biocloud_key.id },
        { name = "SQS_ECG_QUEUE_URL", value = aws_sqs_queue.ecg_queue.url },
        { name = "SQS_PROTEIN_QUEUE_URL", value = aws_sqs_queue.protein_queue.url }
      ]
      secrets = [
        {
          name      = "DATABASE_URL"
          valueFrom = "${aws_secretsmanager_secret.db_credentials.arn}:database_url::"
        }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.backend_logs.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "ecg-worker"
        }
      }
    }
  ])
}

resource "aws_ecs_service" "ecg_worker" {
  name            = "${var.project_name}-ecg-worker-service"
  cluster         = aws_ecs_cluster.cluster.id
  task_definition = aws_ecs_task_definition.ecg_worker.arn
  desired_count   = var.worker_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.backend_sg.id]
    assign_public_ip = false
  }

  depends_on = [
    aws_rds_cluster_instance.aurora_instance,
    aws_sqs_queue.ecg_queue
  ]

  tags = {
    Name = "${var.project_name}-ecg-worker-service"
  }
}

