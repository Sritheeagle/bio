output "aws_region" {
  description = "Target AWS Region"
  value       = var.aws_region
}

output "aws_kms_key_id" {
  description = "KMS Customer Managed Key ID (matches AWS_KMS_KEY_ID)"
  value       = aws_kms_key.biocloud_key.id
}

output "kms_key_arn" {
  description = "ARN of the primary KMS Customer Managed Key"
  value       = aws_kms_key.biocloud_key.arn
}

output "aws_s3_bucket" {
  description = "Name of the secure S3 dataset bucket (matches AWS_S3_BUCKET)"
  value       = aws_s3_bucket.workbench_data.id
}

output "cognito_user_pool_id" {
  description = "Cognito User Pool ID (matches COGNITO_USER_POOL_ID)"
  value       = aws_cognito_user_pool.pool.id
}

output "cognito_client_id" {
  description = "Cognito User Pool App Client ID (matches COGNITO_CLIENT_ID)"
  value       = aws_cognito_user_pool_client.client.id
}

output "cognito_region" {
  description = "Cognito User Pool Region (matches COGNITO_REGION)"
  value       = var.aws_region
}

output "aurora_endpoint" {
  description = "Aurora PostgreSQL Serverless v2 writer endpoint"
  value       = aws_rds_cluster.aurora.endpoint
}

output "database_credentials_secret_arn" {
  description = "Secrets Manager Secret ARN storing database connection credentials"
  value       = aws_secretsmanager_secret.db_credentials.arn
}

output "sqs_ecg_queue_url" {
  description = "SQS FIFO Queue URL for ECG jobs (matches SQS_ECG_QUEUE_URL)"
  value       = aws_sqs_queue.ecg_queue.url
}

output "sqs_protein_queue_url" {
  description = "SQS FIFO Queue URL for Protein jobs (matches SQS_PROTEIN_QUEUE_URL)"
  value       = aws_sqs_queue.protein_queue.url
}

output "sqs_ecg_dlq_url" {
  description = "SQS FIFO Dead Letter Queue URL for ECG jobs"
  value       = aws_sqs_queue.ecg_dlq.url
}

output "sqs_protein_dlq_url" {
  description = "SQS FIFO Dead Letter Queue URL for Protein jobs"
  value       = aws_sqs_queue.protein_dlq.url
}

output "batch_protein_job_queue" {
  description = "AWS Batch GPU Queue name for ESMFold predictions (matches BATCH_PROTEIN_JOB_QUEUE)"
  value       = aws_batch_job_queue.protein_queue.name
}

output "batch_protein_job_definition" {
  description = "AWS Batch Job Definition ARN for ESMFold predictions (matches BATCH_PROTEIN_JOB_DEFINITION)"
  value       = aws_batch_job_definition.protein_prediction.arn
}

output "alb_dns_name" {
  description = "Public DNS name of the Application Load Balancer"
  value       = aws_lb.api.dns_name
}

output "alb_arn" {
  description = "ARN of the Application Load Balancer"
  value       = aws_lb.api.arn
}

output "ecs_backend_service_name" {
  description = "Name of the backend FastAPI ECS Fargate service"
  value       = aws_ecs_service.backend.name
}

output "ecs_ecg_worker_service_name" {
  description = "Name of the ECG SQS consumer worker ECS Fargate service"
  value       = aws_ecs_service.ecg_worker.name
}

output "ecr_backend_repository_url" {
  description = "ECR Repository URL for Backend Docker image"
  value       = aws_ecr_repository.backend.repository_url
}

output "ecr_frontend_repository_url" {
  description = "ECR Repository URL for Frontend Docker image"
  value       = aws_ecr_repository.frontend.repository_url
}

output "ecr_worker_ecg_repository_url" {
  description = "ECR Repository URL for ECG Worker Docker image"
  value       = aws_ecr_repository.worker_ecg.repository_url
}

output "ecr_worker_protein_repository_url" {
  description = "ECR Repository URL for Protein Worker Docker image"
  value       = aws_ecr_repository.worker_protein.repository_url
}


