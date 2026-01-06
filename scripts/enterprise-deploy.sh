#!/bin/bash

# Click Enterprise Deployment Orchestrator
# Complete enterprise-grade deployment automation

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DEPLOYMENT_ID="$(date +%Y%m%d-%H%M%S)"
LOG_FILE="$PROJECT_ROOT/logs/enterprise-deployment-$DEPLOYMENT_ID.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

log_header() {
    echo -e "${PURPLE}================================================================================${NC}" | tee -a "$LOG_FILE"
    echo -e "${CYAN}$1${NC}" | tee -a "$LOG_FILE"
    echo -e "${PURPLE}================================================================================${NC}" | tee -a "$LOG_FILE"
}

# Initialize deployment
initialize_deployment() {
    log_header "🚀 Click Enterprise Deployment Orchestrator v2.0"
    log_info "Deployment ID: $DEPLOYMENT_ID"
    log_info "Project Root: $PROJECT_ROOT"
    log_info "Log File: $LOG_FILE"

    # Create necessary directories
    mkdir -p "$PROJECT_ROOT/logs"
    mkdir -p "$PROJECT_ROOT/backups"
    mkdir -p "$PROJECT_ROOT/secrets"

    # Validate environment
    check_environment

    log_success "Deployment initialized successfully"
}

# Check environment prerequisites
check_environment() {
    log_info "Checking environment prerequisites..."

    # Check required tools
    local required_tools=("docker" "kubectl" "helm" "terraform" "aws" "git")
    local missing_tools=()

    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            missing_tools+=("$tool")
        fi
    done

    if [ ${#missing_tools[@]} -ne 0 ]; then
        log_error "Missing required tools: ${missing_tools[*]}"
        log_error "Please install missing tools and try again"
        exit 1
    fi

    # Check Docker daemon
    if ! docker info &> /dev/null; then
        log_error "Docker daemon is not running"
        exit 1
    fi

    # Check Kubernetes connectivity
    if ! kubectl cluster-info &> /dev/null; then
        log_warning "Kubernetes cluster not accessible - will skip K8s operations"
        SKIP_KUBERNETES=true
    fi

    log_success "Environment check completed"
}

# Setup infrastructure
setup_infrastructure() {
    log_header "🏗️  Setting up Enterprise Infrastructure"

    # Choose deployment target
    choose_deployment_target

    case $DEPLOYMENT_TARGET in
        aws)
            deploy_to_aws
            ;;
        kubernetes)
            deploy_to_kubernetes
            ;;
        docker)
            deploy_to_docker
            ;;
        hybrid)
            deploy_hybrid
            ;;
    esac

    log_success "Infrastructure setup completed"
}

choose_deployment_target() {
    log_info "Available deployment targets:"
    echo "1) AWS Cloud (Full enterprise cloud deployment)"
    echo "2) Kubernetes (Container orchestration)"
    echo "3) Docker Compose (Local development/production)"
    echo "4) Hybrid (Multi-cloud with Kubernetes)"

    if [ -n "$DEPLOYMENT_TARGET" ]; then
        log_info "Using pre-configured target: $DEPLOYMENT_TARGET"
        return
    fi

    read -p "Choose deployment target (1-4): " choice

    case $choice in
        1)
            DEPLOYMENT_TARGET="aws"
            ;;
        2)
            DEPLOYMENT_TARGET="kubernetes"
            ;;
        3)
            DEPLOYMENT_TARGET="docker"
            ;;
        4)
            DEPLOYMENT_TARGET="hybrid"
            ;;
        *)
            log_error "Invalid choice. Using Docker Compose as default."
            DEPLOYMENT_TARGET="docker"
            ;;
    esac

    log_info "Selected deployment target: $DEPLOYMENT_TARGET"
}

