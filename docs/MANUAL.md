# Manual de Despliegue y Uso - AI Governance Platform

## 1. Despliegue con Docker

### Prerrequisitos
- Docker Engine y Docker Compose instalados.
- Git instalado.
- Cuenta de Google Cloud (para OAuth).

### Pasos de Despliegue

1.  **Clonar el repositorio:**
    ```bash
    git clone <URL_DEL_REPOSITORIO>
    cd ai-governance-platform
    ```

2.  **Configurar Variables de Entorno:**
    Crea un archivo `.env` en la raíz (basado en `.env.example`) o configura las variables en `docker-compose.yml`.
    
    Variables críticas:
    - `GOOGLE_CLIENT_ID`: ID de cliente de Google (Backend)
    - `VITE_GOOGLE_CLIENT_ID`: ID de cliente de Google (Frontend)
    - `JWT_SECRET`: Secreto para firmar tokens
    - `DATABASE_URL`: URL de conexión a PostgreSQL (gestionada por Docker)

3.  **Construir y Ejecutar:**
    ```bash
    docker-compose up -d --build
    ```

4.  **Verificación:**
    - Frontend: http://localhost:3000
    - Backend API: http://localhost:4000/api
    - Base de Datos: Puerto 5433

---

## 2. Manual de Uso por Módulos

### Módulo de Autenticación
**Componentes:** Login Page, Google OAuth Provider, AuthContext.
- **Funcionalidad:** Permite el acceso seguro a la plataforma.
- **Uso:**
    - Inicie sesión con su cuenta corporativa de Google (Gamma Ingenieros) o credenciales locales.
    - El sistema asigna automáticamente el tenant basado en el dominio del correo.

### Módulo Dashboard
**Componentes:** DashboardLayout, StatsCards, RiskChart.
- **Funcionalidad:** Vista general del estado de gobernanza de la IA.
- **Uso:**
    - Visualice métricas clave: Total de evaluaciones, nivel de madurez promedio.
    - Gráfico de distribución de riesgos.
    - Acceso rápido a evaluaciones recientes.
    - **Aislamiento:** Los usuarios solo ven datos pertinentes a su rol y tenant.

### Módulo de Clientes
**Componentes:** ClientsPage, ClientModal, ClientTable.
- **Funcionalidad:** Gestión de organizaciones evaluadas.
- **Uso:**
    - Crear nuevo cliente: Botón "+ Nuevo Cliente", llenar datos de contacto.
    - Listar: Tabla con filtrado por nombre.
    - Editar/Eliminar: Acciones disponibles en cada fila.
    - **Aislamiento:** Consultores solo ven clientes que ellos mismos han registrado.

### Módulo de Evaluaciones (Assessments)
**Componentes:** AssessmentList, AssessmentWizard, QuestionCard, RadarChart.
- **Funcionalidad:** Realización de auditorías de IA.
- **Uso:**
    - **Nueva Evaluación:** Seleccione cliente y tipo (Express/Advanced).
    - **Cuestionario:** Responda las preguntas agrupadas por pilares (Seguridad, Privacidad, Transparencia, etc.).
    - **Resultados:** Al finalizar, se calcula un puntaje de madurez y nivel de riesgo.
    - **PDF:** Descargue un informe detallado en PDF.

### Módulo de Comparación
**Componentes:** ComparePage, ComparisonTable.
- **Funcionalidad:** Comparar el progreso entre dos evaluaciones.
- **Uso:**
    - Seleccione dos evaluaciones del mismo cliente.
    - Visualice la mejora (delta) en cada pilar.

---

## 3. Arquitectura Técnica

- **Frontend:** React, TypeScript, TailwindCSS, Vite.
- **Backend:** Node.js, Express, Prisma ORM.
- **Base de Datos:** PostgreSQL.
- **Infraestructura:** Docker Compose.
