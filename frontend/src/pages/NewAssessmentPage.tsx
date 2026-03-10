import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../lib/api';

interface Question {
    id: string;
    text: string;
    hint?: string | null;
    pillar: { id: string; name: string; key: string };
    order: number;
}

interface AnswerData {
    questionId: string;
    score: number;
    notApplicable: boolean;
}

const CONTEXT_QUESTIONS = [
    { key: 'totalUsers', label: 'Cantidad aproximada de usuarios/empleados', type: 'number' as const, placeholder: 'Ej: 250' },
    { key: 'infoSystems', label: 'Principales sistemas de información que utiliza', type: 'text' as const, placeholder: 'Ej: SAP, Salesforce, Office 365, Google Workspace...' },
    { key: 'aiModelsUsed', label: 'Modelos o herramientas de IA que ha adoptado o utiliza', type: 'text' as const, placeholder: 'Ej: ChatGPT, Copilot, modelos internos, ninguno...' },
    { key: 'aiBudget', label: 'Presupuesto estimado para proyectos de IA este año', type: 'text' as const, placeholder: 'Ej: $50.000 USD, No definido, En evaluación...' },
];

export default function NewAssessmentPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const resumeId = searchParams.get('resume');

    const [step, setStep] = useState<'config' | 'questions' | 'submitting'>('config');
    const [clients, setClients] = useState<any[]>([]);
    const [selectedClient, setSelectedClient] = useState('');
    const [assessmentType, setAssessmentType] = useState<'EXPRESS' | 'ADVANCED'>('EXPRESS');
    const [assessmentId, setAssessmentId] = useState<string | null>(null);
    const [questions, setQuestions] = useState<Question[]>([]);
    const [answers, setAnswers] = useState<Map<string, AnswerData>>(new Map());
    const [currentPillar, setCurrentPillar] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [expandedHints, setExpandedHints] = useState<Set<string>>(new Set());
    const [contextData, setContextData] = useState<Record<string, string>>({});

    // Load clients
    useEffect(() => {
        api.get('/clients').then(res => setClients(res.data)).catch(console.error);
    }, []);

    // Resume existing assessment
    useEffect(() => {
        if (resumeId) {
            api.get(`/assessments/${resumeId}`).then(res => {
                const data = res.data;
                setAssessmentId(data.id);
                setSelectedClient(data.clientId);
                setAssessmentType(data.type);
                setQuestions(data.questions);
                // Load existing answers
                const existingAnswers = new Map<string, AnswerData>();
                data.answers.forEach((a: any) => {
                    existingAnswers.set(a.questionId, {
                        questionId: a.questionId,
                        score: a.score,
                        notApplicable: a.notApplicable,
                    });
                });
                setAnswers(existingAnswers);
                if (data.contextData && typeof data.contextData === 'object') {
                    setContextData(data.contextData);
                }
                setStep('questions');
            }).catch(console.error);
        }
    }, [resumeId]);

    // Group questions by pillar
    const pillarGroups = questions.reduce<{ pillar: string; pillarKey: string; questions: Question[] }[]>((acc, q) => {
        let group = acc.find(g => g.pillar === q.pillar.name);
        if (!group) {
            group = { pillar: q.pillar.name, pillarKey: q.pillar.key, questions: [] };
            acc.push(group);
        }
        group.questions.push(q);
        return acc;
    }, []);

    const handleCreateAssessment = async () => {
        if (!selectedClient) return;
        setLoading(true);
        setError(null);
        try {
            const res = await api.post('/assessments', { clientId: selectedClient, type: assessmentType });
            setAssessmentId(res.data.assessment.id);
            setQuestions(res.data.questions);
            setStep('questions');
        } catch (err: any) {
            console.error(err);
            const msg = err?.response?.data?.error || err?.message || 'Error al crear la evaluación';
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    const handleAnswer = (questionId: string, score: number, notApplicable: boolean = false) => {
        setAnswers(prev => {
            const next = new Map(prev);
            next.set(questionId, { questionId, score: notApplicable ? 0 : score, notApplicable });
            return next;
        });
    };

    const handleSubmit = async () => {
        if (!assessmentId) return;
        setStep('submitting');
        try {
            // Filter out empty context fields
            const filteredContext = Object.fromEntries(
                Object.entries(contextData).filter(([, v]) => v.trim() !== '')
            );
            await api.post(`/assessments/${assessmentId}/answers`, {
                answers: Array.from(answers.values()),
                ...(Object.keys(filteredContext).length > 0 && { contextData: filteredContext }),
            });
            const result = await api.post(`/assessments/${assessmentId}/calculate`);
            navigate(`/assessments/${assessmentId}/results`);
        } catch (err) {
            console.error(err);
            setStep('questions');
        }
    };

    // Calculate progress
    const totalQuestions = questions.length;
    const answeredCount = answers.size;
    const progressPct = totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0;

    if (step === 'config') {
        return (
            <div className="max-w-2xl mx-auto space-y-6 fade-in">
                <div>
                    <h1 className="text-2xl font-bold text-surface-100">Nueva Evaluación</h1>
                    <p className="text-sm text-surface-500 mt-1">Configure los parámetros de la evaluación</p>
                </div>

                <div className="glass-card p-6 space-y-6">
                    {/* Client select */}
                    <div>
                        <label className="block text-sm font-medium text-surface-400 mb-2">Cliente *</label>
                        <select
                            value={selectedClient}
                            onChange={e => setSelectedClient(e.target.value)}
                            className="input-field"
                        >
                            <option value="">Seleccionar cliente...</option>
                            {clients.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Assessment type */}
                    <div>
                        <label className="block text-sm font-medium text-surface-400 mb-3">Tipo de Evaluación *</label>
                        <div className="grid grid-cols-2 gap-4">
                            <button
                                onClick={() => setAssessmentType('EXPRESS')}
                                className={`p-4 rounded-xl border-2 transition-all ${assessmentType === 'EXPRESS'
                                    ? 'border-primary-500 bg-primary-500/10'
                                    : 'border-surface-700 hover:border-surface-600'
                                    }`}
                            >
                                <div className="text-2xl mb-2">⚡</div>
                                <p className="font-semibold text-surface-200">Express</p>
                                <p className="text-xs text-surface-500 mt-1">~20 minutos · Evaluación rápida</p>
                            </button>
                            <button
                                onClick={() => setAssessmentType('ADVANCED')}
                                className={`p-4 rounded-xl border-2 transition-all ${assessmentType === 'ADVANCED'
                                    ? 'border-primary-500 bg-primary-500/10'
                                    : 'border-surface-700 hover:border-surface-600'
                                    }`}
                            >
                                <div className="text-2xl mb-2">🔬</div>
                                <p className="font-semibold text-surface-200">Advanced</p>
                                <p className="text-xs text-surface-500 mt-1">60-90 minutos · Evaluación profunda</p>
                            </button>
                        </div>
                    </div>

                    {error && (
                        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                            ⚠️ {error}
                        </div>
                    )}

                    <button
                        onClick={handleCreateAssessment}
                        disabled={!selectedClient || loading}
                        className="btn-primary w-full"
                    >
                        {loading ? 'Creando...' : 'Iniciar Evaluación'}
                    </button>
                </div>
            </div>
        );
    }

    if (step === 'submitting') {
        return (
            <div className="flex flex-col items-center justify-center h-64 space-y-4">
                <div className="animate-spin w-10 h-10 border-2 border-primary-500 border-t-transparent rounded-full" />
                <p className="text-surface-400">Calculando resultados...</p>
            </div>
        );
    }

    const currentGroup = pillarGroups[currentPillar];
    const isContextTab = currentPillar === pillarGroups.length;

    return (
        <div className="max-w-3xl mx-auto space-y-6 fade-in">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-surface-100">Evaluación {assessmentType}</h1>
                    <p className="text-sm text-surface-500 mt-1">{answeredCount} de {totalQuestions} preguntas respondidas</p>
                </div>
                <span className="badge-info">{assessmentType}</span>
            </div>

            {/* Overall progress */}
            <div className="glass-card p-4">
                <div className="flex items-center justify-between text-xs text-surface-400 mb-2">
                    <span>Progreso general</span>
                    <span>{Math.round(progressPct)}%</span>
                </div>
                <div className="h-2 bg-surface-800 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-primary-600 to-accent-cyan rounded-full transition-all duration-500"
                        style={{ width: `${progressPct}%` }}
                    />
                </div>
            </div>

            {/* Pillar tabs + Context tab */}
            <div className="flex gap-2 overflow-x-auto pb-2">
                {pillarGroups.map((group, i) => {
                    const pillarAnswered = group.questions.filter(q => answers.has(q.id)).length;
                    const pillarTotal = group.questions.length;
                    const isComplete = pillarAnswered === pillarTotal;
                    return (
                        <button
                            key={i}
                            onClick={() => setCurrentPillar(i)}
                            className={`shrink-0 px-4 py-2 rounded-lg text-xs font-medium transition-all ${currentPillar === i
                                ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30'
                                : isComplete
                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                    : 'bg-surface-800/50 text-surface-400 border border-surface-700/50 hover:border-surface-600'
                                }`}
                        >
                            {group.pillar} ({pillarAnswered}/{pillarTotal})
                        </button>
                    );
                })}
                <button
                    onClick={() => setCurrentPillar(pillarGroups.length)}
                    className={`shrink-0 px-4 py-2 rounded-lg text-xs font-medium transition-all ${isContextTab
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : 'bg-surface-800/50 text-surface-400 border border-surface-700/50 hover:border-surface-600'
                    }`}
                >
                    Contexto del Cliente
                </button>
            </div>

            {/* Context tab content */}
            {isContextTab && (
                <div className="space-y-4">
                    <div>
                        <h2 className="text-lg font-semibold text-surface-100">Contexto del Cliente</h2>
                        <p className="text-xs text-surface-500 mt-1">
                            Información opcional que enriquece el análisis de IA. Puedes dejar los campos vacíos.
                        </p>
                    </div>
                    {CONTEXT_QUESTIONS.map(cq => (
                        <div key={cq.key} className="glass-card p-5">
                            <label htmlFor={`ctx-${cq.key}`} className="block text-sm text-surface-200 mb-2">{cq.label}</label>
                            <input
                                id={`ctx-${cq.key}`}
                                type={cq.type}
                                value={contextData[cq.key] ?? ''}
                                onChange={e => setContextData(prev => ({ ...prev, [cq.key]: e.target.value }))}
                                placeholder={cq.placeholder}
                                className="input-field w-full"
                            />
                        </div>
                    ))}
                    <div className="rounded-xl px-4 py-3 text-xs text-surface-500 leading-relaxed"
                        style={{ background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.15)' }}>
                        Estos datos son opcionales y se utilizan para contextualizar el análisis generado por IA, permitiendo recomendaciones más relevantes para la organización.
                    </div>
                </div>
            )}

            {/* Questions */}
            {currentGroup && !isContextTab && (
                <div className="space-y-4">
                    <h2 className="text-lg font-semibold text-surface-100">{currentGroup.pillar}</h2>
                    {currentGroup.questions.map((q, qi) => {
                        const currentAnswer = answers.get(q.id);
                        const isNA = currentAnswer?.notApplicable || false;
                        return (
                            <div key={q.id} className="glass-card p-5 slide-in" style={{ animationDelay: `${qi * 0.05}s` }}>
                                <div className="flex items-start gap-2 mb-4">
                                    <p className="text-sm text-surface-200 flex-1">{qi + 1}. {q.text}</p>
                                    {q.hint && (
                                        <button
                                            type="button"
                                            onClick={() => setExpandedHints(prev => {
                                                const next = new Set(prev);
                                                if (next.has(q.id)) next.delete(q.id); else next.add(q.id);
                                                return next;
                                            })}
                                            className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${expandedHints.has(q.id)
                                                ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30'
                                                : 'bg-surface-800/50 text-surface-500 border border-surface-700/50 hover:text-primary-400 hover:border-primary-500/30'
                                            }`}
                                            title="Ver información sobre esta pregunta"
                                        >
                                            i
                                        </button>
                                    )}
                                </div>
                                {q.hint && expandedHints.has(q.id) && (
                                    <div className="mb-4 px-3 py-2.5 rounded-lg text-xs text-surface-400 leading-relaxed border-l-[3px]"
                                        style={{ background: 'rgba(59,130,246,0.06)', borderColor: '#3B82F6' }}>
                                        {q.hint}
                                    </div>
                                )}

                                <div className="flex flex-wrap items-center gap-2">
                                    {/* Score buttons 0-4 */}
                                    {[0, 1, 2, 3, 4].map(score => (
                                        <button
                                            key={score}
                                            onClick={() => handleAnswer(q.id, score)}
                                            disabled={isNA}
                                            className={`w-10 h-10 rounded-lg text-sm font-semibold transition-all ${!isNA && currentAnswer?.score === score
                                                ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/30'
                                                : isNA
                                                    ? 'bg-surface-800/30 text-surface-600 cursor-not-allowed'
                                                    : 'bg-surface-800/50 text-surface-400 hover:bg-surface-700/50 hover:text-surface-200 border border-surface-700/50'
                                                }`}
                                        >
                                            {score}
                                        </button>
                                    ))}

                                    <div className="w-px h-8 bg-surface-700/50 mx-1" />

                                    {/* N/A toggle */}
                                    <button
                                        onClick={() => handleAnswer(q.id, 0, !isNA)}
                                        className={`px-3 h-10 rounded-lg text-xs font-medium transition-all ${isNA
                                            ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30'
                                            : 'bg-surface-800/50 text-surface-500 border border-surface-700/50 hover:border-surface-600'
                                            }`}
                                    >
                                        N/A
                                    </button>
                                </div>

                                <div className="flex justify-between mt-2 text-[10px] text-surface-600">
                                    <span>0 = Inexistente</span>
                                    <span>4 = Optimizado</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between pt-4">
                <button
                    onClick={() => setCurrentPillar(Math.max(0, currentPillar - 1))}
                    disabled={currentPillar === 0}
                    className="btn-secondary"
                >
                    ← Anterior
                </button>

                {isContextTab ? (
                    <button
                        onClick={handleSubmit}
                        disabled={answeredCount === 0}
                        className="btn-primary"
                    >
                        Calcular Resultados
                    </button>
                ) : (
                    <button
                        onClick={() => setCurrentPillar(currentPillar + 1)}
                        className="btn-primary"
                    >
                        Siguiente →
                    </button>
                )}
            </div>
        </div>
    );
}
