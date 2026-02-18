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

    const questionData: { pillarKey: string; text: string; type: 'EXPRESS' | 'ADVANCED'; order: number }[] = [
        // ---- ESTRATEGIA Y GOBIERNO ----
        // Express
        { pillarKey: 'strategy_governance', text: '¿Existe una estrategia formal de IA aprobada por la alta dirección?', type: 'EXPRESS', order: 1 },
        { pillarKey: 'strategy_governance', text: '¿Se han definido políticas de uso ético y responsable de la IA?', type: 'EXPRESS', order: 2 },
        { pillarKey: 'strategy_governance', text: '¿Existe un comité o responsable dedicado a la gobernanza de IA?', type: 'EXPRESS', order: 3 },
        // Advanced
        { pillarKey: 'strategy_governance', text: '¿Existe una estrategia formal de IA aprobada por la alta dirección?', type: 'ADVANCED', order: 1 },
        { pillarKey: 'strategy_governance', text: '¿Se han definido políticas de uso ético y responsable de la IA?', type: 'ADVANCED', order: 2 },
        { pillarKey: 'strategy_governance', text: '¿Existe un comité o responsable dedicado a la gobernanza de IA?', type: 'ADVANCED', order: 3 },
        { pillarKey: 'strategy_governance', text: '¿Se realiza una evaluación periódica del impacto de la IA en la organización?', type: 'ADVANCED', order: 4 },
        { pillarKey: 'strategy_governance', text: '¿Están documentados los riesgos asociados al uso de IA con planes de mitigación?', type: 'ADVANCED', order: 5 },
        { pillarKey: 'strategy_governance', text: '¿Se ha establecido un marco regulatorio interno alineado con normativas (EU AI Act, NIST)?', type: 'ADVANCED', order: 6 },
        { pillarKey: 'strategy_governance', text: '¿Se miden KPIs de ROI y efectividad de las inversiones en IA?', type: 'ADVANCED', order: 7 },
        { pillarKey: 'strategy_governance', text: '¿Existe transparencia hacia stakeholders sobre el uso de IA?', type: 'ADVANCED', order: 8 },
        { pillarKey: 'strategy_governance', text: '¿Se han definido procesos de auditoría interna de modelos y soluciones de IA?', type: 'ADVANCED', order: 9 },
        { pillarKey: 'strategy_governance', text: '¿Existe un presupuesto dedicado a iniciativas de IA?', type: 'ADVANCED', order: 10 },

        // ---- USO POR EMPLEADOS ----
        // Express
        { pillarKey: 'employee_usage', text: '¿Los empleados utilizan herramientas de IA en su trabajo diario?', type: 'EXPRESS', order: 1 },
        { pillarKey: 'employee_usage', text: '¿Existe un programa de capacitación en IA para empleados?', type: 'EXPRESS', order: 2 },
        { pillarKey: 'employee_usage', text: '¿Se han establecido directrices claras sobre qué herramientas de IA están autorizadas?', type: 'EXPRESS', order: 3 },
        // Advanced
        { pillarKey: 'employee_usage', text: '¿Los empleados utilizan herramientas de IA en su trabajo diario?', type: 'ADVANCED', order: 1 },
        { pillarKey: 'employee_usage', text: '¿Existe un programa de capacitación en IA para empleados?', type: 'ADVANCED', order: 2 },
        { pillarKey: 'employee_usage', text: '¿Se han establecido directrices claras sobre qué herramientas de IA están autorizadas?', type: 'ADVANCED', order: 3 },
        { pillarKey: 'employee_usage', text: '¿Se mide la adopción de herramientas de IA por parte de los empleados?', type: 'ADVANCED', order: 4 },
        { pillarKey: 'employee_usage', text: '¿Los empleados reportan mejoras de productividad gracias a la IA?', type: 'ADVANCED', order: 5 },
        { pillarKey: 'employee_usage', text: '¿Existe una comunidad de práctica o grupo de champions de IA?', type: 'ADVANCED', order: 6 },
        { pillarKey: 'employee_usage', text: '¿Se han identificado y mitigado riesgos de Shadow IT con herramientas de IA?', type: 'ADVANCED', order: 7 },
        { pillarKey: 'employee_usage', text: '¿Los empleados entienden las limitaciones y sesgos potenciales de la IA?', type: 'ADVANCED', order: 8 },
        { pillarKey: 'employee_usage', text: '¿Existe un proceso de feedback de empleados sobre herramientas de IA?', type: 'ADVANCED', order: 9 },
        { pillarKey: 'employee_usage', text: '¿Se ha evaluado el impacto de la IA en la satisfacción y bienestar laboral?', type: 'ADVANCED', order: 10 },

        // ---- DESARROLLO DE IA ----
        // Express
        { pillarKey: 'ai_development', text: '¿La organización desarrolla modelos o soluciones propias de IA?', type: 'EXPRESS', order: 1 },
        { pillarKey: 'ai_development', text: '¿Se siguen metodologías estructuradas (MLOps) para el desarrollo de IA?', type: 'EXPRESS', order: 2 },
        { pillarKey: 'ai_development', text: '¿Existen procesos de validación y testing de modelos antes de producción?', type: 'EXPRESS', order: 3 },
        { pillarKey: 'ai_development', text: '¿Se documentan adecuadamente los modelos y datasets utilizados?', type: 'EXPRESS', order: 4 },
        // Advanced
        { pillarKey: 'ai_development', text: '¿La organización desarrolla modelos o soluciones propias de IA?', type: 'ADVANCED', order: 1 },
        { pillarKey: 'ai_development', text: '¿Se siguen metodologías estructuradas (MLOps) para el desarrollo de IA?', type: 'ADVANCED', order: 2 },
        { pillarKey: 'ai_development', text: '¿Existen procesos de validación y testing de modelos antes de producción?', type: 'ADVANCED', order: 3 },
        { pillarKey: 'ai_development', text: '¿Se documentan adecuadamente los modelos y datasets utilizados?', type: 'ADVANCED', order: 4 },
        { pillarKey: 'ai_development', text: '¿Se implementan pipelines de CI/CD específicos para modelos de IA?', type: 'ADVANCED', order: 5 },
        { pillarKey: 'ai_development', text: '¿Se realizan evaluaciones de sesgo y equidad (fairness) en los modelos?', type: 'ADVANCED', order: 6 },
        { pillarKey: 'ai_development', text: '¿Existe versionamiento de modelos y reproducibilidad de experimentos?', type: 'ADVANCED', order: 7 },
        { pillarKey: 'ai_development', text: '¿Se monitorea el rendimiento de modelos en producción (drift detection)?', type: 'ADVANCED', order: 8 },
        { pillarKey: 'ai_development', text: '¿El equipo técnico posee competencias adecuadas para desarrollo de IA?', type: 'ADVANCED', order: 9 },
        { pillarKey: 'ai_development', text: '¿Se implementan prácticas de IA explicable (XAI)?', type: 'ADVANCED', order: 10 },
        { pillarKey: 'ai_development', text: '¿Existe un catálogo centralizado de modelos y APIs de IA?', type: 'ADVANCED', order: 11 },

        // ---- AGENTES E INTEGRACIONES ----
        // Express
        { pillarKey: 'agents_integrations', text: '¿Se utilizan agentes de IA autónomos en procesos de negocio?', type: 'EXPRESS', order: 1 },
        { pillarKey: 'agents_integrations', text: '¿Las herramientas de IA están integradas con los sistemas existentes (CRM, ERP, etc.)?', type: 'EXPRESS', order: 2 },
        { pillarKey: 'agents_integrations', text: '¿Existen controles de supervisión humana para agentes de IA?', type: 'EXPRESS', order: 3 },
        // Advanced
        { pillarKey: 'agents_integrations', text: '¿Se utilizan agentes de IA autónomos en procesos de negocio?', type: 'ADVANCED', order: 1 },
        { pillarKey: 'agents_integrations', text: '¿Las herramientas de IA están integradas con los sistemas existentes (CRM, ERP, etc.)?', type: 'ADVANCED', order: 2 },
        { pillarKey: 'agents_integrations', text: '¿Existen controles de supervisión humana para agentes de IA?', type: 'ADVANCED', order: 3 },
        { pillarKey: 'agents_integrations', text: '¿Se han implementado APIs de IA para consumo interno o externo?', type: 'ADVANCED', order: 4 },
        { pillarKey: 'agents_integrations', text: '¿Existe orquestación entre múltiples agentes de IA?', type: 'ADVANCED', order: 5 },
        { pillarKey: 'agents_integrations', text: '¿Se evalúa la confiabilidad y precisión de los agentes de IA regularmente?', type: 'ADVANCED', order: 6 },
        { pillarKey: 'agents_integrations', text: '¿Los agentes tienen permisos y alcance claramente definidos?', type: 'ADVANCED', order: 7 },
        { pillarKey: 'agents_integrations', text: '¿Se han implementado mecanismos de fallback cuando los agentes fallan?', type: 'ADVANCED', order: 8 },
        { pillarKey: 'agents_integrations', text: '¿Existe logging y trazabilidad de las acciones de los agentes?', type: 'ADVANCED', order: 9 },

        // ---- INFRAESTRUCTURA ----
        // Express
        { pillarKey: 'infrastructure', text: '¿La infraestructura actual soporta las cargas de trabajo de IA?', type: 'EXPRESS', order: 1 },
        { pillarKey: 'infrastructure', text: '¿Se utilizan servicios cloud para computación de IA?', type: 'EXPRESS', order: 2 },
        { pillarKey: 'infrastructure', text: '¿Existe una estrategia de gestión de datos para IA?', type: 'EXPRESS', order: 3 },
        // Advanced
        { pillarKey: 'infrastructure', text: '¿La infraestructura actual soporta las cargas de trabajo de IA?', type: 'ADVANCED', order: 1 },
        { pillarKey: 'infrastructure', text: '¿Se utilizan servicios cloud para computación de IA?', type: 'ADVANCED', order: 2 },
        { pillarKey: 'infrastructure', text: '¿Existe una estrategia de gestión de datos para IA?', type: 'ADVANCED', order: 3 },
        { pillarKey: 'infrastructure', text: '¿Se han implementado pipelines de datos (ETL/ELT) para alimentar modelos de IA?', type: 'ADVANCED', order: 4 },
        { pillarKey: 'infrastructure', text: '¿Existe monitoreo de costos de infraestructura de IA?', type: 'ADVANCED', order: 5 },
        { pillarKey: 'infrastructure', text: '¿Los datos sensibles están protegidos con cifrado y controles de acceso?', type: 'ADVANCED', order: 6 },
        { pillarKey: 'infrastructure', text: '¿Se han implementado GPUs o aceleradores dedicados para IA?', type: 'ADVANCED', order: 7 },
        { pillarKey: 'infrastructure', text: '¿Existe escalabilidad automática para cargas de trabajo de IA?', type: 'ADVANCED', order: 8 },
        { pillarKey: 'infrastructure', text: '¿Se aplican políticas de retención y calidad de datos?', type: 'ADVANCED', order: 9 },
        { pillarKey: 'infrastructure', text: '¿La latencia y disponibilidad son adecuadas para servicios de IA en producción?', type: 'ADVANCED', order: 10 },

        // ---- IA PARA SEGURIDAD ----
        // Express
        { pillarKey: 'ai_security', text: '¿Se han identificado y evaluado los riesgos de seguridad específicos de la IA?', type: 'EXPRESS', order: 1 },
        { pillarKey: 'ai_security', text: '¿Existen controles de acceso específicos para modelos y datos de IA?', type: 'EXPRESS', order: 2 },
        { pillarKey: 'ai_security', text: '¿Se realizan pruebas de seguridad (adversarial testing) en modelos de IA?', type: 'EXPRESS', order: 3 },
        { pillarKey: 'ai_security', text: '¿Se cumple con regulaciones de privacidad de datos en el uso de IA?', type: 'EXPRESS', order: 4 },
        // Advanced
        { pillarKey: 'ai_security', text: '¿Se han identificado y evaluado los riesgos de seguridad específicos de la IA?', type: 'ADVANCED', order: 1 },
        { pillarKey: 'ai_security', text: '¿Existen controles de acceso específicos para modelos y datos de IA?', type: 'ADVANCED', order: 2 },
        { pillarKey: 'ai_security', text: '¿Se realizan pruebas de seguridad (adversarial testing) en modelos de IA?', type: 'ADVANCED', order: 3 },
        { pillarKey: 'ai_security', text: '¿Se cumple con regulaciones de privacidad de datos en el uso de IA?', type: 'ADVANCED', order: 4 },
        { pillarKey: 'ai_security', text: '¿Se ha implementado protección contra inyección de prompts y ataques a LLMs?', type: 'ADVANCED', order: 5 },
        { pillarKey: 'ai_security', text: '¿Existe un plan de respuesta a incidentes específico para IA?', type: 'ADVANCED', order: 6 },
        { pillarKey: 'ai_security', text: '¿Se realiza monitoreo de anomalías en el comportamiento de modelos?', type: 'ADVANCED', order: 7 },
        { pillarKey: 'ai_security', text: '¿Se protege la propiedad intelectual de los modelos de IA?', type: 'ADVANCED', order: 8 },
        { pillarKey: 'ai_security', text: '¿Se aplican principios de seguridad por diseño en el desarrollo de IA?', type: 'ADVANCED', order: 9 },
        { pillarKey: 'ai_security', text: '¿Se evalúa la cadena de suministro de IA (modelos de terceros, datasets, APIs)?', type: 'ADVANCED', order: 10 },
        { pillarKey: 'ai_security', text: '¿Se utilizan herramientas de IA para mejorar la postura de ciberseguridad?', type: 'ADVANCED', order: 11 },
        { pillarKey: 'ai_security', text: '¿Existe red teaming o simulación de ataques enfocado en IA?', type: 'ADVANCED', order: 12 },
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
            update: { text: q.text },
            create: {
                id: `${q.pillarKey}_${q.type}_${q.order}`,
                text: q.text,
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
