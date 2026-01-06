#!/bin/bash

# Advanced Cloud Deployment Script for Click
# Supports AWS, GCP, Azure, and DigitalOcean

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENVIRONMENT="${ENVIRONMENT:-production}"
CLOUD_PROVIDER="${CLOUD_PROVIDER:-aws}"
REGION="${REGION:-us-east-1}"
CLUSTER_NAME="${CLUSTER_NAME:-click-prod}"
DOMAIN="${DOMAIN:-click-app.com}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    # Check if required tools are installed
    local tools=("docker" "kubectl" "helm" "terraform")

    case $CLOUD_PROVIDER in
        aws)
            tools+=("aws")
            ;;
        gcp)
            tools+=("gcloud")
            ;;
        azure)
            tools+=("az")
            ;;
        digitalocean)
            tools+=("doctl")
            ;;
    esac

    for tool in "${tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            log_error "$tool is not installed. Please install it first."
            exit 1
        fi
    done

    log_success "Prerequisites check passed"
}

# Authenticate with cloud provider
authenticate_cloud() {
    log_info "Authenticating with $CLOUD_PROVIDER..."

    case $CLOUD_PROVIDER in
        aws)
            if ! aws sts get-caller-identity &> /dev/null; then
                log_error "AWS credentials not configured. Run 'aws configure' first."
                exit 1
            fi
            aws configure set region "$REGION"
            ;;

        gcp)
            if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
                log_error "GCP credentials not configured. Run 'gcloud auth login' first."
                exit 1
            fi
            gcloud config set project "$(gcloud config get-value project)"
            gcloud config set compute/region "$REGION"
            ;;

        azure)
            if ! az account show &> /dev/null; then
                log_error "Azure credentials not configured. Run 'az login' first."
                exit 1
            fi
            ;;

        digitalocean)
            if ! doctl auth init --context "$CLUSTER_NAME" 2>/dev/null; then
                log_error "DigitalOcean credentials not configured. Run 'doctl auth init' first."
                exit 1
            fi
            ;;
    esac

    log_success "Authentication successful"
}

# Setup infrastructure
setup_infrastructure() {
    log_info "Setting up infrastructure on $CLOUD_PROVIDER..."

    case $CLOUD_PROVIDER in
        aws)
            setup_aws_infrastructure
            ;;
        gcp)
            setup_gcp_infrastructure
            ;;
        azure)
            setup_azure_infrastructure
            ;;
        digitalocean)
            setup_digitalocean_infrastructure
            ;;
    esac

    log_success "Infrastructure setup completed"
}

setup_aws_infrastructure() {
    log_info "Setting up AWS infrastructure..."

    # Create S3 bucket for Terraform state
    local bucket_name="click-terraform-state-${ENVIRONMENT}-$(date +%s)"
    aws s3 mb "s3://$bucket_name" --region "$REGION"

    # Initialize Terraform
    cd "$PROJECT_ROOT/infrastructure/terraform/aws"
    terraform init -backend-config="bucket=$bucket_name"

    # Apply infrastructure
    terraform plan -var="environment=$ENVIRONMENT" -var="domain=$DOMAIN"
    terraform apply -auto-approve -var="environment=$ENVIRONMENT" -var="domain=$DOMAIN"

    # Get outputs
    KUBECONFIG=$(terraform output kubeconfig)
    CLUSTER_ENDPOINT=$(terraform output cluster_endpoint)
}

setup_gcp_infrastructure() {
    log_info "Setting up GCP infrastructure..."

    # Enable required APIs
    gcloud services enable container.googleapis.com
    gcloud services enable compute.googleapis.com
    gcloud services enable sqladmin.googleapis.com

    # Create GKE cluster
    gcloud container clusters create "$CLUSTER_NAME" \
        --region="$REGION" \
        --num-nodes=3 \
        --machine-type=e2-standard-2 \
        --enable-autoscaling \
        --min-nodes=1 \
        --max-nodes=10

    # Get cluster credentials
    gcloud container clusters get-credentials "$CLUSTER_NAME" --region="$REGION"
}

setup_azure_infrastructure() {
    log_info "Setting up Azure infrastructure..."

    # Create resource group
    local rg_name="click-${ENVIRONMENT}-rg"
    az group create --name "$rg_name" --location "$REGION"

    # Create AKS cluster
    az aks create \
        --resource-group "$rg_name" \
        --name "$CLUSTER_NAME" \
        --node-count 3 \
        --enable-addons monitoring \
        --generate-ssh-keys \
        --enable-cluster-autoscaler \
        --min-count 1 \
        --max-count 10

    # Get cluster credentials
    az aks get-credentials --resource-group "$rg_name" --name "$CLUSTER_NAME"
}

setup_digitalocean_infrastructure() {
    log_info "Setting up DigitalOcean infrastructure..."

    # Create Kubernetes cluster
    doctl kubernetes cluster create "$CLUSTER_NAME" \
        --region "$REGION" \
        --version 1.25.4-do.0 \
        --node-pool "name=worker-pool;size=s-2vcpu-4gb;count=3;min-nodes=1;max-nodes=10"

    # Get cluster credentials
    doctl kubernetes cluster kubeconfig save "$CLUSTER_NAME"
}

