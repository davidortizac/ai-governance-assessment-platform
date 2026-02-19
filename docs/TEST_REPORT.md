# Informe de Pruebas de Integridad, Seguridad y Funcionalidad

**Fecha:** 18 de Febrero, 2026
**Versión App:** 1.0.0 (Release Candidate)
**Entorno de Pruebas:** Local (Docker + Node.js)

---

## 1. Resumen Ejecutivo
Se han ejecutado pruebas automatizadas cubriendo los aspectos críticos de la aplicación.
**Total de Pruebas:** 13
**Resultado Global:** PASÓ (13/13)

---

## 2. Detalles de Pruebas

### A. Seguridad (Security Tests)
El objetivo fue verificar que los endpoints protegidos rechacen accesos no autenticados.

| ID | Prueba | Resultado Esperado | Resultado Obtenido | Estado |
|---|---|---|---|---|
| SEC-01 | Acceso no autenticado a /api/clients | HTTP 401 Unauthorized | HTTP 401 | ✅ PASÓ |
| SEC-02 | Acceso no autenticado a /api/dashboard | HTTP 401 Unauthorized | HTTP 401 | ✅ PASÓ |
| SEC-03 | Acceso con token JWT inválido | HTTP 401/403 Forbidden | HTTP 401 | ✅ PASÓ |
| SEC-04 | Inyección SQL en Login | Rechazo / Error controlado | Rechazo | ✅ PASÓ |

### B. Integridad (Integrity Tests)
El objetivo fue verificar la coherencia de los datos y el flujo de autenticación.

| ID | Prueba | Resultado Esperado | Resultado Obtenido | Estado |
|---|---|---|---|---|
| INT-01 | Login con credenciales válidas | Token JWT válido | Token recibido | ✅ PASÓ |
| INT-02 | Verificación de Token (Me endpoint) | Datos del usuario correcto | Datos correctos | ✅ PASÓ |
| INT-03 | Persistencia de sesión | Token válido en subsiguientes requests | Sesión activa | ✅ PASÓ |

### C. Funcionalidad (Functionality Tests)
El objetivo fue verificar el flujo principal de negocio (CRUD).

| ID | Prueba | Resultado Esperado | Resultado Obtenido | Estado |
|---|---|---|---|---|
| FUNC-01 | Crear Cliente | Cliente creado con ID único | Cliente creado | ✅ PASÓ |
| FUNC-02 | Crear Evaluación | Evaluación creada en estado DRAFT | Evaluación creada | ✅ PASÓ |
| FUNC-03 | Responder Cuestionario | Respuestas guardadas en DB | Respuestas OK | ✅ PASÓ |
| FUNC-04 | Calcular Resultados | Score y Nivel de Madurez generado | Score generado | ✅ PASÓ |
| FUNC-05 | Visualizar Dashboard | Estadísticas correctas y aisladas | Stats OK | ✅ PASÓ |
| FUNC-06 | Generar PDF | Archivo PDF generado correctamente | PDF OK | ✅ PASÓ |

---

## 3. Conclusiones
La aplicación cumple con los requisitos de seguridad básica (autenticación JWT, saneamiento de entradas), integridad en el manejo de sesiones y funcionalidad completa del flujo de evaluación. El despliegue en Docker es estable y la aplicación está lista para producción.
