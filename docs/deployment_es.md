> **Nota:** Este es un desarrollo personal para Gamma Ingenieros.

# Guía de Despliegue

## Entornos Soportados

Esta plataforma puede desplegarse en diversos entornos, incluyendo:

- Máquina local (Local machine)
- Servidor local corporativo (On-premise server)
- AWS
- Azure
- GCP
- Kubernetes

## Requisitos del Sistema

**Mínimo:**

- 2 CPU
- 4 GB RAM
- 10 GB disco

**Recomendado:**

- 4 CPU
- 8 GB RAM
- 20 GB disco

## Variables de Entorno

La plataforma utiliza variables para su configuración. Explicación de cada variable:

- `APP_NAME`: Nombre de la aplicación. Ejemplo: `ai-governance-platform`
- `APP_ENV`: Entorno de ejecución de la aplicación. Ejemplo: `production`
- `APP_PORT`: Puerto donde escucha la aplicación backend. Ejemplo: `8080`
- `DB_HOST`: Nombre de host del servidor de base de datos. Ejemplo: `database`
- `DB_PORT`: Puerto de conexión a la base de datos. Ejemplo: `5432`
- `DB_NAME`: Nombre de la base de datos. Ejemplo: `ai_governance`
- `DB_USER`: Usuario de la base de datos. Ejemplo: `admin`
- `DB_PASSWORD`: Contraseña de la base de datos. Ejemplo: `password`
- `JWT_SECRET`: Clave secreta para firmar tokens JWT. Ejemplo: `change_this_secret`
- `OPENAI_API_KEY`: Clave API para OpenAI (opcional).
- `OLLAMA_ENDPOINT`: URL del servidor local de Ollama. Ejemplo: `http://ollama:11434`
- `LLM_MODEL`: Nombre del modelo a usar. Ejemplo: `llama3`

## Ejemplo de .env

Archivo .env de ejemplo listo para usar:

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

## Implementación con Docker

Para desplegar utilizando Docker y Docker Compose, ejecute los siguientes comandos en la raíz del repositorio:

```bash
docker-compose build
docker-compose up -d
docker-compose logs -f
```

## Implementación en Kubernetes

Ejemplo de instrucciones de despliegue con `kubectl`:

1. Crear un secret para variables de entorno.
2. Aplicar los manifiestos:

```bash
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
```

## Implementación en la Nube

Arquitectura de referencia para Cloud Deployment:

- **Balanceador de Carga:** Distribuye el tráfico hacia los contenedores de la aplicación.
- **Contenedor de Aplicación:** Aloja el Backend (Node.js/Express) y sirve el Frontend. Administrado vía ECS, AKS o Google Cloud Run.
- **Base de Datos:** Instancia de base de datos administrada, como AWS RDS Postgres, Azure Database for PostgreSQL o Cloud SQL.