# Build and push container images
build_and_push_images() {
    log_info "Building and pushing container images..."

    # Login to container registry
    case $CLOUD_PROVIDER in
        aws)
            aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "$(aws sts get-caller-identity --query Account --output text).dkr.ecr.$REGION.amazonaws.com"
            REGISTRY="$(aws sts get-caller-identity --query Account --output text).dkr.ecr.$REGION.amazonaws.com"
            ;;

        gcp)
            gcloud auth configure-docker
            REGISTRY="gcr.io/$(gcloud config get-value project)"
            ;;

        azure)
            az acr login --name "click${ENVIRONMENT}acr"
            REGISTRY="click${ENVIRONMENT}acr.azurecr.io"
            ;;

        digitalocean)
            doctl registry login
            REGISTRY="registry.digitalocean.com/click-registry"
            ;;
    esac

    # Build and push images
    local services=("frontend" "backend" "backup")
    local version="$(git rev-parse --short HEAD 2>/dev/null || echo 'latest')"

    for service in "${services[@]}"; do
        log_info "Building $service image..."
        docker build -f "$PROJECT_ROOT/infrastructure/Dockerfile.$service" \
                     -t "$REGISTRY/click-$service:$version" \
                     -t "$REGISTRY/click-$service:latest" \
                     "$PROJECT_ROOT"

        log_info "Pushing $service image..."
        docker push "$REGISTRY/click-$service:$version"
        docker push "$REGISTRY/click-$service:latest"
    done

    log_success "Container images built and pushed"
}

# Deploy to Kubernetes
deploy_to_kubernetes() {
    log_info "Deploying to Kubernetes..."

    # Create namespace
    kubectl create namespace click-production --dry-run=client -o yaml | kubectl apply -f -

    # Create secrets
    create_kubernetes_secrets

    # Deploy infrastructure services
    kubectl apply -f "$PROJECT_ROOT/infrastructure/kubernetes-deployment.yml"

    # Deploy monitoring stack
    helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
    helm repo add grafana https://grafana.github.io/helm-charts
    helm repo update

    # Install Prometheus
    helm upgrade --install prometheus prometheus-community/prometheus \
        --namespace monitoring \
        --create-namespace \
        --set server.persistentVolume.enabled=true

    # Install Grafana
    helm upgrade --install grafana grafana/grafana \
        --namespace monitoring \
        --set adminPassword='admin' \
        --set service.type=ClusterIP

    log_success "Kubernetes deployment completed"
}

create_kubernetes_secrets() {
    log_info "Creating Kubernetes secrets..."

    # Create secrets from files if they exist
    local secrets_dir="$PROJECT_ROOT/secrets"

    if [ -f "$secrets_dir/jwt_secret.txt" ]; then
        kubectl create secret generic click-secrets \
            --from-file=jwt_secret="$secrets_dir/jwt_secret.txt" \
            --from-file=slack_webhook="$secrets_dir/slack_webhook.txt" \
            --from-file=mongodb_password="$secrets_dir/mongodb_password.txt" \
            --dry-run=client -o yaml | kubectl apply -f -
    else
        log_warning "Secrets files not found. Please create them manually."
    fi
}

# Setup DNS and SSL
setup_dns_and_ssl() {
    log_info "Setting up DNS and SSL certificates..."

    case $CLOUD_PROVIDER in
        aws)
            setup_aws_dns_ssl
            ;;
        gcp)
            setup_gcp_dns_ssl
            ;;
        azure)
            setup_azure_dns_ssl
            ;;
        digitalocean)
            setup_digitalocean_dns_ssl
            ;;
    esac

    log_success "DNS and SSL setup completed"
}

setup_aws_dns_ssl() {
    # Create SSL certificate
    local cert_arn=$(aws acm request-certificate \
        --domain-name "$DOMAIN" \
        --validation-method DNS \
        --query 'CertificateArn' \
        --output text)

    log_info "SSL Certificate ARN: $cert_arn"

    # Get DNS validation records
    aws acm describe-certificate --certificate-arn "$cert_arn" \
        --query 'Certificate.DomainValidationOptions[0].ResourceRecord'

    # Create Route 53 hosted zone if it doesn't exist
    local hosted_zone_id=$(aws route53 list-hosted-zones \
        --query "HostedZones[?Name=='$DOMAIN.'].Id" \
        --output text)

    if [ -z "$hosted_zone_id" ]; then
        hosted_zone_id=$(aws route53 create-hosted-zone \
            --name "$DOMAIN" \
            --caller-reference "$(date +%s)" \
            --query 'HostedZone.Id' \
            --output text)
    fi

    log_info "Route 53 Hosted Zone ID: $hosted_zone_id"
}

setup_gcp_dns_ssl() {
    # SSL certificates are automatically managed by GKE ingress
    log_info "GCP SSL certificates managed automatically by ingress"
}