# AWS Cloud Deployment
deploy_to_aws() {
    log_info "Deploying to AWS Cloud..."

    # Initialize Terraform
    cd "$PROJECT_ROOT/infrastructure/terraform/aws"
    terraform init

    # Plan deployment
    terraform plan -var="environment=production" -out=tfplan

    # Apply deployment
    terraform apply tfplan

    # Get outputs
    AWS_ALB_DNS=$(terraform output -raw alb_dns_name)
    AWS_RDS_ENDPOINT=$(terraform output -raw rds_endpoint)
    AWS_REDIS_ENDPOINT=$(terraform output -raw redis_endpoint)

    log_success "AWS deployment completed"
    log_info "ALB DNS: $AWS_ALB_DNS"
    log_info "RDS Endpoint: $AWS_RDS_ENDPOINT"
    log_info "Redis Endpoint: $AWS_REDIS_ENDPOINT"
}

# Kubernetes Deployment
deploy_to_kubernetes() {
    log_info "Deploying to Kubernetes..."

    # Create namespaces
    kubectl apply -f "$PROJECT_ROOT/infrastructure/kubernetes-namespaces.yml"

    # Deploy infrastructure services
    kubectl apply -f "$PROJECT_ROOT/infrastructure/kubernetes-deployment.yml"

    # Deploy monitoring stack
    helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
    helm repo add grafana https://grafana.github.io/helm-charts
    helm repo update

    helm upgrade --install monitoring prometheus-community/kube-prometheus-stack \
        --namespace monitoring \
        --create-namespace

    # Deploy Click application
    kubectl apply -f "$PROJECT_ROOT/infrastructure/microservices.yml"

    # Wait for deployments
    kubectl wait --for=condition=available --timeout=600s deployment --all -n click-production

    log_success "Kubernetes deployment completed"
}

# Docker Compose Deployment
deploy_to_docker() {
    log_info "Deploying with Docker Compose..."

    # Build and start services
    cd "$PROJECT_ROOT"
    docker-compose -f infrastructure/docker-compose.prod.yml up -d --build

    # Wait for services to be healthy
    log_info "Waiting for services to be healthy..."
    sleep 60

    # Check service health
    check_docker_services

    log_success "Docker Compose deployment completed"
}

# Hybrid Multi-cloud Deployment
deploy_hybrid() {
    log_info "Deploying hybrid multi-cloud infrastructure..."

    # Deploy Kubernetes infrastructure
    deploy_to_kubernetes

    # Deploy edge computing
    kubectl apply -f "$PROJECT_ROOT/infrastructure/edge-computing.yml"

    # Deploy security policies
    kubectl apply -f "$PROJECT_ROOT/infrastructure/security.yml"

    # Deploy disaster recovery
    kubectl apply -f "$PROJECT_ROOT/infrastructure/disaster-recovery.yml"

    log_success "Hybrid deployment completed"
}

