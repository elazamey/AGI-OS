# ═══════════════════════════════════════════════════════
# AGI-OS Terraform — AWS ECS Deployment
# ═══════════════════════════════════════════════════════

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# ── VPC ──────────────────────────────────────────────

resource "aws_vpc" "agios" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "${var.project_name}-vpc"
  }
}

resource "aws_subnet" "public" {
  count             = 2
  vpc_id            = aws_vpc.agios.id
  cidr_block        = cidrsubnet(aws_vpc.agios.cidr_block, 8, count.index)
  availability_zone = data.aws_availability_zones.available.names[count.index]

  map_public_ip_on_launch = true

  tags = {
    Name = "${var.project_name}-public-${count.index}"
  }
}

resource "aws_internet_gateway" "agios" {
  vpc_id = aws_vpc.agios.id

  tags = {
    Name = "${var.project_name}-igw"
  }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.agios.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.agios.id
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

# ── ECS Cluster ──────────────────────────────────────

resource "aws_ecs_cluster" "agios" {
  name = "${var.project_name}-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

# ── IAM Roles ────────────────────────────────────────

resource "aws_iam_role" "agios_task" {
  name = "${var.project_name}-task-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "ecs-tasks.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_role_policy" "agios_task" {
  name = "${var.project_name}-task-policy"
  role = aws_iam_role.agios_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["ecs:*", "ecr:*", "logs:*"]
        Resource = "*"
      }
    ]
  })
}

# ── ECS Task Definition ──────────────────────────────

resource "aws_ecs_task_definition" "agios" {
  family                   = "${var.project_name}-task"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.task_cpu
  memory                   = var.task_memory
  execution_role_arn       = aws_iam_role.agios_task.arn
  task_role_arn            = aws_iam_role.agios_task.arn

  container_definitions = jsonencode([{
    name  = "agios-gateway"
    image = var.container_image

    portMappings = [{
      containerPort = 7860
      hostPort      = 7860
      protocol      = "tcp"
    }]

    environment = [
      { name = "NODE_ENV", value = "production" },
      { name = "PORT", value = "7860" },
      { name = "MAX_SPEND", value = "0" },
    ]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = "/ecs/${var.project_name}"
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "ecs"
      }
    }

    healthCheck = {
      command     = ["CMD-SHELL", "node -e \"require('http').get('http://localhost:7860/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1) })\""]
      interval    = 30
      timeout     = 5
      retries     = 3
      startPeriod = 10
    }
  }])
}

# ── Security Group ───────────────────────────────────

resource "aws_security_group" "agios" {
  name_prefix = "${var.project_name}-sg"
  vpc_id      = aws_vpc.agios.id

  ingress {
    from_port   = 7860
    to_port     = 7860
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 80
    to_port     = 80
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

# ── ECS Service ──────────────────────────────────────

resource "aws_ecs_service" "agios" {
  name            = "${var.project_name}-service"
  cluster         = aws_ecs_cluster.agios.id
  task_definition = aws_ecs_task_definition.agios.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = aws_subnet.public[*].id
    security_groups  = [aws_security_group.agios.id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.agios.arn
    container_name   = "agios-gateway"
    container_port   = 7860
  }
}

# ── ALB ──────────────────────────────────────────────

resource "aws_lb" "agios" {
  name               = "${var.project_name}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.agios.id]
  subnets            = aws_subnet.public[*].id
}

resource "aws_lb_target_group" "agios" {
  name        = "${var.project_name}-tg"
  port        = 7860
  protocol    = "HTTP"
  vpc_id      = aws_vpc.agios.id
  target_type = "ip"

  health_check {
    path                = "/health"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 5
    interval            = 30
    matcher             = "200"
  }
}

resource "aws_lb_listener" "agios" {
  load_balancer_arn = aws_lb.agios.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.agios.arn
  }
}

# ── CloudWatch ───────────────────────────────────────

resource "aws_cloudwatch_log_group" "agios" {
  name              = "/ecs/${var.project_name}"
  retention_in_days = 30
}

# ── Data Sources ─────────────────────────────────────

data "aws_availability_zones" "available" {
  state = "available"
}
