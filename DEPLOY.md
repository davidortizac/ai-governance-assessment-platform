# Despliegue — Gamma AI Governance Platform

Guía de despliegue completo desde cero usando Docker Compose.
Ollama corre localmente en WSL; Docker se conecta a él, no lo descarga ni gestiona.

---

## Prerequisitos

| Requisito | Versión mínima |
|-----------|----------------|
| Docker Desktop (con integración WSL 2) | 4.x |
| WSL 2 con Ollama instalado | — |
| Modelo `deepseek-r1:8b` descargado en Ollama | — |

Verificar que Ollama y el modelo están disponibles en WSL:
```bash
ollama list
# deepseek-r1:8b debe aparecer en la lista
```

Si el modelo no está descargado:
```bash
ollama pull deepseek-r1:8b
```

---

## Paso 1 — Exponer Ollama en la red (WSL)

Por defecto Ollama escucha solo en `127.0.0.1`. Para que los contenedores Docker puedan
alcanzarlo, debe escuchar en todas las interfaces.

Abre una terminal de WSL y ejecuta:
```bash
export OLLAMA_HOST=0.0.0.0
ollama serve
```

> **Deja esta terminal abierta** durante todo el tiempo que uses la aplicación.
> Para que el cambio sea permanente, añade la variable a `~/.bashrc` o `~/.zshrc`:
> ```bash
> echo 'export OLLAMA_HOST=0.0.0.0' >> ~/.bashrc
> ```

Verifica que Ollama responde desde WSL:
```bash
curl http://localhost:11434/api/tags
# debe devolver JSON con los modelos disponibles
```

---

## Paso 2 — Configurar variables de entorno

Copia el archivo de ejemplo y ajusta si necesitas cambiar algo:
```bash
cp .env.example .env
```

El archivo `.env` por defecto ya está preconfigurado para conectarse a Ollama en WSL.
No es necesario editar nada para un despliegue local estándar.

Variables relevantes de Ollama (en `.env`):
```
OLLAMA_URL=http://host.docker.internal:11434/v1/chat/completions
OLLAMA_MODEL=deepseek-r1:8b
OLLAMA_TIMEOUT_MS=120000
```

> `host.docker.internal` es el nombre de host especial que Docker resuelve
> automáticamente hacia la máquina anfitriona (Windows/WSL).
> El `extra_hosts` en `docker-compose.yml` garantiza que esto funcione en Linux.

---

## Paso 3 — Construir y levantar los contenedores

Desde la raíz del repositorio (PowerShell, CMD o terminal WSL):
```bash
docker-compose up --build
```

La primera ejecución tarda varios minutos porque construye las imágenes.
Las siguientes ejecuciones son mucho más rápidas.

El backend ejecuta automáticamente al arrancar:
1. `prisma migrate deploy` — aplica todas las migraciones (incluida `llmAnalysis`)
2. `prisma db seed` — crea usuarios, pilares y preguntas de ejemplo
3. Inicia el servidor Express en el puerto 4000

Espera hasta ver estas líneas en los logs:
```
gamma_assessment_backend  | 🚀 Backend running on http://localhost:4000
gamma_assessment_frontend | ...nginx...
```

---

## Paso 4 — Verificar el despliegue

**Backend:**
```bash
curl http://localhost:4000/api/health
# {"status":"ok","timestamp":"..."}
```

**Ollama alcanzable desde el contenedor:**
```bash
docker exec -it gamma_assessment_backend \
  wget -qO- http://host.docker.internal:11434/api/tags 2>&1 | head -c 200
# debe devolver JSON con los modelos
```

**Frontend:**
Abre http://localhost:3000 en el navegador.

---

## Paso 5 — Credenciales iniciales (seed)

| Rol | Email | Contraseña |
|-----|-------|------------|
| Administrador | `admin@aigovernance.com` | `admin123` |
| Consultor | `consultor@aigovernance.com` | `admin123` |

> Cambia las contraseñas tras el primer acceso en un entorno de producción.

---

## Paso 6 — Flujo de prueba del análisis LLM

1. Inicia sesión como Administrador o Consultor
2. Crea un **Cliente** (nombre + industria)
3. Crea un nuevo **Assessment** (Express o Advanced)
4. Responde todas las preguntas del formulario
5. Haz clic en **Finalizar / Calcular**

El backend:
- Calcula los scores por pilar y nivel de madurez
- Llama a Ollama con los datos reales del assessment
- Persiste el análisis LLM en la base de datos

6. Descarga el **Informe PDF** desde el panel de resultados

El PDF generado contiene análisis contextual sin referencias a vendors.

**Regenerar el análisis manualmente** (si Ollama no estaba disponible al calcular):
```bash
# Obtener token
TOKEN=$(curl -s -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@aigovernance.com","password":"admin123"}' \
  | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

# Regenerar (reemplaza {ASSESSMENT_ID})
curl -X POST http://localhost:4000/api/reports/{ASSESSMENT_ID}/regenerate-analysis \
  -H "Authorization: Bearer $TOKEN"
```

---

## Puertos expuestos

| Servicio | Puerto local | URL |
|----------|-------------|-----|
| Frontend | 3000 | http://localhost:3000 |
| Backend API | 4000 | http://localhost:4000/api |
| PostgreSQL | 5433 | localhost:5433 |

---

## Comandos útiles

```bash
# Ver logs en tiempo real
docker logs -f gamma_assessment_backend
docker logs -f gamma_assessment_frontend

# Reiniciar solo el backend (sin rebuild)
docker-compose restart backend

# Parar todos los contenedores (conserva los datos)
docker-compose down

# Parar y eliminar volúmenes (borra la base de datos)
docker-compose down -v

# Reconstruir solo el backend tras cambios de código
docker-compose up --build backend

# Ejecutar migración manualmente
docker exec -it gamma_assessment_backend npx prisma migrate deploy

# Acceder a la base de datos
docker exec -it gamma_assessment_db psql -U postgres -d ai_governance
```

---

## Solución de problemas

### Ollama no responde desde el contenedor
```bash
# Verificar que Ollama escucha en 0.0.0.0 (no solo 127.0.0.1)
# En WSL:
export OLLAMA_HOST=0.0.0.0 && ollama serve

# Si Docker Desktop corre en modo Linux (no WSL), extra_hosts puede no funcionar.
# Obtén la IP del gateway:
docker network inspect bridge | grep Gateway
# Reemplaza host.docker.internal por esa IP en .env
```

### El PDF no tiene análisis LLM (solo texto de fallback)
El análisis LLM es no-bloqueante: si Ollama falla, el PDF se genera igualmente
con el mensaje `"El análisis automático no está disponible"`.

Revisa los logs del backend:
```bash
docker logs gamma_assessment_backend | grep "\[LLM\]"
```

Luego regenera el análisis una vez Ollama esté disponible:
```bash
curl -X POST http://localhost:4000/api/reports/{ID}/regenerate-analysis \
  -H "Authorization: Bearer $TOKEN"
```

### Error de migración al iniciar
```bash
# Aplicar migraciones manualmente
docker exec -it gamma_assessment_backend npx prisma migrate deploy

# Si hay conflicto de schema, revisar estado de migraciones
docker exec -it gamma_assessment_backend npx prisma migrate status
```

### Puerto 5433 o 4000 ya en uso
Edita `docker-compose.yml` y cambia el puerto externo:
```yaml
ports:
  - "5434:5432"   # PostgreSQL en 5434
  - "4001:4000"   # Backend en 4001
```