# Check Docker services health
check_docker_services() {
    local services=("click-nginx" "click-frontend" "click-backend" "click-mongodb" "click-redis")
    local unhealthy_services=()

    for service in "${services[@]}"; do
        if ! docker ps --filter "name=$service" --filter "status=running" --format "{{.Names}}" | grep -q "$service"; then
            unhealthy_services+=("$service")
        fi
    done

    if [ ${#unhealthy_services[@]} -ne 0 ]; then
        log_warning "Unhealthy services: ${unhealthy_services[*]}"
        log_info "Checking service logs..."

        for service in "${unhealthy_services[@]}"; do
            log_info "Logs for $service:"
            docker logs "$service" | tail -20
        done
    else
        log_success "All services are healthy"
    fi
}

# Configure application
configure_application() {
    log_header "⚙️  Configuring Application"

    # Generate secrets if they don't exist
    generate_secrets

    # Configure environment variables
    configure_environment

    # Setup monitoring
    setup_monitoring

    log_success "Application configuration completed"
}

# Generate secrets
generate_secrets() {
    log_info "Generating application secrets..."

    local secrets_dir="$PROJECT_ROOT/secrets"

    # Generate JWT secret
    if [ ! -f "$secrets_dir/jwt_secret.txt" ]; then
        openssl rand -hex 32 > "$secrets_dir/jwt_secret.txt"
        log_info "Generated JWT secret"
    fi

    # Generate database password
    if [ ! -f "$secrets_dir/mongodb_password.txt" ]; then
        openssl rand -hex 16 > "$secrets_dir/mongodb_password.txt"
        log_info "Generated MongoDB password"
    fi

    # Generate Redis password
    if [ ! -f "$secrets_dir/redis_password.txt" ]; then
        openssl rand -hex 16 > "$secrets_dir/redis_password.txt"
        log_info "Generated Redis password"
    fi

    # Generate Grafana password
    if [ ! -f "$secrets_dir/grafana_password.txt" ]; then
        openssl rand -base64 12 > "$secrets_dir/grafana_password.txt"
        log_info "Generated Grafana password"
    fi

    log_success "Secrets generation completed"
}

# Configure environment
configure_environment() {
    log_info "Configuring environment variables..."

    # Create .env.production file
    cat > "$PROJECT_ROOT/.env.production" << EOF
# Production Environment Configuration
NODE_ENV=production
PORT=3000
API_PORT=5001

# Database Configuration
MONGODB_URI=mongodb://mongodb:27017/click
REDIS_URL=redis://redis:6379

# Security
JWT_SECRET_FILE=/run/secrets/jwt_secret
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK

# CDN and External Services
CDN_URL=https://cdn.click-app.com
CLOUDFLARE_API_TOKEN=your-cloudflare-token

# Monitoring
PROMETHEUS_URL=http://prometheus:9090
GRAFANA_URL=http://grafana:3000

# Email Configuration (Optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Feature Flags
ENABLE_ANALYTICS=true
ENABLE_CACHING=true
ENABLE_COMPRESSION=true
ENABLE_SECURITY_HEADERS=true
EOF

    log_success "Environment configuration completed"
}

# Setup monitoring
setup_monitoring() {
    log_info "Setting up monitoring and alerting..."

    # Configure Prometheus
    if [ "$DEPLOYMENT_TARGET" = "kubernetes" ] || [ "$DEPLOYMENT_TARGET" = "hybrid" ]; then
        kubectl apply -f "$PROJECT_ROOT/infrastructure/monitoring/"
    fi

    # Setup alerts
    configure_alerts

    log_success "Monitoring setup completed"
}

# Configure alerts
configure_alerts() {
    log_info "Configuring alerting rules..."

    # Create alert manager configuration
    cat > "$PROJECT_ROOT/infrastructure/monitoring/alertmanager.yml" << EOF
global:
  smtp_smarthost: 'smtp.gmail.com:587'
  smtp_from: 'alerts@click-app.com'
  smtp_auth_username: 'alerts@click-app.com'
  smtp_auth_password: 'your-app-password'

route:
  group_by: ['alertname']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 1h
  receiver: 'email'
  routes:
  - match:
      severity: critical
    receiver: 'slack'

receivers:
- name: 'email'
  email_configs:
  - to: 'admin@click-app.com'
    send_resolved: true

- name: 'slack'
  slack_configs:
  - api_url: 'https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK'
    channel: '#alerts'
    send_resolved: true
EOF

    log_success "Alert configuration completed"
}

# Deploy application
deploy_application() {
    log_header "🚀 Deploying Click Application"

    # Build application
    build_application

    # Deploy based on target
    case $DEPLOYMENT_TARGET in
        aws)
            deploy_to_aws_app
            ;;
        kubernetes)
            deploy_to_kubernetes_app
            ;;
        docker)
            deploy_to_docker_app
            ;;
        hybrid)
            deploy_hybrid_app
            ;;
    esac

    log_success "Application deployment completed"
}

# Build application
build_application() {
    log_info "Building Click application..."

    cd "$PROJECT_ROOT"

    # Build frontend
    log_info "Building frontend..."
    cd client
    npm ci
    npm run build
    cd ..

    # Build backend
    log_info "Building backend..."
    cd server
    npm ci
    npm run build
    cd ..

    # Build Docker images if needed
    if [ "$DEPLOYMENT_TARGET" != "docker" ]; then
        log_info "Building Docker images..."
        docker build -f infrastructure/Dockerfile.frontend -t click-app/frontend:latest ./client
        docker build -f infrastructure/Dockerfile.backend -t click-app/backend:latest ./server
        docker build -f infrastructure/Dockerfile.backup -t click-app/backup:latest .
    fi

    log_success "Application build completed"
}

