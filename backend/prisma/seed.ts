import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Seeding database...');

    // ============ PILLARS ============
    const pillars = await Promise.all([
        prisma.pillar.upsert({
            where: { key: 'strategy_governance' },
            update: {},
            create: {
                name: 'Estrategia y Gobierno',
                key: 'strategy_governance',
                description: 'Evaluación de la estrategia organizacional de IA y marcos de gobernanza.',
                weight: 1.2,
                order: 1,
            },
        }),
        prisma.pillar.upsert({
            where: { key: 'employee_usage' },
            update: {},
            create: {
                name: 'Uso por Empleados',
                key: 'employee_usage',
                description: 'Evaluación de cómo los empleados adoptan y utilizan herramientas de IA.',
                weight: 1.0,
                order: 2,
            },
        }),
        prisma.pillar.upsert({
            where: { key: 'ai_development' },
            update: {},
            create: {
                name: 'Desarrollo de IA',
                key: 'ai_development',
                description: 'Evaluación de las capacidades internas de desarrollo de IA.',
                weight: 1.0,
                order: 3,
            },
        }),
        prisma.pillar.upsert({
            where: { key: 'agents_integrations' },
            update: {},
            create: {
                name: 'Agentes e Integraciones',
                key: 'agents_integrations',
                description: 'Evaluación del uso de agentes de IA e integraciones con sistemas existentes.',
                weight: 0.8,
                order: 4,
            },
        }),
        prisma.pillar.upsert({
            where: { key: 'infrastructure' },
            update: {},
            create: {
                name: 'Infraestructura',
                key: 'infrastructure',
                description: 'Evaluación de la infraestructura tecnológica para soportar cargas de IA.',
                weight: 1.0,
                order: 5,
            },
        }),
        prisma.pillar.upsert({
            where: { key: 'ai_security' },
            update: {},
            create: {
                name: 'IA para Seguridad',
                key: 'ai_security',
                description: 'Evaluación de las prácticas de seguridad aplicadas a la IA.',
                weight: 1.5,
                order: 6,
            },
        }),
    ]);

    console.log(`✅ ${pillars.length} pillars seeded`);

    // ============ QUESTIONS ============
    // Questions for EXPRESS assessment (subset, ~3-4 per pillar)
    // Questions for ADVANCED assessment (complete set, ~8-12 per pillar)

    const questionData: { pillarKey: string; text: string; hint: string; type: 'EXPRESS' | 'ADVANCED'; order: number }[] = [
        // ---- ESTRATEGIA Y GOBIERNO ----
        // Express
        { pillarKey: 'strategy_governance', text: '¿Existe una estrategia formal de IA aprobada por la alta dirección?', hint: 'Evalúa si la organización tiene un documento o plan estratégico aprobado por la junta directiva o gerencia general que defina objetivos, alcance y prioridades para el uso de inteligencia artificial.', type: 'EXPRESS', order: 1 },
        { pillarKey: 'strategy_governance', text: '¿Se han definido políticas de uso ético y responsable de la IA?', hint: 'Verifica si existen lineamientos escritos que establezcan principios éticos como transparencia, equidad, no discriminación y rendición de cuentas en el uso de IA.', type: 'EXPRESS', order: 2 },
        { pillarKey: 'strategy_governance', text: '¿Existe un comité o responsable dedicado a la gobernanza de IA?', hint: 'Determina si hay una persona o grupo designado formalmente para supervisar, regular y tomar decisiones sobre el uso de IA dentro de la organización.', type: 'EXPRESS', order: 3 },
        // Advanced
        { pillarKey: 'strategy_governance', text: '¿Existe una estrategia formal de IA aprobada por la alta dirección?', hint: 'Evalúa si la organización tiene un documento o plan estratégico aprobado por la junta directiva o gerencia general que defina objetivos, alcance y prioridades para el uso de inteligencia artificial.', type: 'ADVANCED', order: 1 },
        { pillarKey: 'strategy_governance', text: '¿Se han definido políticas de uso ético y responsable de la IA?', hint: 'Verifica si existen lineamientos escritos que establezcan principios éticos como transparencia, equidad, no discriminación y rendición de cuentas en el uso de IA.', type: 'ADVANCED', order: 2 },
        { pillarKey: 'strategy_governance', text: '¿Existe un comité o responsable dedicado a la gobernanza de IA?', hint: 'Determina si hay una persona o grupo designado formalmente para supervisar, regular y tomar decisiones sobre el uso de IA dentro de la organización.', type: 'ADVANCED', order: 3 },
        { pillarKey: 'strategy_governance', text: '¿Se realiza una evaluación periódica del impacto de la IA en la organización?', hint: 'Se refiere a si la organización mide regularmente cómo la IA afecta sus procesos, empleados, clientes y resultados de negocio, tanto positiva como negativamente.', type: 'ADVANCED', order: 4 },
        { pillarKey: 'strategy_governance', text: '¿Están documentados los riesgos asociados al uso de IA con planes de mitigación?', hint: 'Evalúa si existe un registro formal de riesgos (sesgos, errores, dependencia tecnológica, etc.) con acciones planificadas para reducirlos o eliminarlos.', type: 'ADVANCED', order: 5 },
        { pillarKey: 'strategy_governance', text: '¿Se ha establecido un marco regulatorio interno alineado con normativas (EU AI Act, NIST)?', hint: 'Verifica si las políticas internas de IA están alineadas con estándares internacionales como el EU AI Act, NIST AI RMF u otras regulaciones aplicables a la industria.', type: 'ADVANCED', order: 6 },
        { pillarKey: 'strategy_governance', text: '¿Se miden KPIs de ROI y efectividad de las inversiones en IA?', hint: 'Determina si la organización tiene indicadores concretos para medir el retorno de inversión, la eficiencia operativa y el valor generado por las iniciativas de IA.', type: 'ADVANCED', order: 7 },
        { pillarKey: 'strategy_governance', text: '¿Existe transparencia hacia stakeholders sobre el uso de IA?', hint: 'Evalúa si la organización comunica abiertamente a clientes, empleados, reguladores y socios cómo y dónde utiliza inteligencia artificial.', type: 'ADVANCED', order: 8 },
        { pillarKey: 'strategy_governance', text: '¿Se han definido procesos de auditoría interna de modelos y soluciones de IA?', hint: 'Verifica si existen revisiones periódicas e independientes para evaluar la precisión, equidad, seguridad y cumplimiento de los modelos de IA en uso.', type: 'ADVANCED', order: 9 },
        { pillarKey: 'strategy_governance', text: '¿Existe un presupuesto dedicado a iniciativas de IA?', hint: 'Determina si la organización asigna recursos financieros específicos para proyectos, herramientas, capacitación e infraestructura relacionados con IA.', type: 'ADVANCED', order: 10 },

        // ---- USO POR EMPLEADOS ----
        // Express
        { pillarKey: 'employee_usage', text: '¿Los empleados utilizan herramientas de IA en su trabajo diario?', hint: 'Evalúa si los colaboradores usan activamente herramientas como ChatGPT, Copilot, asistentes inteligentes u otras soluciones de IA para realizar sus tareas cotidianas.', type: 'EXPRESS', order: 1 },
        { pillarKey: 'employee_usage', text: '¿Existe un programa de capacitación en IA para empleados?', hint: 'Verifica si la organización ofrece formación estructurada (cursos, talleres, certificaciones) para que los empleados aprendan a usar IA de manera efectiva y segura.', type: 'EXPRESS', order: 2 },
        { pillarKey: 'employee_usage', text: '¿Se han establecido directrices claras sobre qué herramientas de IA están autorizadas?', hint: 'Determina si existe una lista aprobada de herramientas de IA permitidas y si hay reglas claras sobre qué datos se pueden compartir con estas herramientas.', type: 'EXPRESS', order: 3 },
        // Advanced
        { pillarKey: 'employee_usage', text: '¿Los empleados utilizan herramientas de IA en su trabajo diario?', hint: 'Evalúa si los colaboradores usan activamente herramientas como ChatGPT, Copilot, asistentes inteligentes u otras soluciones de IA para realizar sus tareas cotidianas.', type: 'ADVANCED', order: 1 },
        { pillarKey: 'employee_usage', text: '¿Existe un programa de capacitación en IA para empleados?', hint: 'Verifica si la organización ofrece formación estructurada (cursos, talleres, certificaciones) para que los empleados aprendan a usar IA de manera efectiva y segura.', type: 'ADVANCED', order: 2 },
        { pillarKey: 'employee_usage', text: '¿Se han establecido directrices claras sobre qué herramientas de IA están autorizadas?', hint: 'Determina si existe una lista aprobada de herramientas de IA permitidas y si hay reglas claras sobre qué datos se pueden compartir con estas herramientas.', type: 'ADVANCED', order: 3 },
        { pillarKey: 'employee_usage', text: '¿Se mide la adopción de herramientas de IA por parte de los empleados?', hint: 'Se refiere a si la organización tiene métricas de cuántos empleados usan IA, con qué frecuencia y en qué procesos, para evaluar la penetración real.', type: 'ADVANCED', order: 4 },
        { pillarKey: 'employee_usage', text: '¿Los empleados reportan mejoras de productividad gracias a la IA?', hint: 'Evalúa si existen mecanismos para recoger y cuantificar las mejoras en eficiencia, velocidad o calidad del trabajo atribuibles al uso de herramientas de IA.', type: 'ADVANCED', order: 5 },
        { pillarKey: 'employee_usage', text: '¿Existe una comunidad de práctica o grupo de champions de IA?', hint: 'Verifica si hay grupos internos de empleados entusiastas que promueven el uso de IA, comparten buenas prácticas y ayudan a otros a adoptar estas herramientas.', type: 'ADVANCED', order: 6 },
        { pillarKey: 'employee_usage', text: '¿Se han identificado y mitigado riesgos de Shadow IT con herramientas de IA?', hint: 'Determina si la organización detecta y gestiona el uso no autorizado de herramientas de IA por parte de empleados (ej. subir datos sensibles a ChatGPT sin aprobación).', type: 'ADVANCED', order: 7 },
        { pillarKey: 'employee_usage', text: '¿Los empleados entienden las limitaciones y sesgos potenciales de la IA?', hint: 'Evalúa si los empleados saben que la IA puede generar información incorrecta (alucinaciones), tener sesgos y que sus resultados deben verificarse críticamente.', type: 'ADVANCED', order: 8 },
        { pillarKey: 'employee_usage', text: '¿Existe un proceso de feedback de empleados sobre herramientas de IA?', hint: 'Verifica si hay canales formales donde los empleados pueden reportar problemas, sugerir mejoras o compartir experiencias sobre las herramientas de IA que usan.', type: 'ADVANCED', order: 9 },
        { pillarKey: 'employee_usage', text: '¿Se ha evaluado el impacto de la IA en la satisfacción y bienestar laboral?', hint: 'Se refiere a si la organización analiza cómo la IA afecta la moral, la carga de trabajo y la percepción de los empleados sobre su futuro profesional.', type: 'ADVANCED', order: 10 },

        // ---- DESARROLLO DE IA ----
        // Express
        { pillarKey: 'ai_development', text: '¿La organización desarrolla modelos o soluciones propias de IA?', hint: 'Evalúa si la organización crea sus propios modelos de machine learning, chatbots, sistemas de recomendación u otras soluciones de IA, en lugar de solo usar herramientas de terceros.', type: 'EXPRESS', order: 1 },
        { pillarKey: 'ai_development', text: '¿Se siguen metodologías estructuradas (MLOps) para el desarrollo de IA?', hint: 'Verifica si existe un proceso ordenado para desarrollar, probar, desplegar y mantener modelos de IA, similar a DevOps pero adaptado a machine learning.', type: 'EXPRESS', order: 2 },
        { pillarKey: 'ai_development', text: '¿Existen procesos de validación y testing de modelos antes de producción?', hint: 'Determina si los modelos de IA pasan por pruebas rigurosas de precisión, rendimiento y seguridad antes de ser utilizados con datos reales o clientes.', type: 'EXPRESS', order: 3 },
        { pillarKey: 'ai_development', text: '¿Se documentan adecuadamente los modelos y datasets utilizados?', hint: 'Evalúa si existe documentación sobre qué datos se usaron para entrenar cada modelo, sus características, limitaciones conocidas y versiones.', type: 'EXPRESS', order: 4 },
        // Advanced
        { pillarKey: 'ai_development', text: '¿La organización desarrolla modelos o soluciones propias de IA?', hint: 'Evalúa si la organización crea sus propios modelos de machine learning, chatbots, sistemas de recomendación u otras soluciones de IA, en lugar de solo usar herramientas de terceros.', type: 'ADVANCED', order: 1 },
        { pillarKey: 'ai_development', text: '¿Se siguen metodologías estructuradas (MLOps) para el desarrollo de IA?', hint: 'Verifica si existe un proceso ordenado para desarrollar, probar, desplegar y mantener modelos de IA, similar a DevOps pero adaptado a machine learning.', type: 'ADVANCED', order: 2 },
        { pillarKey: 'ai_development', text: '¿Existen procesos de validación y testing de modelos antes de producción?', hint: 'Determina si los modelos de IA pasan por pruebas rigurosas de precisión, rendimiento y seguridad antes de ser utilizados con datos reales o clientes.', type: 'ADVANCED', order: 3 },
        { pillarKey: 'ai_development', text: '¿Se documentan adecuadamente los modelos y datasets utilizados?', hint: 'Evalúa si existe documentación sobre qué datos se usaron para entrenar cada modelo, sus características, limitaciones conocidas y versiones.', type: 'ADVANCED', order: 4 },
        { pillarKey: 'ai_development', text: '¿Se implementan pipelines de CI/CD específicos para modelos de IA?', hint: 'Se refiere a si existen procesos automatizados para integrar, probar y desplegar modelos de IA de forma continua, asegurando calidad en cada actualización.', type: 'ADVANCED', order: 5 },
        { pillarKey: 'ai_development', text: '¿Se realizan evaluaciones de sesgo y equidad (fairness) en los modelos?', hint: 'Verifica si la organización analiza activamente si sus modelos de IA producen resultados discriminatorios o injustos para ciertos grupos de personas.', type: 'ADVANCED', order: 6 },
        { pillarKey: 'ai_development', text: '¿Existe versionamiento de modelos y reproducibilidad de experimentos?', hint: 'Determina si los modelos se guardan con control de versiones y si es posible reproducir exactamente los resultados de entrenamientos anteriores.', type: 'ADVANCED', order: 7 },
        { pillarKey: 'ai_development', text: '¿Se monitorea el rendimiento de modelos en producción (drift detection)?', hint: 'Evalúa si la organización detecta cuándo un modelo en producción empieza a perder precisión porque los datos del mundo real cambian con el tiempo.', type: 'ADVANCED', order: 8 },
        { pillarKey: 'ai_development', text: '¿El equipo técnico posee competencias adecuadas para desarrollo de IA?', hint: 'Verifica si hay personal con las habilidades técnicas necesarias (ciencia de datos, ingeniería ML, etc.) o si se depende completamente de proveedores externos.', type: 'ADVANCED', order: 9 },
        { pillarKey: 'ai_development', text: '¿Se implementan prácticas de IA explicable (XAI)?', hint: 'Se refiere a si los modelos de IA pueden explicar por qué tomaron una decisión, de forma comprensible para humanos, especialmente en decisiones de alto impacto.', type: 'ADVANCED', order: 10 },
        { pillarKey: 'ai_development', text: '¿Existe un catálogo centralizado de modelos y APIs de IA?', hint: 'Determina si la organización mantiene un inventario organizado de todos los modelos de IA y servicios de IA disponibles para uso interno.', type: 'ADVANCED', order: 11 },

        // ---- AGENTES E INTEGRACIONES ----
        // Express
        { pillarKey: 'agents_integrations', text: '¿Se utilizan agentes de IA autónomos en procesos de negocio?', hint: 'Evalúa si la organización emplea sistemas de IA que toman decisiones o ejecutan acciones de forma autónoma en procesos como atención al cliente, ventas o soporte.', type: 'EXPRESS', order: 1 },
        { pillarKey: 'agents_integrations', text: '¿Las herramientas de IA están integradas con los sistemas existentes (CRM, ERP, etc.)?', hint: 'Verifica si las soluciones de IA se conectan con los sistemas empresariales existentes para intercambiar datos y automatizar flujos de trabajo.', type: 'EXPRESS', order: 2 },
        { pillarKey: 'agents_integrations', text: '¿Existen controles de supervisión humana para agentes de IA?', hint: 'Determina si hay mecanismos que permitan a las personas revisar, aprobar o corregir las decisiones tomadas por agentes de IA antes de que se ejecuten.', type: 'EXPRESS', order: 3 },
        // Advanced
        { pillarKey: 'agents_integrations', text: '¿Se utilizan agentes de IA autónomos en procesos de negocio?', hint: 'Evalúa si la organización emplea sistemas de IA que toman decisiones o ejecutan acciones de forma autónoma en procesos como atención al cliente, ventas o soporte.', type: 'ADVANCED', order: 1 },
        { pillarKey: 'agents_integrations', text: '¿Las herramientas de IA están integradas con los sistemas existentes (CRM, ERP, etc.)?', hint: 'Verifica si las soluciones de IA se conectan con los sistemas empresariales existentes para intercambiar datos y automatizar flujos de trabajo.', type: 'ADVANCED', order: 2 },
        { pillarKey: 'agents_integrations', text: '¿Existen controles de supervisión humana para agentes de IA?', hint: 'Determina si hay mecanismos que permitan a las personas revisar, aprobar o corregir las decisiones tomadas por agentes de IA antes de que se ejecuten.', type: 'ADVANCED', order: 3 },
        { pillarKey: 'agents_integrations', text: '¿Se han implementado APIs de IA para consumo interno o externo?', hint: 'Se refiere a si la organización expone capacidades de IA como servicios web (APIs) que otros sistemas o socios pueden consumir de forma programática.', type: 'ADVANCED', order: 4 },
        { pillarKey: 'agents_integrations', text: '¿Existe orquestación entre múltiples agentes de IA?', hint: 'Evalúa si varios agentes de IA trabajan de forma coordinada, delegando tareas entre sí para completar procesos complejos de extremo a extremo.', type: 'ADVANCED', order: 5 },
        { pillarKey: 'agents_integrations', text: '¿Se evalúa la confiabilidad y precisión de los agentes de IA regularmente?', hint: 'Verifica si hay métricas y evaluaciones periódicas para medir qué tan bien están funcionando los agentes de IA y si sus respuestas son correctas.', type: 'ADVANCED', order: 6 },
        { pillarKey: 'agents_integrations', text: '¿Los agentes tienen permisos y alcance claramente definidos?', hint: 'Determina si cada agente de IA tiene delimitado exactamente qué acciones puede realizar, a qué datos puede acceder y qué está fuera de su alcance.', type: 'ADVANCED', order: 7 },
        { pillarKey: 'agents_integrations', text: '¿Se han implementado mecanismos de fallback cuando los agentes fallan?', hint: 'Se refiere a si existen procedimientos alternativos (como escalación a humanos) cuando un agente de IA no puede completar una tarea o produce errores.', type: 'ADVANCED', order: 8 },
        { pillarKey: 'agents_integrations', text: '¿Existe logging y trazabilidad de las acciones de los agentes?', hint: 'Evalúa si todas las acciones ejecutadas por agentes de IA quedan registradas para auditoría, depuración y cumplimiento normativo.', type: 'ADVANCED', order: 9 },

        // ---- INFRAESTRUCTURA ----
        // Express
        { pillarKey: 'infrastructure', text: '¿La infraestructura actual soporta las cargas de trabajo de IA?', hint: 'Evalúa si los servidores, redes y almacenamiento de la organización tienen la capacidad necesaria para ejecutar modelos de IA sin problemas de rendimiento.', type: 'EXPRESS', order: 1 },
        { pillarKey: 'infrastructure', text: '¿Se utilizan servicios cloud para computación de IA?', hint: 'Verifica si la organización usa plataformas en la nube (AWS, Azure, GCP) para entrenar modelos, ejecutar inferencias o almacenar datos de IA.', type: 'EXPRESS', order: 2 },
        { pillarKey: 'infrastructure', text: '¿Existe una estrategia de gestión de datos para IA?', hint: 'Determina si hay un plan organizado para recopilar, almacenar, limpiar y gobernar los datos que alimentan los modelos y aplicaciones de IA.', type: 'EXPRESS', order: 3 },
        // Advanced
        { pillarKey: 'infrastructure', text: '¿La infraestructura actual soporta las cargas de trabajo de IA?', hint: 'Evalúa si los servidores, redes y almacenamiento de la organización tienen la capacidad necesaria para ejecutar modelos de IA sin problemas de rendimiento.', type: 'ADVANCED', order: 1 },
        { pillarKey: 'infrastructure', text: '¿Se utilizan servicios cloud para computación de IA?', hint: 'Verifica si la organización usa plataformas en la nube (AWS, Azure, GCP) para entrenar modelos, ejecutar inferencias o almacenar datos de IA.', type: 'ADVANCED', order: 2 },
        { pillarKey: 'infrastructure', text: '¿Existe una estrategia de gestión de datos para IA?', hint: 'Determina si hay un plan organizado para recopilar, almacenar, limpiar y gobernar los datos que alimentan los modelos y aplicaciones de IA.', type: 'ADVANCED', order: 3 },
        { pillarKey: 'infrastructure', text: '¿Se han implementado pipelines de datos (ETL/ELT) para alimentar modelos de IA?', hint: 'Se refiere a si existen procesos automatizados para extraer datos de diferentes fuentes, transformarlos y cargarlos donde los modelos de IA los necesitan.', type: 'ADVANCED', order: 4 },
        { pillarKey: 'infrastructure', text: '¿Existe monitoreo de costos de infraestructura de IA?', hint: 'Evalúa si la organización controla y optimiza los costos de computación, almacenamiento y servicios cloud asociados a las cargas de trabajo de IA.', type: 'ADVANCED', order: 5 },
        { pillarKey: 'infrastructure', text: '¿Los datos sensibles están protegidos con cifrado y controles de acceso?', hint: 'Verifica si los datos personales, financieros o confidenciales usados por la IA están cifrados y solo accesibles para personas y sistemas autorizados.', type: 'ADVANCED', order: 6 },
        { pillarKey: 'infrastructure', text: '¿Se han implementado GPUs o aceleradores dedicados para IA?', hint: 'Determina si la organización cuenta con hardware especializado (GPUs NVIDIA, TPUs, etc.) para acelerar el entrenamiento e inferencia de modelos de IA.', type: 'ADVANCED', order: 7 },
        { pillarKey: 'infrastructure', text: '¿Existe escalabilidad automática para cargas de trabajo de IA?', hint: 'Se refiere a si la infraestructura puede aumentar o reducir recursos automáticamente según la demanda de procesamiento de IA en cada momento.', type: 'ADVANCED', order: 8 },
        { pillarKey: 'infrastructure', text: '¿Se aplican políticas de retención y calidad de datos?', hint: 'Evalúa si existen reglas sobre cuánto tiempo se conservan los datos, cómo se eliminan, y si hay controles para garantizar su exactitud y completitud.', type: 'ADVANCED', order: 9 },
        { pillarKey: 'infrastructure', text: '¿La latencia y disponibilidad son adecuadas para servicios de IA en producción?', hint: 'Verifica si los servicios de IA responden lo suficientemente rápido y están disponibles cuando se necesitan, sin interrupciones frecuentes.', type: 'ADVANCED', order: 10 },

        // ---- IA PARA SEGURIDAD ----
        // Express
        { pillarKey: 'ai_security', text: '¿Se han identificado y evaluado los riesgos de seguridad específicos de la IA?', hint: 'Evalúa si la organización ha analizado los riesgos únicos de la IA, como ataques adversarios, envenenamiento de datos, robo de modelos y fuga de información.', type: 'EXPRESS', order: 1 },
        { pillarKey: 'ai_security', text: '¿Existen controles de acceso específicos para modelos y datos de IA?', hint: 'Verifica si hay permisos y restricciones que limiten quién puede acceder, modificar o usar los modelos de IA y los datos con los que fueron entrenados.', type: 'EXPRESS', order: 2 },
        { pillarKey: 'ai_security', text: '¿Se realizan pruebas de seguridad (adversarial testing) en modelos de IA?', hint: 'Determina si la organización prueba activamente si sus modelos de IA pueden ser engañados o manipulados mediante entradas maliciosas diseñadas para generar errores.', type: 'EXPRESS', order: 3 },
        { pillarKey: 'ai_security', text: '¿Se cumple con regulaciones de privacidad de datos en el uso de IA?', hint: 'Evalúa si el uso de IA respeta las leyes de protección de datos aplicables (GDPR, Ley 1581 de 2012, etc.), especialmente al procesar datos personales.', type: 'EXPRESS', order: 4 },
        // Advanced
        { pillarKey: 'ai_security', text: '¿Se han identificado y evaluado los riesgos de seguridad específicos de la IA?', hint: 'Evalúa si la organización ha analizado los riesgos únicos de la IA, como ataques adversarios, envenenamiento de datos, robo de modelos y fuga de información.', type: 'ADVANCED', order: 1 },
        { pillarKey: 'ai_security', text: '¿Existen controles de acceso específicos para modelos y datos de IA?', hint: 'Verifica si hay permisos y restricciones que limiten quién puede acceder, modificar o usar los modelos de IA y los datos con los que fueron entrenados.', type: 'ADVANCED', order: 2 },
        { pillarKey: 'ai_security', text: '¿Se realizan pruebas de seguridad (adversarial testing) en modelos de IA?', hint: 'Determina si la organización prueba activamente si sus modelos de IA pueden ser engañados o manipulados mediante entradas maliciosas diseñadas para generar errores.', type: 'ADVANCED', order: 3 },
        { pillarKey: 'ai_security', text: '¿Se cumple con regulaciones de privacidad de datos en el uso de IA?', hint: 'Evalúa si el uso de IA respeta las leyes de protección de datos aplicables (GDPR, Ley 1581 de 2012, etc.), especialmente al procesar datos personales.', type: 'ADVANCED', order: 4 },
        { pillarKey: 'ai_security', text: '¿Se ha implementado protección contra inyección de prompts y ataques a LLMs?', hint: 'Se refiere a si existen defensas contra manipulación de las instrucciones que reciben los modelos de lenguaje, evitando que usuarios malintencionados alteren su comportamiento.', type: 'ADVANCED', order: 5 },
        { pillarKey: 'ai_security', text: '¿Existe un plan de respuesta a incidentes específico para IA?', hint: 'Verifica si hay procedimientos definidos para actuar cuando un sistema de IA falla, es comprometido o produce resultados dañinos de forma inesperada.', type: 'ADVANCED', order: 6 },
        { pillarKey: 'ai_security', text: '¿Se realiza monitoreo de anomalías en el comportamiento de modelos?', hint: 'Determina si la organización vigila continuamente si los modelos de IA se comportan de forma inusual, lo que podría indicar un ataque o degradación.', type: 'ADVANCED', order: 7 },
        { pillarKey: 'ai_security', text: '¿Se protege la propiedad intelectual de los modelos de IA?', hint: 'Evalúa si hay medidas para evitar que los modelos de IA propietarios sean copiados, extraídos o replicados por terceros no autorizados.', type: 'ADVANCED', order: 8 },
        { pillarKey: 'ai_security', text: '¿Se aplican principios de seguridad por diseño en el desarrollo de IA?', hint: 'Se refiere a si la seguridad se incorpora desde el inicio del desarrollo de soluciones de IA, no como un añadido posterior.', type: 'ADVANCED', order: 9 },
        { pillarKey: 'ai_security', text: '¿Se evalúa la cadena de suministro de IA (modelos de terceros, datasets, APIs)?', hint: 'Verifica si la organización analiza los riesgos de usar modelos pre-entrenados, datos y servicios de IA de proveedores externos que podrían estar comprometidos.', type: 'ADVANCED', order: 10 },
        { pillarKey: 'ai_security', text: '¿Se utilizan herramientas de IA para mejorar la postura de ciberseguridad?', hint: 'Determina si la organización aprovecha la IA para detectar amenazas, analizar logs, automatizar respuestas a incidentes o fortalecer sus defensas de seguridad.', type: 'ADVANCED', order: 11 },
        { pillarKey: 'ai_security', text: '¿Existe red teaming o simulación de ataques enfocado en IA?', hint: 'Evalúa si se realizan ejercicios donde un equipo simula ataques específicamente dirigidos a los sistemas de IA para descubrir vulnerabilidades antes que un atacante real.', type: 'ADVANCED', order: 12 },
    ];

    // Insert questions
    const pillarMap = new Map(pillars.map(p => [p.key, p.id]));
    let questionCount = 0;

    for (const q of questionData) {
        const pillarId = pillarMap.get(q.pillarKey);
        if (!pillarId) {
            console.warn(`Pillar not found: ${q.pillarKey}`);
            continue;
        }

        await prisma.question.upsert({
            where: {
                id: `${q.pillarKey}_${q.type}_${q.order}`,
            },
            update: { text: q.text, hint: q.hint },
            create: {
                id: `${q.pillarKey}_${q.type}_${q.order}`,
                text: q.text,
                hint: q.hint,
                pillarId,
                assessmentType: q.type,
                order: q.order,
            },
        });
        questionCount++;
    }

    console.log(`✅ ${questionCount} questions seeded`);

    // ============ DEFAULT ADMIN USER ============
    const hashedPassword = await bcrypt.hash('admin123', 12);

    let defaultTenant = await prisma.tenant.findFirst({ where: { domain: 'default' } });
    if (!defaultTenant) {
        defaultTenant = await prisma.tenant.create({
            data: { name: 'Default Organization', domain: 'default' },
        });
    }

    await prisma.user.upsert({
        where: { email: 'admin@aigovernance.com' },
        update: {},
        create: {
            email: 'admin@aigovernance.com',
            password: hashedPassword,
            name: 'Administrador',
            role: 'ADMIN',
            tenantId: defaultTenant.id,
        },
    });

    // Create a consultant user
    await prisma.user.upsert({
        where: { email: 'consultor@aigovernance.com' },
        update: {},
        create: {
            email: 'consultor@aigovernance.com',
            password: hashedPassword,
            name: 'Consultor Demo',
            role: 'CONSULTANT',
            tenantId: defaultTenant.id,
        },
    });

    console.log('✅ Default users seeded');
    console.log('   📧 admin@aigovernance.com / admin123');
    console.log('   📧 consultor@aigovernance.com / admin123');

    console.log('\n🎉 Seeding completed!');
}

main()
    .catch((e) => {
        console.error('Seed error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
