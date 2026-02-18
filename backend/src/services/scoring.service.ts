import prisma from '../lib/prisma';
import { RiskLevel } from '@prisma/client';

interface PillarScoreResult {
    pillarId: string;
    pillarKey: string;
    score: number;
    answeredCount: number;
    totalCount: number;
}

export async function calculateAssessmentScores(assessmentId: string) {
    const assessment = await prisma.assessment.findUnique({
        where: { id: assessmentId },
        include: {
            answers: { include: { question: { include: { pillar: true } } } },
        },
    });

    if (!assessment) throw new Error('Assessment not found');

    const pillars = await prisma.pillar.findMany();

    // Group answers by pillar
    const pillarAnswers = new Map<string, typeof assessment.answers>();
    for (const answer of assessment.answers) {
        const pillarId = answer.question.pillarId;
        if (!pillarAnswers.has(pillarId)) {
            pillarAnswers.set(pillarId, []);
        }
        pillarAnswers.get(pillarId)!.push(answer);
    }

    // Calculate per-pillar scores
    const pillarScoreResults: PillarScoreResult[] = [];
    const pillarScoreMap = new Map<string, number>();

    for (const pillar of pillars) {
        const answers = pillarAnswers.get(pillar.id) || [];
        const applicableAnswers = answers.filter(a => !a.notApplicable);
        const totalCount = answers.length;
        const answeredCount = applicableAnswers.length;

        let score = 0;
        if (answeredCount > 0) {
            score = applicableAnswers.reduce((sum, a) => sum + a.score, 0) / answeredCount;
        }

        pillarScoreResults.push({
            pillarId: pillar.id,
            pillarKey: pillar.key,
            score: Math.round(score * 100) / 100,
            answeredCount,
            totalCount,
        });

        pillarScoreMap.set(pillar.key, score);
    }

    // Save pillar scores (upsert)
    for (const ps of pillarScoreResults) {
        await prisma.pillarScore.upsert({
            where: {
                assessmentId_pillarId: {
                    assessmentId,
                    pillarId: ps.pillarId,
                },
            },
            update: {
                score: ps.score,
                answeredCount: ps.answeredCount,
                totalCount: ps.totalCount,
            },
            create: {
                assessmentId,
                pillarId: ps.pillarId,
                score: ps.score,
                answeredCount: ps.answeredCount,
                totalCount: ps.totalCount,
            },
        });
    }

    // Calculate overall weighted score
    const totalWeight = pillars.reduce((sum, p) => sum + p.weight, 0);
    let overallScore = 0;
    if (totalWeight > 0) {
        overallScore = pillarScoreResults.reduce((sum, ps) => {
            const pillar = pillars.find(p => p.id === ps.pillarId);
            return sum + ps.score * (pillar?.weight ?? 1);
        }, 0) / totalWeight;
    }
    overallScore = Math.round(overallScore * 100) / 100;

    // Determine maturity level
    const maturityLevel = getMaturityLevel(overallScore);

    // Determine risk level
    const riskLevel = classifyRisk(pillarScoreMap);

    // Update assessment
    await prisma.assessment.update({
        where: { id: assessmentId },
        data: {
            overallScore,
            maturityLevel,
            riskLevel,
            status: 'COMPLETED',
            completedAt: new Date(),
        },
    });

    return {
        overallScore,
        maturityLevel,
        maturityLabel: getMaturityLabel(maturityLevel),
        riskLevel,
        pillarScores: pillarScoreResults,
    };
}

export function getMaturityLevel(score: number): number {
    if (score < 1.0) return 1;
    if (score < 2.0) return 2;
    if (score < 3.0) return 3;
    if (score <= 3.5) return 4;
    return 5;
}

export function getMaturityLabel(level: number): string {
    const labels: Record<number, string> = {
        1: 'Experimental',
        2: 'Emergente',
        3: 'Definido',
        4: 'Gestionado',
        5: 'Optimizado',
    };
    return labels[level] || 'Desconocido';
}

export function classifyRisk(pillarScores: Map<string, number>): RiskLevel {
    const adoptionKeys = ['employee_usage', 'ai_development', 'agents_integrations'];
    const governanceKeys = ['strategy_governance', 'infrastructure'];
    const securityKey = 'ai_security';

    const adoptionScores = adoptionKeys
        .map(k => pillarScores.get(k) ?? 0)
        .filter(s => s > 0);
    const governanceScores = governanceKeys
        .map(k => pillarScores.get(k) ?? 0)
        .filter(s => s > 0);

    const adoption = adoptionScores.length > 0
        ? adoptionScores.reduce((a, b) => a + b, 0) / adoptionScores.length
        : 0;
    const governance = governanceScores.length > 0
        ? governanceScores.reduce((a, b) => a + b, 0) / governanceScores.length
        : 0;
    const security = pillarScores.get(securityKey) ?? 0;

    // Risk classification logic
    if (adoption > 2.5 && governance < 1.5) return 'CRITICAL';
    if (adoption > 2.5 && security < 2.5) return 'HIGH';
    if (adoption < 1.5 && governance < 1.5) return 'LATENT';
    if (adoption > 2.5 && security >= 2.5 && governance >= 2.0) return 'CONTROLLED';
    if (adoption > 2.0 && (security < 2.0 || governance < 2.0)) return 'HIGH';
    if (adoption <= 2.0 && governance >= 2.0 && security >= 2.0) return 'LOW';

    return 'MEDIUM';
}
