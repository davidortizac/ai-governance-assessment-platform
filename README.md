# AI Governance & Security Maturity Assessment Platform

Plataforma SaaS multi-tenant para evaluar el nivel de madurez en adopción y seguridad de IA en organizaciones.

![Stack](https://img.shields.io/badge/React-TypeScript-blue) ![Backend](https://img.shields.io/badge/Node.js-Express-green) ![DB](https://img.shields.io/badge/PostgreSQL-Prisma-purple) ![Docker](https://img.shields.io/badge/Docker-Compose-blue)

## 🚀 Inicio Rápido

### Opción 1: Docker Compose (recomendada)

```bash
# Clonar y navegar al proyecto
cd "ASESSMENT IA"

# Levantar todos los servicios
docker-compose up --build

# Frontend: http://localhost:3000
# Backend:  http://localhost:4000
# DB:       localhost:5433
```

### Opción 2: Desarrollo Local

**Requisitos:** Node.js 20+, PostgreSQL

```bash
# 1. Instalar dependencias
cd backend && npm install && cd ../frontend && npm install && cd ..

# 2. Configurar base de datos
# Crear una base de datos PostgreSQL llamada 'ai_governance'
# Ajustar DATABASE_URL en backend/.env si es necesario

# 3. Migrar y sembrar base de datos
cd backend
cp ../.env.example .env
npx prisma migrate dev --name init
npx prisma db seed
cd ..

# 4. Iniciar backend
cd backend && npm run dev

# 5. En otra terminal, iniciar frontend
cd frontend && npm run dev
```

## 🔐 Credenciales por Defecto

| Rol         | Email                       | Contraseña |
| ----------- | --------------------------- | ---------- |
| Admin       | admin@aigovernance.com      | admin123   |
| Consultor   | consultor@aigovernance.com  | admin123   |

## 📊 Funcionalidades

- **Autenticación JWT** con roles (Admin, Consultor, Cliente)
- **CRUD de clientes** con búsqueda y filtros
- **Evaluaciones Express** (~20 min) y **Advanced** (~90 min)
- **6 Pilares de evaluación:**
  1. Estrategia y Gobierno
  2. Uso por Empleados
  3. Desarrollo de IA
  4. Agentes e Integraciones
  5. Infraestructura
  6. IA para Seguridad
- **Escala 0–4** con opción "No aplica"
- **Motor de scoring ponderado** configurable por pilar
- **Clasificación automática:**
  - Nivel de Madurez (1–5): Experimental → Optimizado
  - Nivel de Riesgo: Controlado → Crítico
- **Dashboard** con radar chart por pilar
- **Comparación** lado a lado de evaluaciones
- **Generación de PDF** ejecutivo con recomendaciones
- **Guardado histórico** de evaluaciones

## 🏗 Arquitectura

```
├── backend/             # Node.js + Express + TypeScript
│   ├── prisma/          # Schema + migraciones + seed
│   ├── src/
│   │   ├── middleware/  # Auth JWT
│   │   ├── routes/      # API REST
│   │   ├── services/    # Scoring + PDF
│   │   └── lib/         # Prisma client
│   └── Dockerfile
├── frontend/            # React + TypeScript + TailwindCSS
│   ├── src/
│   │   ├── components/  # Layout, RadarChart
│   │   ├── context/     # AuthContext
│   │   ├── pages/       # Login, Dashboard, Clients, etc.
│   │   └── lib/         # API client
│   └── Dockerfile
├── docker-compose.yml
└── README.md
```

## 📈 Lógica de Scoring

**Maturity Levels:**
| Rango     | Nivel | Etiqueta      |
| --------- | ----- | ------------- |
| 0 – 0.9   | 1     | Experimental  |
| 1.0 – 1.9 | 2     | Emergente     |
| 2.0 – 2.9 | 3     | Definido      |
| 3.0 – 3.5 | 4     | Gestionado    |
| 3.6 – 4.0 | 5     | Optimizado    |

**Risk Classification:**
| Condición                           | Riesgo      |
| ----------------------------------- | ----------- |
| Alta adopción + baja gobernanza     | Crítico     |
| Alta adopción + seguridad media     | Alto        |
| Baja adopción + baja gobernanza     | Latente     |
| Alta adopción + alta seguridad      | Controlado  |
