<#
.SYNOPSIS
    BioCloud Workbench - Push Docker Containers to Amazon ECR (eu-north-1)
.DESCRIPTION
    Builds and pushes the 4 core containers (backend, frontend, worker-ecg, worker-protein)
    to Amazon Elastic Container Registry (ECR) in Stockholm (eu-north-1).
#>

[CmdletBinding()]
param(
    [string]$Region = "eu-north-1",
    [string]$ProjectName = "biocloud-workbench",
    [switch]$DryRun
)

Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host "  BioCloud Workbench: Push to Amazon ECR ($Region)" -ForegroundColor Cyan
Write-Host "=======================================================" -ForegroundColor Cyan

# 1. Check if AWS credentials exist in environment
if (-not $env:AWS_ACCESS_KEY_ID -or -not $env:AWS_SECRET_ACCESS_KEY) {
    Write-Host "`n[!] AWS credentials not detected in environment variables." -ForegroundColor Yellow
    Write-Host "To authenticate, execute the following commands in this terminal session:" -ForegroundColor Gray
    Write-Host "  `$env:AWS_ACCESS_KEY_ID = 'YOUR_ACCESS_KEY_ID'" -ForegroundColor White
    Write-Host "  `$env:AWS_SECRET_ACCESS_KEY = 'YOUR_SECRET_ACCESS_KEY'" -ForegroundColor White
    Write-Host "  `$env:AWS_DEFAULT_REGION = '$Region'" -ForegroundColor White
    Write-Host "`nObtain credentials from AWS Console:" -ForegroundColor Gray
    Write-Host "  https://$Region.console.aws.amazon.com/iam/home?region=$Region#/users`n" -ForegroundColor Cyan
    exit 1
}

# 2. Get AWS Account ID using Python/Boto3
$AccountId = python -c "import boto3; print(boto3.client('sts', region_name='$Region').get_caller_identity()['Account'])" 2>$null
if (-not $AccountId) {
    Write-Host "[ERROR] Could not resolve AWS Account ID. Please verify your credentials." -ForegroundColor Red
    exit 1
}

$Registry = "$AccountId.dkr.ecr.$Region.amazonaws.com"
Write-Host "[*] Target AWS Account ID: $AccountId" -ForegroundColor Green
Write-Host "[*] Target ECR Registry : $Registry`n" -ForegroundColor Green

# 3. Authenticate Docker with Amazon ECR
Write-Host "[*] Logging into Amazon ECR..." -ForegroundColor Yellow
python -c "
import boto3, base64, subprocess
ecr = boto3.client('ecr', region_name='$Region')
token = ecr.get_authorization_token()['authorizationData'][0]['authorizationToken']
endpoint = ecr.get_authorization_token()['authorizationData'][0]['proxyEndpoint']
u, p = base64.b64decode(token).decode('utf-8').split(':')
subprocess.run(['docker', 'login', '--username', u, '--password-stdin', endpoint], input=p, text=True, check=True)
"

# 4. Define images
$Images = @(
    @{ Name = "backend"; Dockerfile = "Dockerfile.backend"; Repo = "$ProjectName-backend" },
    @{ Name = "frontend"; Dockerfile = "Dockerfile.frontend"; Repo = "$ProjectName-frontend" },
    @{ Name = "worker-ecg"; Dockerfile = "Dockerfile.worker-ecg"; Repo = "$ProjectName-worker-ecg" },
    @{ Name = "worker-protein"; Dockerfile = "Dockerfile.worker-protein"; Repo = "$ProjectName-worker-protein" }
)

# 5. Build, Tag, and Push
foreach ($img in $Images) {
    $RemoteTag = "$Registry/$($img.Repo):latest"
    Write-Host "`n[*] Building: $($img.Name) ($($img.Dockerfile))..." -ForegroundColor Cyan
    
    if ($DryRun) {
        Write-Host "  [DRY RUN] docker build -t $RemoteTag -f $($img.Dockerfile) ." -ForegroundColor Gray
        Write-Host "  [DRY RUN] docker push $RemoteTag" -ForegroundColor Gray
        continue
    }

    # Ensure repository exists
    python -c "
import boto3
ecr = boto3.client('ecr', region_name='$Region')
try:
    ecr.describe_repositories(repositoryNames=['$($img.Repo)'])
except:
    ecr.create_repository(repositoryName='$($img.Repo)', imageScanningConfiguration={'scanOnPush': True})
"

    # Docker Build
    docker build -t $RemoteTag -f $($img.Dockerfile) .
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Docker build failed for $($img.Name)" -ForegroundColor Red
        exit 1
    }

    # Docker Push
    Write-Host "[*] Pushing to ECR: $RemoteTag..." -ForegroundColor Yellow
    docker push $RemoteTag
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Docker push failed for $($img.Name)" -ForegroundColor Red
        exit 1
    }
    Write-Host "[PASS] Successfully pushed: $RemoteTag" -ForegroundColor Green
}

Write-Host "`n=======================================================" -ForegroundColor Green
Write-Host "  All Container Images Pushed to Amazon ECR ($Region)" -ForegroundColor Green
Write-Host "=======================================================" -ForegroundColor Green
Write-Host "View in AWS Console:" -ForegroundColor Gray
Write-Host "  https://$Region.console.aws.amazon.com/ecr/repositories?region=$Region`n" -ForegroundColor Cyan