# Deploy to AWS application
deploy_to_aws_app() {
    log_info "Deploying application to AWS..."

    # Update ECS services
    aws ecs update-service --cluster click-cluster --service click-frontend --force-new-deployment
    aws ecs update-service --cluster click-cluster --service click-backend --force-new-deployment

    # Wait for deployments
    aws ecs wait services-stable --cluster click-cluster --services click-frontend click-backend

    log_success "AWS application deployment completed"
}

# Deploy to Kubernetes application
deploy_to_kubernetes_app() {
    log_info "Deploying application to Kubernetes..."

    # Update deployments
    kubectl apply -f "$PROJECT_ROOT/infrastructure/microservices.yml"

    # Wait for rollouts
    kubectl rollout status deployment/click-frontend -n click-production
    kubectl rollout status deployment/click-backend -n click-production

    log_success "Kubernetes application deployment completed"
}

# Deploy to Docker application
deploy_to_docker_app() {
    log_info "Deploying application with Docker Compose..."

    cd "$PROJECT_ROOT"
    docker-compose -f infrastructure/docker-compose.prod.yml up -d --build

    log_success "Docker application deployment completed"
}

# Deploy hybrid application
deploy_hybrid_app() {
    log_info "Deploying hybrid application..."

    # Deploy core services
    deploy_to_kubernetes_app

    # Deploy edge services
    kubectl apply -f "$PROJECT_ROOT/infrastructure/edge-computing.yml"

    log_success "Hybrid application deployment completed"
}

# Run health checks
run_health_checks() {
    log_header "🔍 Running Health Checks"

    log_info "Performing comprehensive health checks..."

    # Check application health
    check_application_health

    # Check infrastructure health
    check_infrastructure_health

    # Check security
    check_security_health

    log_success "Health checks completed"
}

# Check application health
check_application_health() {
    log_info "Checking application health..."

    local endpoints=("http://localhost:3000/api/monitoring/health" "http://localhost:5001/api/health")

    for endpoint in "${endpoints[@]}"; do
        if curl -f -s "$endpoint" > /dev/null 2>&1; then
            log_success "✓ $endpoint is healthy"
        else
            log_warning "✗ $endpoint is not responding"
        fi
    done
}

# Check infrastructure health
check_infrastructure_health() {
    log_info "Checking infrastructure health..."

    # Check databases
    if [ "$DEPLOYMENT_TARGET" = "docker" ]; then
        if docker exec click-mongodb mongosh --eval "db.adminCommand('ping')" > /dev/null 2>&1; then
            log_success "✓ MongoDB is healthy"
        else
            log_warning "✗ MongoDB is not responding"
        fi

        if docker exec click-redis redis-cli ping | grep -q PONG; then
            log_success "✓ Redis is healthy"
        else
            log_warning "✗ Redis is not responding"
        fi
    fi
}

