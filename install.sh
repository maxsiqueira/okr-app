#!/bin/bash
set -e

echo "🚀 Ion Dashboard Installer"
echo "=========================="

# 1. Check/Create Kind Cluster
CLUSTER_NAME="ion-cluster"
if ! kind get clusters | grep -q "^$CLUSTER_NAME$"; then
    echo "📦 Creating Kind cluster '$CLUSTER_NAME'..."
    kind create cluster --name $CLUSTER_NAME
else
    echo "✅ Kind cluster '$CLUSTER_NAME' already exists."
fi

# 2. Build Docker Image
echo "🏗️  Building Docker Image..."
docker build -t ion-dashboard:latest .

# 3. Load Image into Kind
echo "🚚 Loading image into Kind..."
kind load docker-image ion-dashboard:latest --name $CLUSTER_NAME

# 4. Apply Manifests
echo "apply k8s configuration..."
kubectl config use-context kind-$CLUSTER_NAME
kubectl apply -f k8s/

echo "waiting for rollout..."
kubectl rollout status deployment/ion-dashboard

echo "=========================="
echo "🎉 Deployment Complete!"
echo "🌍 Access the dashboard at: http://localhost:30090"
