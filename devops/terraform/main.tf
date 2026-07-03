terraform {
  required_version = ">= 1.6"
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.0" }
  }

  # Fix Issue 10 & 11: DynamoDB locking + encryption
  backend "s3" {
    bucket         = "intellmeet-tfstate"
    key            = "prod/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "intellmeet-tfstate-lock"
    encrypt        = true
  }
}

provider "aws" { region = var.region }

# ── VPC ─────────────────────────────────────────────────────────
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.0"
  name    = "intellmeet-vpc"
  cidr    = "10.0.0.0/16"

  azs             = ["${var.region}a", "${var.region}b"]
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24"]

  enable_nat_gateway   = true
  # Fix Issue 15: single NAT gateway saves ~$32/month; enable per-AZ only when budget allows
  single_nat_gateway   = true
  enable_dns_hostnames = true
}

# ── ECR Repositories ────────────────────────────────────────────
resource "aws_ecr_repository" "backend" {
  name                 = "intellmeet-backend"
  image_tag_mutability = "IMMUTABLE"
  image_scanning_configuration { scan_on_push = true }
  lifecycle { prevent_destroy = true }
}

resource "aws_ecr_repository" "frontend" {
  name                 = "intellmeet-frontend"
  image_tag_mutability = "IMMUTABLE"
  image_scanning_configuration { scan_on_push = true }
  lifecycle { prevent_destroy = true }
}

# ── ECS Cluster ─────────────────────────────────────────────────
resource "aws_ecs_cluster" "main" {
  name = "intellmeet-cluster"
  setting {
    name  = "containerInsights"
    value = "enabled"
  }
  lifecycle { prevent_destroy = true }
}

# ── ALB ─────────────────────────────────────────────────────────
resource "aws_lb" "main" {
  name                       = "intellmeet-alb"
  load_balancer_type         = "application"
  subnets                    = module.vpc.public_subnets
  security_groups            = [aws_security_group.alb.id]

  # CWE-703 fix: drop requests containing invalid/malformed HTTP headers
  # Prevents HTTP request smuggling, header injection, and cache poisoning attacks
  drop_invalid_header_fields = true
}

resource "aws_security_group" "alb" {
  name   = "intellmeet-alb-sg"
  vpc_id = module.vpc.vpc_id

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

# ── ECS Task Security Group ──────────────────────────────────────
resource "aws_security_group" "ecs_tasks" {
  name   = "intellmeet-ecs-tasks-sg"
  vpc_id = module.vpc.vpc_id

  ingress {
    from_port       = 5000
    to_port         = 5000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# ── ElastiCache Security Group ───────────────────────────────────
# Fix Issue 22: dedicated SG — only allows inbound 6379 from ECS tasks
resource "aws_security_group" "elasticache" {
  name   = "intellmeet-elasticache-sg"
  vpc_id = module.vpc.vpc_id

  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_tasks.id]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# ── ElastiCache Redis ────────────────────────────────────────────
resource "aws_elasticache_cluster" "redis" {
  cluster_id           = "intellmeet-redis"
  engine               = "redis"
  node_type            = "cache.t3.micro"
  num_cache_nodes      = 1
  parameter_group_name = "default.redis7"
  subnet_group_name    = aws_elasticache_subnet_group.redis.name
  security_group_ids   = [aws_security_group.elasticache.id]
}

resource "aws_elasticache_subnet_group" "redis" {
  name       = "intellmeet-redis-subnet"
  subnet_ids = module.vpc.private_subnets
}

# ── DynamoDB table for Terraform state locking ───────────────────
resource "aws_dynamodb_table" "tfstate_lock" {
  name         = "intellmeet-tfstate-lock"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }
}

# ── Outputs ──────────────────────────────────────────────────────
# Fix Issue 23: expose key values for CI/CD and operators
output "alb_dns_name" {
  description = "ALB DNS name — use this as your CNAME target"
  value       = aws_lb.main.dns_name
}

output "ecr_backend_url" {
  description = "ECR URI for backend image"
  value       = aws_ecr_repository.backend.repository_url
}

output "ecr_frontend_url" {
  description = "ECR URI for frontend image"
  value       = aws_ecr_repository.frontend.repository_url
}

output "ecs_cluster_name" {
  description = "ECS cluster name"
  value       = aws_ecs_cluster.main.name
}

output "vpc_id" {
  description = "VPC ID"
  value       = module.vpc.vpc_id
}