setup_azure_dns_ssl() {
    # Create Azure DNS zone
    az network dns zone create --resource-group "click-${ENVIRONMENT}-rg" --name "$DOMAIN"
}

setup_digitalocean_dns_ssl() {
    # SSL certificates are automatically managed by DigitalOcean load balancer
    log_info "DigitalOcean SSL certificates managed automatically"
}

# Setup monitoring and alerting
setup_monitoring() {
    log_info "Setting up monitoring and alerting..."

    # Deploy monitoring stack
    kubectl apply -f "$PROJECT_ROOT/infrastructure/monitoring/"

    # Setup alerts
    setup_alerting

    log_success "Monitoring setup completed"
}

setup_alerting() {
    log_info "Setting up alerting..."

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

    # Apply alert manager configuration
    kubectl create secret generic alertmanager-config \
        --from-file=alertmanager.yml="$PROJECT_ROOT/infrastructure/monitoring/alertmanager.yml" \
        --namespace monitoring \
        --dry-run=client -o yaml | kubectl apply -f -
}

# Setup CI/CD pipeline
setup_cicd() {
    log_info "Setting up CI/CD pipeline..."

    case $CLOUD_PROVIDER in
        aws)
            setup_aws_cicd
            ;;
        gcp)
            setup_gcp_cicd
            ;;
        azure)
            setup_azure_cicd
            ;;
        digitalocean)
            setup_digitalocean_cicd
            ;;
    esac

    log_success "CI/CD pipeline setup completed"
}

setup_aws_cicd() {
    # Create CodeBuild project
    aws codebuild create-project \
        --name "click-build-${ENVIRONMENT}" \
        --source "{\"type\": \"GITHUB\", \"location\": \"https://github.com/your-org/click.git\"}" \
        --artifacts "{\"type\": \"NO_ARTIFACTS\"}" \
        --environment "{\"type\": \"LINUX_CONTAINER\", \"image\": \"aws/codebuild/amazonlinux2-x86_64-standard:3.0\", \"computeType\": \"BUILD_GENERAL1_SMALL\"}" \
        --service-role "$(aws iam get-role --role-name CodeBuildServiceRole --query 'Role.Arn' --output text)"
}

setup_gcp_cicd() {
    # Create Cloud Build trigger
    gcloud builds triggers create github \
        --name="click-deploy-${ENVIRONMENT}" \
        --repo-name="click" \
        --repo-owner="your-org" \
        --branch-pattern="main" \
        --build-config="cloudbuild.yaml"
}

setup_azure_cicd() {
    # Create Azure DevOps pipeline
    az pipelines create \
        --name "click-deploy-${ENVIRONMENT}" \
        --repository "https://github.com/your-org/click" \
        --branch main \
        --repository-type github \
        --yaml-path "azure-pipelines.yml"
}

setup_digitalocean_cicd() {
    # DigitalOcean doesn't have built-in CI/CD, use GitHub Actions
    log_info "Using GitHub Actions for CI/CD on DigitalOcean"
}

# Main deployment function
main() {
    log_info "Starting Click Cloud Deployment to $CLOUD_PROVIDER"
    log_info "Environment: $ENVIRONMENT"
    log_info "Region: $REGION"
    log_info "Cluster: $CLUSTER_NAME"
    log_info "Domain: $DOMAIN"

    check_prerequisites
    authenticate_cloud
    setup_infrastructure
    build_and_push_images
    deploy_to_kubernetes
    setup_dns_and_ssl
    setup_monitoring
    setup_cicd

    log_success "🎉 Click has been successfully deployed to $CLOUD_PROVIDER!"
    log_info "🌐 Application URL: https://$DOMAIN"
    log_info "📊 Monitoring URL: https://monitoring.$DOMAIN"
    log_info "📈 Grafana URL: https://grafana.$DOMAIN"
    log_info "🔍 Kibana URL: https://kibana.$DOMAIN"

    # Print next steps
    cat << EOF

📋 Next Steps:
1. Update your DNS records to point to the load balancer
2. Configure SSL certificates (if not automatic)
3. Set up database backups and monitoring
4. Configure alerting notifications
5. Test the application thoroughly
6. Set up automated scaling policies
7. Implement disaster recovery procedures

🔧 Useful Commands:
• Check cluster status: kubectl get nodes
• View pods: kubectl get pods -n click-production
• View services: kubectl get services -n click-production
• Check logs: kubectl logs -f deployment/click-frontend -n click-production
• Scale deployment: kubectl scale deployment click-frontend --replicas=5 -n click-production

🚀 Deployment completed successfully!
EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --provider)
            CLOUD_PROVIDER="$2"
            shift 2
            ;;
        --environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        --region)
            REGION="$2"
            shift 2
            ;;
        --domain)
            DOMAIN="$2"
            shift 2
            ;;
        --help)
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --provider     Cloud provider (aws, gcp, azure, digitalocean) [default: aws]"
            echo "  --environment  Environment (development, staging, production) [default: production]"
            echo "  --region       Cloud region [default: us-east-1]"
            echo "  --domain       Domain name [default: click-app.com]"
            echo "  --help         Show this help message"
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Run main deployment
main "$@"



