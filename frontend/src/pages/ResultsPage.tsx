import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import api from '../lib/api';
import RadarChart from '../components/RadarChart';
import PdfDownloadModal from '../components/PdfDownloadModal';
import EmailShareModal from '../components/EmailShareModal';

const RISK_CONFIG: Record<string, { label: string; color: string; description: string }> = {
    CONTROLLED: { label: 'Controlado', color: 'text-emerald-400', description: 'Alta adopción con gobernanza y seguridad sólidas' },
    LOW: { label: 'Bajo', color: 'text-emerald-400', description: 'Buen balance entre adopción y controles' },
    MEDIUM: { label: 'Medio', color: 'text-amber-400', description: 'Se requieren mejoras en gobernanza o seguridad' },
    HIGH: { label: 'Alto', color: 'text-red-400', description: 'Alta adopción con seguridad insuficiente' },
    CRITICAL: { label: 'Crítico', color: 'text-red-500', description: 'Alta adopción sin gobernanza adecuada' },
    LATENT: { label: 'Latente', color: 'text-violet-400', description: 'Baja adopción con baja gobernanza' },
};

const MATURITY = [
    { level: 1, label: 'Experimental', range: '0 – 0.9', description: 'Iniciativas aisladas sin estructura formal' },
    { level: 2, label: 'Emergente', range: '1.0 – 1.9', description: 'Primeros esfuerzos organizados de adopción' },
    { level: 3, label: 'Definido', range: '2.0 – 2.9', description: 'Procesos documentados y replicables' },
    { level: 4, label: 'Gestionado', range: '3.0 – 3.5', description: 'Métricas de control y mejora continua' },
    { level: 5, label: 'Optimizado', range: '3.6 – 4.0', description: 'Innovación continua y liderazgo en IA' },
];

/* ------------------------------------------------------------------ */
/*  Spinner helper                                                     */
/* ------------------------------------------------------------------ */
function Spinner({ className = 'w-4 h-4', color = 'border-primary-400' }: Readonly<{ className?: string; color?: string }>) {
    return <div className={`${className} border-2 ${color}/30 border-t-${color} rounded-full animate-spin`}
        style={{ borderTopColor: 'currentColor' }} />;
}

/* ------------------------------------------------------------------ */
/*  Status bar — shows when an action is in progress                   */
/* ------------------------------------------------------------------ */
function StatusBar({ regenerating, downloading, exportingCSV, exportingJSON, deletingAnalysis }: Readonly<{
    regenerating: boolean; downloading: boolean; exportingCSV: boolean; exportingJSON: boolean; deletingAnalysis: boolean;
}>) {
    const isBusy = downloading || exportingCSV || exportingJSON || regenerating || deletingAnalysis;
    if (!isBusy) return null;

    let label = 'Procesando...';
    if (regenerating) label = 'Generando análisis IA...';
    else if (downloading) label = 'Descargando PDF...';
    else if (exportingCSV) label = 'Exportando CSV...';
    else if (exportingJSON) label = 'Exportando JSON...';
    else if (deletingAnalysis) label = 'Eliminando análisis...';

    return (
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-500/10 border border-primary-500/20 text-sm text-primary-300">
            <Spinner />
            <span>{label}</span>
        </div>
    );
}

