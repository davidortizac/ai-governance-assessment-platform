> **Note:** This is a personal development for Gamma Ingenieros.

# Deployment Guide

## Supported Environments

This platform can be deployed in a variety of environments, including:

- Local machine
- On-premise server
- AWS
- Azure
- GCP
- Kubernetes

## System Requirements

**Minimum:**

- 2 CPU
- 4 GB RAM
- 10 GB disk

**Recommended:**

- 4 CPU
- 8 GB RAM
- 20 GB disk

## Environment Variables

The platform uses environment variables for configuration. Below is an explanation of each:

- `APP_NAME`: The name of the application. Example: `ai-governance-platform`
- `APP_ENV`: The environment where the application is running. Example: `production` or `development`
- `APP_PORT`: The port on which the backend application will listen. Example: `8080`
- `DB_HOST`: Hostname of the database server. Example: `database` or `localhost`
- `DB_PORT`: Port of the database connection. Example: `5432`
- `DB_NAME`: Name of the postgres database. Example: `ai_governance`
- `DB_USER`: Database username. Example: `admin`
- `DB_PASSWORD`: Database password. Example: `password`
- `JWT_SECRET`: Secret key used for signing JWT tokens. Example: `change_this_secret`
- `OPENAI_API_KEY`: API key for OpenAI (if using OpenAI for the LLM). Example: `sk-...`
- `OLLAMA_ENDPOINT`: The URL endpoint for the local Ollama LLM execution. Example: `http://ollama:11434`
- `LLM_MODEL`: The LLM model name to use. Example: `llama3`

## Example .env

Below is a working example configuration:

```env
APP_NAME=ai-governance-platform
APP_ENV=production
APP_PORT=8080

DB_HOST=database
DB_PORT=5432
DB_NAME=ai_governance
DB_USER=admin
DB_PASSWORD=password

JWT_SECRET=change_this_secret

OPENAI_API_KEY=
OLLAMA_ENDPOINT=http://ollama:11434
LLM_MODEL=llama3
```

## Docker Deployment

To deploy using Docker and Docker Compose, execute the following commands in the root of the repository:

```bash
docker-compose build
docker-compose up -d
docker-compose logs -f
```

## Kubernetes Deployment

An example of deploying to Kubernetes logic:

1. Create a secret for environment variables.
2. Apply the deployment manifests:

```bash
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
```

## Cloud Deployment

A standard reference architecture for Cloud Deployment consists of:

- **Load Balancer:** Distributes incoming traffic across application containers.
- **Application Container:** Runs the Node.js/Express backend API and serves the frontend. Managed via ECS, AKS, or Google Cloud Run.
- **Database:** A managed database instance like Amazon RDS Postgres, Azure Database for PostgreSQL, or Cloud SQL.
