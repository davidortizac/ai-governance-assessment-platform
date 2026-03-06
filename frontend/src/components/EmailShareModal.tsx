import React, { useState, useEffect, useRef } from 'react';
import api from '../lib/api';

interface AssessmentMeta {
    id: string;
    type: string;
    completedAt?: string | null;
    createdAt: string;
    client: { name: string; contactEmail?: string | null };
}

interface Props {
    isOpen: boolean;
    assessment: AssessmentMeta;
    onClose: () => void;
}

function buildSuggestedFilename(assessment: AssessmentMeta): string {
    const clientName = assessment.client.name
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
    const date = new Date(assessment.completedAt ?? assessment.createdAt);
    const dd   = String(date.getDate()).padStart(2, '0');
    const mm   = String(date.getMonth() + 1).padStart(2, '0');
    const aaaa = date.getFullYear();
    return `Assessment_CSIA_${clientName}_${assessment.type}_${dd}-${mm}-${aaaa}.pdf`;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function EmailShareModal({ isOpen, assessment, onClose }: Props) {
    const [recipients, setRecipients]   = useState<string[]>([]);
    const [inputVal, setInputVal]       = useState('');
    const [filename, setFilename]       = useState('');
    const [message, setMessage]         = useState('');
    const [sending, setSending]         = useState(false);
    const [toast, setToast]             = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!isOpen) return;
        const initial: string[] = [];
        if (assessment.client.contactEmail) initial.push(assessment.client.contactEmail);
        setRecipients(initial);
        setInputVal('');
        setFilename(buildSuggestedFilename(assessment));
        setMessage('');
        setToast(null);
    }, [isOpen, assessment]);

    if (!isOpen) return null;

    const addEmail = (raw: string) => {
        const emails = raw.split(/[\s,;]+/).map(e => e.trim()).filter(Boolean);
        const valid  = emails.filter(e => EMAIL_RE.test(e) && !recipients.includes(e));
        if (valid.length) setRecipients(prev => [...prev, ...valid]);
        setInputVal('');
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (['Enter', ',', ';', ' '].includes(e.key)) {
            e.preventDefault();
            addEmail(inputVal);
        } else if (e.key === 'Backspace' && inputVal === '' && recipients.length > 0) {
            setRecipients(prev => prev.slice(0, -1));
        }
    };

    const removeRecipient = (email: string) => setRecipients(prev => prev.filter(e => e !== email));

    const handleSend = async () => {
        const allRecipients = inputVal.trim()
            ? [...recipients, ...inputVal.split(/[\s,;]+/).map(e => e.trim()).filter(e => EMAIL_RE.test(e))]
            : recipients;

        if (allRecipients.length === 0) {
            setToast({ type: 'err', text: 'Agrega al menos un destinatario.' });
            return;
        }

        setSending(true);
        setToast(null);
        try {
            await api.post(`/reports/${assessment.id}/send-email`, {
                recipients: allRecipients,
                filename: filename.trim() || buildSuggestedFilename(assessment),
                extraMessage: message.trim() || undefined,
            });
            setToast({ type: 'ok', text: `Informe enviado a ${allRecipients.join(', ')}` });
            setTimeout(onClose, 2500);
        } catch (err: any) {
            const msg = err?.response?.data?.error ?? 'Error al enviar el correo.';
            setToast({ type: 'err', text: msg });
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="glass-card w-full max-w-lg p-6 mx-4 shadow-2xl" style={{ background: 'var(--bg-card)' }}>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold" style={{ color: 'var(--text-base)' }}>
                        Compartir Informe por Correo
                    </h2>
                    <button onClick={onClose} className="text-xl leading-none" style={{ color: 'var(--text-muted)' }}>×</button>
                </div>

                {/* Recipients */}
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    Destinatarios
                </label>
                <div
                    className="input-field min-h-[44px] flex flex-wrap gap-1.5 p-2 cursor-text mb-4"
                    onClick={() => inputRef.current?.focus()}
                >
                    {recipients.map(email => (
                        <span key={email} className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-primary-500/15 text-primary-400 border border-primary-500/25">
                            {email}
                            <button type="button" onClick={() => removeRecipient(email)} className="hover:text-red-400 transition-colors leading-none">×</button>
                        </span>
                    ))}
                    <input
                        ref={inputRef}
                        type="email"
                        value={inputVal}
                        onChange={e => setInputVal(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onBlur={() => inputVal && addEmail(inputVal)}
                        placeholder={recipients.length === 0 ? 'correo@empresa.com, otro@empresa.com' : ''}
                        className="flex-1 min-w-[180px] bg-transparent outline-none text-sm"
                        style={{ color: 'var(--text-base)' }}
                    />
                </div>

                {/* Filename */}
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    Nombre del archivo adjunto
                </label>
                <input
                    type="text"
                    value={filename}
                    onChange={e => setFilename(e.target.value)}
                    className="input-field w-full text-sm mb-4"
                />

                {/* Optional message */}
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    Mensaje adicional <span className="font-normal opacity-60">(opcional)</span>
                </label>
                <textarea
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    rows={3}
                    className="input-field w-full text-sm mb-5 resize-none"
                    placeholder="Mensaje personalizado que se incluirá en el correo…"
                />

                {/* Toast */}
                {toast && (
                    <div className={`text-xs px-3 py-2 rounded-lg mb-4 ${toast.type === 'ok' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                        {toast.text}
                    </div>
                )}

                <div className="flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        disabled={sending}
                        className="px-4 py-2 text-sm rounded-lg transition-colors"
                        style={{ color: 'var(--text-muted)', border: '1px solid var(--sidebar-border)' }}
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSend}
                        disabled={sending}
                        className="btn-primary px-4 py-2 text-sm flex items-center gap-2"
                    >
                        {sending
                            ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Enviando…</>
                            : '✉ Enviar Informe'
                        }
                    </button>
                </div>
            </div>
        </div>
    );
}