/* ------------------------------------------------------------------ */
/*  Model selector submenu                                             */
/* ------------------------------------------------------------------ */
function ModelSubmenu({ open, onSelect }: Readonly<{ open: boolean; onSelect: (m: string) => void }>) {
    const [models, setModels] = useState<{ name: string }[]>([]);
    const [currentModel, setCurrentModel] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!open) return;
        setLoading(true);
        api.get('/reports/llm-models')
            .then(res => { setModels(res.data.models ?? []); setCurrentModel(res.data.currentModel ?? ''); })
            .catch(() => setModels([]))
            .finally(() => setLoading(false));
    }, [open]);

    if (!open) return null;

    const renderContent = () => {
        if (loading) {
            return (
                <div className="flex items-center justify-center py-4">
                    <Spinner className="w-4 h-4" />
                    <span className="ml-2 text-xs text-surface-500">Cargando modelos...</span>
                </div>
            );
        }
        if (models.length === 0) {
            return <p className="px-4 py-3 text-xs text-surface-500">No se encontraron modelos disponibles</p>;
        }
        return models.map(m => (
            <button
                key={m.name}
                onClick={() => onSelect(m.name)}
                className={`w-full text-left px-4 py-2 text-xs flex items-center gap-2 transition-colors ${
                    m.name === currentModel
                        ? 'text-primary-400 bg-primary-500/10'
                        : 'text-surface-300 hover:bg-surface-700/50'
                }`}
            >
                {m.name === currentModel && (
                    <svg className="w-3 h-3 text-primary-400 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                )}
                <span className={m.name === currentModel ? '' : 'ml-5'}>{m.name}</span>
            </button>
        ));
    };

    return (
        <div className="border-t border-surface-700/50 bg-surface-900/50 max-h-48 overflow-y-auto">
            {renderContent()}
        </div>
    );
}

/* ------------------------------------------------------------------ */
/*  SVG icon helpers (keeps menu items readable)                       */
/* ------------------------------------------------------------------ */
const IconEye = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
const IconRefresh = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" /></svg>;
const IconDownload = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>;
const IconMail = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg>;
const IconTable = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 5.25h16.5m-16.5 4.5h16.5m-16.5 4.5h16.5m-16.5 4.5h16.5" /></svg>;
const IconCode = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" /></svg>;
const IconTrash = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>;
const IconSparkle = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" /></svg>;
const IconChevron = ({ rotated }: Readonly<{ rotated: boolean }>) => <svg className={`w-3.5 h-3.5 transition-transform ${rotated ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>;

/* ------------------------------------------------------------------ */
/*  Menu panel content (extracted to keep ActionsMenu under threshold) */
/* ------------------------------------------------------------------ */
function MenuPanel({ hasAnalysis, regenerating, downloading, deletingAnalysis, exportingCSV, exportingJSON, loadingPreview,
    onRegenerate, onDownloadPdf, onPreviewPdf, onEmail, onDownloadCSV, onDownloadJSON, onDeleteAnalysis, onSelectModel, onClose,
}: Readonly<{
    hasAnalysis: boolean; regenerating: boolean; downloading: boolean; deletingAnalysis: boolean;
    exportingCSV: boolean; exportingJSON: boolean; loadingPreview: boolean;
    onRegenerate: () => void; onDownloadPdf: () => void; onPreviewPdf: () => void; onEmail: () => void;
    onDownloadCSV: () => void; onDownloadJSON: () => void; onDeleteAnalysis: () => void;
    onSelectModel: (m: string) => void; onClose: () => void;
}>) {
    const [modelSubOpen, setModelSubOpen] = useState(false);
    const regenerateLabel = hasAnalysis ? 'Regenerar PDF' : 'Generar PDF';
    const deleteIcon = deletingAnalysis ? <Spinner color="border-red-400" /> : <IconTrash />;

    return (
        <div className="absolute right-0 top-full mt-2 w-64 bg-surface-800 border border-surface-700 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
            {/* Section: PDF */}
            <div className="px-3 pt-3 pb-1">
                <p className="text-[10px] font-semibold text-surface-500 uppercase tracking-wider">Reporte PDF</p>
            </div>
            <button onClick={() => { onClose(); onRegenerate(); }} disabled={regenerating} className="menu-item">
                <span className="menu-icon">{regenerating ? <Spinner /> : <IconRefresh />}</span>
                <span>{regenerating ? 'Generando...' : regenerateLabel}</span>
            </button>
            <button onClick={() => { onClose(); onPreviewPdf(); }} disabled={loadingPreview || !hasAnalysis} className="menu-item">
                <span className="menu-icon">{loadingPreview ? <Spinner /> : <IconEye />}</span>
                <span>{loadingPreview ? 'Cargando...' : 'Ver Informe'}</span>
            </button>
            <button onClick={() => { onClose(); onDownloadPdf(); }} disabled={downloading} className="menu-item">
                <span className="menu-icon">{downloading ? <Spinner /> : <IconDownload />}</span>
                <span>{downloading ? 'Descargando...' : 'Descargar PDF'}</span>
            </button>
            <button onClick={() => { onClose(); onEmail(); }} className="menu-item">
                <span className="menu-icon"><IconMail /></span>
                <span>Enviar por correo</span>
            </button>

            <div className="border-t border-surface-700 my-1" />

            {/* Section: Export */}
            <div className="px-3 pt-2 pb-1">
                <p className="text-[10px] font-semibold text-surface-500 uppercase tracking-wider">Exportar datos</p>
            </div>
            <button onClick={() => { onClose(); onDownloadCSV(); }} disabled={exportingCSV} className="menu-item">
                <span className="menu-icon"><IconTable /></span>
                <span>{exportingCSV ? 'Exportando...' : 'Descargar CSV'}</span>
            </button>
            <button onClick={() => { onClose(); onDownloadJSON(); }} disabled={exportingJSON} className="menu-item">
                <span className="menu-icon"><IconCode /></span>
                <span>{exportingJSON ? 'Exportando...' : 'Descargar JSON'}</span>
            </button>

            <div className="border-t border-surface-700 my-1" />

            {/* Section: IA */}
            <div className="px-3 pt-2 pb-1">
                <p className="text-[10px] font-semibold text-surface-500 uppercase tracking-wider">Inteligencia Artificial</p>
            </div>
            <button
                onClick={() => { onClose(); onDeleteAnalysis(); }}
                disabled={deletingAnalysis || regenerating || !hasAnalysis}
                className="menu-item text-red-400 hover:bg-red-500/10 disabled:text-surface-600"
            >
                <span className="menu-icon">{deleteIcon}</span>
                <span>{deletingAnalysis ? 'Eliminando...' : 'Eliminar Análisis'}</span>
            </button>

            {/* Model selector */}
            <div className="relative">
                <button onClick={() => setModelSubOpen(o => !o)} className="menu-item justify-between">
                    <span className="flex items-center gap-3">
                        <span className="menu-icon"><IconSparkle /></span>
                        <span>Seleccionar modelo IA</span>
                    </span>
                    <IconChevron rotated={modelSubOpen} />
                </button>
                <ModelSubmenu open={modelSubOpen} onSelect={(m) => { onSelectModel(m); setModelSubOpen(false); }} />
            </div>
            <div className="h-1" />
        </div>
    );
}

/* ------------------------------------------------------------------ */
/*  Dropdown actions menu                                              */
/* ------------------------------------------------------------------ */
function ActionsMenu(props: Readonly<{
    hasAnalysis: boolean; regenerating: boolean; downloading: boolean; deletingAnalysis: boolean;
    exportingCSV: boolean; exportingJSON: boolean; loadingPreview: boolean;
    onRegenerate: () => void; onDownloadPdf: () => void; onPreviewPdf: () => void; onEmail: () => void;
    onDownloadCSV: () => void; onDownloadJSON: () => void; onDeleteAnalysis: () => void;
    onSelectModel: (m: string) => void;
}>) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    return (
        <div className="relative" ref={ref}>
            <button
                onClick={() => setOpen(o => !o)}
                className="btn-secondary flex items-center gap-2 px-3 py-2"
                title="Opciones"
            >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
                </svg>
                <span className="hidden sm:inline text-sm">Opciones</span>
            </button>

            {open && <MenuPanel {...props} onClose={() => setOpen(false)} />}
        </div>
    );
}

/* ------------------------------------------------------------------ */
/*  Pillar score bar color                                             */
/* ------------------------------------------------------------------ */
function pillarBarColor(score: number): string {
    if (score < 1.5) return 'from-red-500 to-red-400';
    if (score < 2.5) return 'from-amber-500 to-amber-400';
    if (score < 3.5) return 'from-primary-500 to-primary-400';
    return 'from-emerald-500 to-emerald-400';
}

/* ------------------------------------------------------------------ */
/*  Main page component                                                */
/* ------------------------------------------------------------------ */
export default function ResultsPage() {
    const { id } = useParams<{ id: string }>();
    const [assessment, setAssessment] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!id) return;
        api.get(`/assessments/${id}`)
            .then(res => setAssessment(res.data))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [id]);

    const [downloading, setDownloading] = useState(false);
    const [exportingCSV, setExportingCSV] = useState(false);
    const [exportingJSON, setExportingJSON] = useState(false);
    const [regenerating, setRegenerating] = useState(false);
    const [deletingAnalysis, setDeletingAnalysis] = useState(false);
    const [pdfModalOpen, setPdfModalOpen] = useState(false);
    const [emailModalOpen, setEmailModalOpen] = useState(false);
    const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
    const [loadingPreview, setLoadingPreview] = useState(false);

    const buildSuggestedPdfName = () => {
        if (!assessment) return `Assessment_CSIA_${id}.pdf`;
        const clientName = (assessment.client?.name ?? 'Cliente')
            .normalize('NFD').replaceAll(/[\u0300-\u036f]/g, '')
            .replaceAll(/[^a-zA-Z0-9]/g, '_').replaceAll(/_+/g, '_').replaceAll(/^_|_$/g, '');
        const date = new Date(assessment.completedAt ?? assessment.createdAt);
        const dd   = String(date.getDate()).padStart(2, '0');
        const mm   = String(date.getMonth() + 1).padStart(2, '0');
        const aaaa = date.getFullYear();
        return `Assessment_CSIA_${clientName}_${assessment.type}_${dd}-${mm}-${aaaa}.pdf`;
    };

    const handlePreviewPdf = async () => {
        if (!id) return;
        setLoadingPreview(true);
        try {
            const res = await api.get(`/reports/${id}/pdf`, { responseType: 'blob' });
            if (res.headers['content-type']?.includes('application/json')) {
                const text = await (res.data as Blob).text();
                const json = JSON.parse(text);
                throw new Error(json.error || 'Server error');
            }
            const blob = new Blob([res.data], { type: 'application/pdf' });
            const url = globalThis.URL.createObjectURL(blob);
            setPdfPreviewUrl(url);
        } catch (err: any) {
            console.error('Error loading preview:', err);
            alert(err.message || 'Error al cargar la vista previa del PDF.');
        } finally {
            setLoadingPreview(false);
        }
    };

    const closePreview = () => {
        if (pdfPreviewUrl) {
            globalThis.URL.revokeObjectURL(pdfPreviewUrl);
            setPdfPreviewUrl(null);
        }
    };

    const handleRegenerateAnalysis = async () => {
        if (!id || regenerating) return;
        setRegenerating(true);
        try {
            await api.post(`/reports/${id}/regenerate-analysis`);
            const poll = setInterval(async () => {
                try {
                    const status = await api.get(`/reports/${id}/regenerate-status`);
                    if (status.data.status === 'done') {
                        clearInterval(poll);
                        const updated = await api.get(`/assessments/${id}`);
                        setAssessment(updated.data);
                        setRegenerating(false);
                        handlePreviewPdf();
                    }
                } catch (err) {
                    console.error('[LLM] Poll error:', err);
                    clearInterval(poll);
                    setRegenerating(false);
                }
            }, 10000);
        } catch {
            setRegenerating(false);
        }
    };

    const handleDeleteAnalysis = async () => {
        if (!id || !globalThis.confirm('¿Eliminar el análisis IA? Podrás regenerarlo después con otro modelo.')) return;
        setDeletingAnalysis(true);
        try {
            await api.delete(`/reports/${id}/llm-analysis`);
            setAssessment((prev: any) => ({ ...prev, llmAnalysis: null }));
        } catch {
            alert('Error al eliminar el análisis.');
        } finally {
            setDeletingAnalysis(false);
        }
    };

    const handleSelectModel = async (model: string) => {
        try {
            await api.post('/reports/llm-model', { model });
        } catch {
            alert('Error al cambiar el modelo.');
        }
    };

    const downloadBlob = async (
        endpoint: string,
        fallbackFilename: string,
        mimeType: string,
        setLoadingState: (v: boolean) => void
    ) => {
        setLoadingState(true);
        let filename = fallbackFilename;
        try {
            const res = await api.get(endpoint, { responseType: 'blob' });

            if (res.headers['content-type']?.includes('application/json')) {
                const text = await (res.data as Blob).text();
                const json = JSON.parse(text);
                throw new Error(json.error || 'Server error');
            }

            const disposition: string = res.headers['content-disposition'] ?? '';
            const filenameRe = /filename="([^"]+)"/;
            const reMatch = filenameRe.exec(disposition);
            filename = reMatch ? reMatch[1] : fallbackFilename;

            const blob = new Blob([res.data], { type: mimeType });
            const url = globalThis.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            setTimeout(() => {
                link.remove();
                globalThis.URL.revokeObjectURL(url);
            }, 3000);
        } catch (err: any) {
            console.error(`Error descargando ${filename}:`, err);
            if (err.response && err.response.data instanceof Blob) {
                try {
                    const text = await err.response.data.text();
                    const json = JSON.parse(text);
                    alert(`Error: ${json.error || 'Error desconocido'}`);
                    return;
                } catch (_e) { /* not JSON — fall through */ }
            }
            alert(err.message || `Error al descargar ${filename}.`);
        } finally {
            setLoadingState(false);
        }
    };

    const handleDownloadPDF = (customFilename?: string) =>
        downloadBlob(`/reports/${id}/pdf`, customFilename ?? buildSuggestedPdfName(), 'application/pdf', setDownloading);
    const handleDownloadCSV = () =>
        downloadBlob(`/reports/${id}/csv`, `assessment-export-${id}.csv`, 'text/csv', setExportingCSV);
    const handleDownloadJSON = () =>
        downloadBlob(`/reports/${id}/json`, `assessment-data-${id}.json`, 'application/json', setExportingJSON);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
            </div>
        );
    }

    if (!assessment) return <p className="text-surface-500">Evaluación no encontrada</p>;

    const riskCfg = RISK_CONFIG[assessment.riskLevel || 'MEDIUM'];
    const radarLabels = assessment.pillarScores?.map((ps: any) => ps.pillar.name) || [];
    const radarData = assessment.pillarScores?.map((ps: any) => ps.score) || [];
    const completedDate = assessment.completedAt ? new Date(assessment.completedAt).toLocaleDateString('es-ES') : 'N/A';

    return (
        <div className="max-w-4xl mx-auto space-y-6 fade-in">
            {/* Header */}
            <div className="flex items-start sm:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold text-surface-100">Resultados de Evaluación</h1>
                        {assessment.llmAnalysis && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                Informe generado
                            </span>
                        )}
                        {loadingPreview && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-primary-500/10 text-primary-400 border border-primary-500/20">
                                <Spinner className="w-3 h-3" />
                                Cargando vista previa…
                            </span>
                        )}
                    </div>
                    <p className="text-sm text-surface-500 mt-1">
                        {assessment.client?.name} · {assessment.type} · {completedDate}
                    </p>
                </div>
                <ActionsMenu
                    hasAnalysis={!!assessment.llmAnalysis}
                    regenerating={regenerating}
                    downloading={downloading}
                    deletingAnalysis={deletingAnalysis}
                    exportingCSV={exportingCSV}
                    exportingJSON={exportingJSON}
                    loadingPreview={loadingPreview}
                    onRegenerate={handleRegenerateAnalysis}
                    onDownloadPdf={() => setPdfModalOpen(true)}
                    onPreviewPdf={handlePreviewPdf}
                    onEmail={() => setEmailModalOpen(true)}
                    onDownloadCSV={handleDownloadCSV}
                    onDownloadJSON={handleDownloadJSON}
                    onDeleteAnalysis={handleDeleteAnalysis}
                    onSelectModel={handleSelectModel}
                />
            </div>

            <StatusBar
                regenerating={regenerating}
                downloading={downloading}
                exportingCSV={exportingCSV}
                exportingJSON={exportingJSON}
                deletingAnalysis={deletingAnalysis}
            />

            {/* Score Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="glass-card p-6 text-center">
                    <p className="text-xs font-medium text-surface-500 uppercase tracking-wider">Score General</p>
                    <p className="text-4xl font-bold text-surface-100 mt-2">{assessment.overallScore?.toFixed(2)}</p>
                    <p className="text-xs text-surface-500 mt-1">de 4.00</p>
                    <div className="mt-3 h-2 bg-surface-800 rounded-full overflow-hidden">
                        <div
                            className="h-full rounded-full bg-gradient-to-r from-primary-600 to-accent-cyan transition-all duration-1000"
                            style={{ width: `${(assessment.overallScore / 4) * 100}%` }}
                        />
                    </div>
                </div>

                <div className="glass-card p-6 text-center">
                    <p className="text-xs font-medium text-surface-500 uppercase tracking-wider">Nivel de Madurez</p>
                    <p className="text-4xl font-bold text-primary-400 mt-2">{assessment.maturityLevel}</p>
                    <p className="text-sm text-surface-400 mt-1 font-medium">
                        {MATURITY.find(m => m.level === assessment.maturityLevel)?.label}
                    </p>
                </div>

                <div className="glass-card p-6 text-center">
                    <p className="text-xs font-medium text-surface-500 uppercase tracking-wider">Nivel de Riesgo</p>
                    <p className={`text-2xl font-bold mt-2 ${riskCfg.color}`}>{riskCfg.label}</p>
                    <p className="text-xs text-surface-500 mt-2">{riskCfg.description}</p>
                </div>
            </div>

            {/* Radar Chart */}
            <div className="glass-card p-6">
                <h3 className="text-lg font-semibold text-surface-100 mb-4">Radar de Madurez por Pilar</h3>
                <div className="max-w-lg mx-auto">
                    <RadarChart
                        labels={radarLabels}
                        datasets={[{ label: assessment.client?.name || 'Evaluación', data: radarData }]}
                    />
                </div>
            </div>

            {/* Pillar Breakdown */}
            <div className="glass-card p-6">
                <h3 className="text-lg font-semibold text-surface-100 mb-4">Detalle por Pilar</h3>
                <div className="space-y-4">
                    {assessment.pillarScores?.map((ps: any) => {
                        const score = ps.score;
                        const barColor = pillarBarColor(score);
                        return (
                            <div key={ps.id} className="p-4 bg-surface-800/30 rounded-lg">
                                <div className="flex items-center justify-between mb-2">
                                    <h4 className="text-sm font-semibold text-surface-200">{ps.pillar.name}</h4>
                                    <span className="text-sm font-bold text-surface-200">{score.toFixed(2)} / 4.0</span>
                                </div>
                                <div className="h-3 bg-surface-800 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full bg-gradient-to-r ${barColor} transition-all duration-700`}
                                        style={{ width: `${(score / 4) * 100}%` }}
                                    />
                                </div>
                                <p className="text-xs text-surface-500 mt-1">
                                    {ps.answeredCount} de {ps.totalCount} preguntas respondidas
                                </p>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Maturity Scale */}
            <div className="glass-card p-6">
                <h3 className="text-lg font-semibold text-surface-100 mb-4">Escala de Madurez</h3>
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                    {MATURITY.map(m => (
                        <div
                            key={m.level}
                            className={`p-3 rounded-lg text-center border transition-all ${assessment.maturityLevel === m.level
                                ? 'border-primary-500/50 bg-primary-500/10 ring-1 ring-primary-500/20'
                                : 'border-surface-700/30 bg-surface-800/30'
                                }`}
                        >
                            <p className={`text-lg font-bold ${assessment.maturityLevel === m.level ? 'text-primary-400' : 'text-surface-400'}`}>
                                {m.level}
                            </p>
                            <p className="text-xs font-medium text-surface-300 mt-1">{m.label}</p>
                            <p className="text-[10px] text-surface-500 mt-0.5">{m.range}</p>
                        </div>
                    ))}
                </div>
            </div>

            <PdfDownloadModal
                isOpen={pdfModalOpen}
                suggestedName={buildSuggestedPdfName()}
                loading={downloading}
                onConfirm={(filename) => { setPdfModalOpen(false); handleDownloadPDF(filename); }}
                onClose={() => setPdfModalOpen(false)}
            />
            <EmailShareModal
                isOpen={emailModalOpen}
                assessment={assessment}
                onClose={() => setEmailModalOpen(false)}
            />

            {/* PDF Preview Modal */}
            {pdfPreviewUrl && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
                    <div className="w-full h-full max-w-5xl max-h-[90vh] m-4 flex flex-col glass-card overflow-hidden" style={{ background: 'var(--bg-card)' }}>
                        <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: 'var(--bg-card-border)' }}>
                            <div className="flex items-center gap-2">
                                <span className="badge-success">Informe generado</span>
                                <span className="text-sm font-medium" style={{ color: 'var(--text-base)' }}>Vista previa del informe PDF</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => { closePreview(); setPdfModalOpen(true); }}
                                    className="btn-primary px-3 py-1.5 text-sm flex items-center gap-1.5"
                                >
                                    <IconDownload /> Descargar
                                </button>
                                <button
                                    onClick={closePreview}
                                    className="p-2 rounded-lg transition-colors hover:bg-surface-700/50"
                                    style={{ color: 'var(--text-muted)' }}
                                    title="Cerrar"
                                >
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 bg-surface-900">
                            <iframe
                                src={pdfPreviewUrl}
                                className="w-full h-full border-0"
                                title="Vista previa PDF"
                                sandbox="allow-same-origin"
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
