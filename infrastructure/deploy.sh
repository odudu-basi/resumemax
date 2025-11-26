#!/bin/bash

# ResumeMax Browser Service - Deployment Script
# This script deploys the browser automation service to AWS ECS

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
AWS_REGION="${AWS_REGION:-us-east-1}"
AWS_ACCOUNT_ID="${AWS_ACCOUNT_ID}"
ECR_REPO_NAME="resumemax-browser-service"
STACK_NAME="resumemax-browser-service"
ENVIRONMENT="${ENVIRONMENT:-production}"

# Check prerequisites
echo -e "${YELLOW}Checking prerequisites...${NC}"

if ! command -v aws &> /dev/null; then
    echo -e "${RED}AWS CLI not found. Please install it first.${NC}"
    exit 1
fi

if ! command -v docker &> /dev/null; then
    echo -e "${RED}Docker not found. Please install it first.${NC}"
    exit 1
fi

if [ -z "$AWS_ACCOUNT_ID" ]; then
    echo -e "${YELLOW}AWS_ACCOUNT_ID not set. Detecting...${NC}"
    AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    echo -e "${GREEN}Using AWS Account: $AWS_ACCOUNT_ID${NC}"
fi

# Step 1: Create ECR repository if it doesn't exist
echo -e "${YELLOW}Step 1: Setting up ECR repository...${NC}"

if ! aws ecr describe-repositories --repository-names $ECR_REPO_NAME --region $AWS_REGION &> /dev/null; then
    echo -e "${YELLOW}Creating ECR repository: $ECR_REPO_NAME${NC}"
    aws ecr create-repository \
        --repository-name $ECR_REPO_NAME \
        --region $AWS_REGION \
        --image-scanning-configuration scanOnPush=true
    echo -e "${GREEN}ECR repository created${NC}"
else
    echo -e "${GREEN}ECR repository already exists${NC}"
fi

# Step 2: Build and push Docker image
echo -e "${YELLOW}Step 2: Building and pushing Docker image...${NC}"

ECR_URI="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO_NAME"
IMAGE_TAG="latest"

# Login to ECR
echo -e "${YELLOW}Logging in to ECR...${NC}"
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_URI

# Build image
echo -e "${YELLOW}Building Docker image...${NC}"
cd ../browser-service
docker build -t $ECR_REPO_NAME:$IMAGE_TAG .

# Tag and push
echo -e "${YELLOW}Tagging and pushing image...${NC}"
docker tag $ECR_REPO_NAME:$IMAGE_TAG $ECR_URI:$IMAGE_TAG
docker tag $ECR_REPO_NAME:$IMAGE_TAG $ECR_URI:$(date +%Y%m%d-%H%M%S)
docker push $ECR_URI:$IMAGE_TAG
docker push $ECR_URI:$(date +%Y%m%d-%H%M%S)

echo -e "${GREEN}Docker image pushed successfully${NC}"

cd ../infrastructure

# Step 3: Create secrets in Secrets Manager
echo -e "${YELLOW}Step 3: Setting up secrets (if not exists)...${NC}"

create_secret_if_not_exists() {
    local secret_name=$1
    local secret_description=$2

    if ! aws secretsmanager describe-secret --secret-id $secret_name --region $AWS_REGION &> /dev/null; then
        echo -e "${YELLOW}Creating secret: $secret_name${NC}"
        read -sp "Enter value for $secret_name: " secret_value
        echo
        aws secretsmanager create-secret \
            --name $secret_name \
            --description "$secret_description" \
            --secret-string "$secret_value" \
            --region $AWS_REGION
        echo -e "${GREEN}Secret created${NC}"
    else
        echo -e "${GREEN}Secret $secret_name already exists${NC}"
    fi
}

create_secret_if_not_exists "resumemax/browser-service/api-key" "Internal API key for browser service"
create_secret_if_not_exists "resumemax/openai-api-key" "OpenAI API key"
create_secret_if_not_exists "resumemax/anthropic-api-key" "Anthropic API key"
create_secret_if_not_exists "resumemax/sentry-dsn" "Sentry DSN for error tracking"

# Step 4: Deploy CloudFormation stack
echo -e "${YELLOW}Step 4: Deploying CloudFormation stack...${NC}"

# Get VPC and subnet information
echo -e "${YELLOW}Please provide VPC and subnet information:${NC}"
read -p "VPC ID: " VPC_ID
read -p "Private Subnet IDs (comma-separated): " PRIVATE_SUBNET_IDS
read -p "Public Subnet IDs (comma-separated): " PUBLIC_SUBNET_IDS

aws cloudformation deploy \
    --template-file cloudformation-template.yml \
    --stack-name $STACK_NAME \
    --parameter-overrides \
        Environment=$ENVIRONMENT \
        VpcId=$VPC_ID \
        SubnetIds=$PRIVATE_SUBNET_IDS \
        PublicSubnetIds=$PUBLIC_SUBNET_IDS \
        DockerImage=$ECR_URI:$IMAGE_TAG \
        DesiredCount=2 \
        WorkerDesiredCount=3 \
    --capabilities CAPABILITY_IAM \
    --region $AWS_REGION

# Step 5: Get outputs
echo -e "${YELLOW}Step 5: Retrieving stack outputs...${NC}"

LOAD_BALANCER_DNS=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --region $AWS_REGION \
    --query 'Stacks[0].Outputs[?OutputKey==`LoadBalancerDNS`].OutputValue' \
    --output text)

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "Browser Service URL: http://$LOAD_BALANCER_DNS"
echo -e ""
echo -e "Next steps:"
echo -e "1. Update your Next.js .env with:"
echo -e "   BROWSER_SERVICE_URL=http://$LOAD_BALANCER_DNS"
echo -e "   BROWSER_SERVICE_API_KEY=<your-api-key>"
echo -e ""
echo -e "2. Test the service:"
echo -e "   curl http://$LOAD_BALANCER_DNS/health"
echo -e ""
echo -e "3. Monitor logs:"
echo -e "   aws logs tail /ecs/resumemax-browser-service --follow --region $AWS_REGION"
echo -e "${GREEN}========================================${NC}"
