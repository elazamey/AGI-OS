output "alb_dns_name" {
  description = "DNS name of the Application Load Balancer"
  value       = aws_lb.agios.dns_name
}

output "ecs_cluster_name" {
  description = "Name of the ECS cluster"
  value       = aws_ecs_cluster.agios.name
}

output "ecs_service_name" {
  description = "Name of the ECS service"
  value       = aws_ecs_service.agios.name
}

output "api_url" {
  description = "URL of the AGI-OS API"
  value       = "http://${aws_lb.agios.dns_name}"
}
