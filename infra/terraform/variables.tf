variable "aws_region" {
  description = "AWS region for deployment"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment identifier (e.g. staging, production)"
  type        = string
  default     = "production"
}

variable "project_name" {
  description = "Application project prefix"
  type        = string
  default     = "biocloud-workbench"
}

variable "vpc_cidr" {
  description = "CIDR block for the dedicated VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "db_name" {
  description = "Aurora PostgreSQL database name"
  type        = string
  default     = "biocloud"
}

variable "db_username" {
  description = "Aurora PostgreSQL master username"
  type        = string
  default     = "biocloud_admin"
}

variable "db_min_acu" {
  description = "Minimum Aurora Serverless v2 capacity units (ACUs)"
  type        = number
  default     = 0.5
}

variable "db_max_acu" {
  description = "Maximum Aurora Serverless v2 capacity units (ACUs)"
  type        = number
  default     = 4.0
}

variable "backend_container_image" {
  description = "ECR image URI for the FastAPI backend"
  type        = string
  default     = "biocloud-backend:latest"
}

variable "protein_worker_image" {
  description = "ECR image URI for the ESMFold GPU worker"
  type        = string
  default     = "biocloud-protein-worker:latest"
}


variable "protein_gpu_instance_type" {
  description = "EC2 GPU instance type for AWS Batch ESMFold predictions"
  type        = string
  default     = "g5.xlarge"
}

variable "retention_in_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 30
}

variable "backend_desired_count" {
  description = "Desired number of running FastAPI backend Fargate tasks"
  type        = number
  default     = 2
}

variable "worker_desired_count" {
  description = "Desired number of running ECG SQS consumer worker Fargate tasks"
  type        = number
  default     = 1
}