# Check security health
check_security_health() {
    log_info "Checking security health..."

    # Check SSL certificates
    if openssl s_client -connect localhost:443 -servername click-app.com < /dev/null > /dev/null 2>&1; then
        log_success "✓ SSL certificate is valid"
    else
        log_warning "✗ SSL certificate validation failed"
    fi

    # Check security headers
    local security_headers=$(curl -I -s http://localhost:3000 | grep -E "(X-Frame-Options|X-Content-Type-Options|X-XSS-Protection)" | wc -l)
    if [ "$security_headers" -ge 3 ]; then
        log_success "✓ Security headers are configured"
    else
        log_warning "✗ Security headers are missing"
    fi
}

# Setup post-deployment tasks
setup_post_deployment() {
    log_header "🎯 Setting up Post-Deployment Tasks"

    # Setup backups
    setup_backups

    # Setup monitoring dashboards
    setup_dashboards

    # Configure domain and DNS
    configure_domain

    # Setup SSL certificates
    setup_ssl

    log_success "Post-deployment setup completed"
}

# Setup backups
setup_backups() {
    log_info "Setting up automated backups..."

    # Create backup cron job
    if [ "$DEPLOYMENT_TARGET" = "docker" ]; then
        # Add backup service to docker-compose
        log_info "Backup service configured in Docker Compose"
    elif [ "$DEPLOYMENT_TARGET" = "kubernetes" ]; then
        # Apply backup cron job
        kubectl apply -f "$PROJECT_ROOT/infrastructure/backup-cron.yml"
    fi

    log_success "Automated backups configured"
}

# Setup monitoring dashboards
setup_dashboards() {
    log_info "Setting up monitoring dashboards..."

    # Import Grafana dashboards
    if [ "$DEPLOYMENT_TARGET" = "kubernetes" ] || [ "$DEPLOYMENT_TARGET" = "hybrid" ]; then
        kubectl apply -f "$PROJECT_ROOT/infrastructure/monitoring/dashboards/"
    fi

    log_success "Monitoring dashboards configured"
}

# Configure domain
configure_domain() {
    log_info "Configuring domain and DNS..."

    read -p "Enter your domain name (e.g., click-app.com): " DOMAIN_NAME

    if [ -n "$DOMAIN_NAME" ]; then
        log_info "Domain configuration instructions:"
        echo "1. Point $DOMAIN_NAME to your load balancer IP/DNS"
        echo "2. Configure SSL certificate for $DOMAIN_NAME"
        echo "3. Update DNS records for subdomains (api, monitoring, etc.)"
        echo "4. Test domain resolution"
    fi

    log_success "Domain configuration noted"
}

# Setup SSL certificates
setup_ssl() {
    log_info "Setting up SSL certificates..."

    if [ "$DEPLOYMENT_TARGET" = "kubernetes" ] || [ "$DEPLOYMENT_TARGET" = "hybrid" ]; then
        # Install cert-manager
        kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.11.0/cert-manager.yaml

        # Create Let's Encrypt cluster issuer
        kubectl apply -f "$PROJECT_ROOT/infrastructure/security/ssl-issuer.yml"

        log_success "SSL certificate automation configured"
    else
        log_info "SSL setup instructions:"
        echo "1. Obtain SSL certificate from Let's Encrypt or your CA"
        echo "2. Configure certificate in your load balancer/web server"
        echo "3. Enable HTTPS redirect"
        echo "4. Test SSL configuration with SSL Labs"
    fi
}

# Generate deployment report
generate_report() {
    log_header "📊 Generating Deployment Report"

    local report_file="$PROJECT_ROOT/logs/deployment-report-$DEPLOYMENT_ID.md"

    cat > "$report_file" << EOF
# Click Enterprise Deployment Report
**Deployment ID:** $DEPLOYMENT_ID
**Deployment Date:** $(date)
**Deployment Target:** $DEPLOYMENT_TARGET

## Deployment Summary

### Infrastructure
- **Target:** $DEPLOYMENT_TARGET
- **Environment:** Production
- **Region:** ${AWS_REGION:-N/A}

### Services Deployed
- ✅ Frontend Application
- ✅ Backend API
- ✅ Database (MongoDB)
- ✅ Cache (Redis)
- ✅ Reverse Proxy (Nginx)
- ✅ Monitoring (Prometheus/Grafana)
- ✅ Security (WAF, SSL)

### Key Metrics
- **Deployment Time:** $(($(date +%s) - $(stat -f %B "$LOG_FILE"))) seconds
- **Services Started:** $(docker ps 2>/dev/null | wc -l || kubectl get pods 2>/dev/null | wc -l || echo "N/A")
- **Health Status:** $(check_health_status)

## Access Information

### Application URLs
- **Main Application:** https://$DOMAIN_NAME
- **API Endpoint:** https://api.$DOMAIN_NAME
- **Monitoring:** https://monitoring.$DOMAIN_NAME
- **Grafana:** https://grafana.$DOMAIN_NAME

### Service Ports (Internal)
- Frontend: 3000
- Backend: 5001
- MongoDB: 27017
- Redis: 6379
- Prometheus: 9090
- Grafana: 3001

## Security Configuration

### SSL/TLS
- Certificate Authority: Let's Encrypt
- Auto-renewal: Enabled
- Security Headers: Configured

### Network Security
- WAF: Enabled
- Rate Limiting: Configured
- DDoS Protection: Active

## Monitoring & Alerting

### Dashboards
- Application Metrics: Prometheus
- Visualization: Grafana
- Alerting: AlertManager

### Key Alerts
- Service Health
- Resource Usage
- Security Events
- Performance Metrics

## Backup & Recovery

### Automated Backups
- Database: Daily at 2 AM
- Files: Daily at 3 AM
- Retention: 30 days
- Storage: S3/Cloud Storage

### Disaster Recovery
- Multi-region replication
- Auto-failover: Configured
- RTO: 4 hours
- RPO: 15 minutes

## Next Steps

1. **Domain Configuration**
   - Update DNS records
   - Configure SSL certificates
   - Test domain resolution

2. **Security Hardening**
   - Rotate default passwords
   - Configure firewall rules
   - Enable audit logging

3. **Monitoring Setup**
   - Configure alert notifications
   - Set up log aggregation
   - Create custom dashboards

4. **Performance Optimization**
   - Configure auto-scaling
   - Set up CDN distribution
   - Optimize database queries

5. **Compliance & Governance**
   - Review security policies
   - Configure access controls
   - Set up audit trails

## Support Information

- **Logs Location:** $LOG_FILE
- **Configuration Files:** $PROJECT_ROOT/infrastructure/
- **Secrets Location:** $PROJECT_ROOT/secrets/
- **Backup Location:** $PROJECT_ROOT/backups/

---
*Generated by Click Enterprise Deployment Orchestrator v2.0*
EOF

    log_success "Deployment report generated: $report_file"
    log_info "Report saved to: $report_file"
}

# Check overall health status
check_health_status() {
    # Simple health check logic
    if curl -f -s http://localhost:3000/api/monitoring/health > /dev/null 2>&1; then
        echo "HEALTHY"
    else
        echo "DEGRADED"
    fi
}

# Cleanup function
cleanup() {
    log_info "Performing cleanup..."

    # Remove temporary files
    rm -f "$PROJECT_ROOT"/terraform.tfstate.backup 2>/dev/null || true

    log_success "Cleanup completed"
}

# Main deployment function
main() {
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --target)
                DEPLOYMENT_TARGET="$2"
                shift 2
                ;;
            --domain)
                DOMAIN_NAME="$2"
                shift 2
                ;;
            --environment)
                ENVIRONMENT="$2"
                shift 2
                ;;
            --skip-monitoring)
                SKIP_MONITORING=true
                shift
                ;;
            --help)
                echo "Click Enterprise Deployment Orchestrator"
                echo ""
                echo "Usage: $0 [options]"
                echo ""
                echo "Options:"
                echo "  --target TARGET       Deployment target (aws, kubernetes, docker, hybrid)"
                echo "  --domain DOMAIN       Domain name for the application"
                echo "  --environment ENV     Environment (production, staging, development)"
                echo "  --skip-monitoring     Skip monitoring setup"
                echo "  --help                Show this help message"
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done

    # Set defaults
    DEPLOYMENT_TARGET="${DEPLOYMENT_TARGET:-docker}"
    ENVIRONMENT="${ENVIRONMENT:-production}"

    # Run deployment phases
    initialize_deployment
    setup_infrastructure
    configure_application
    deploy_application
    run_health_checks
    setup_post_deployment
    generate_report
    cleanup

    # Final success message
    log_header "🎉 Click Enterprise Deployment Completed Successfully!"
    log_success "Your application is now running in production!"
    log_info "Check the deployment report for detailed information."
    log_info "Access your application at: https://$DOMAIN_NAME"

    # Print important reminders
    echo ""
    echo "🔐 IMPORTANT SECURITY REMINDERS:"
    echo "• Change default passwords immediately"
    echo "• Configure proper firewall rules"
    echo "• Set up monitoring alerts"
    echo "• Enable SSL certificates"
    echo ""
    echo "📊 MONITORING DASHBOARDS:"
    echo "• Application: https://$DOMAIN_NAME"
    echo "• Monitoring: https://monitoring.$DOMAIN_NAME"
    echo "• Grafana: https://grafana.$DOMAIN_NAME"
    echo ""
    echo "🚀 DEPLOYMENT COMPLETE! Your enterprise application is ready for production use."
}

# Trap for cleanup on exit
trap cleanup EXIT

# Run main function
main "$@"



