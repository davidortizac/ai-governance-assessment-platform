import React, { useState, useEffect } from 'react';

interface Props {
    isOpen: boolean;
    suggestedName: string;
    onConfirm: (filename: string) => void;
    onClose: () => void;
    loading?: boolean;
}

export default function PdfDownloadModal({ isOpen, suggestedName, onConfirm, onClose, loading }: Props) {
    const [filename, setFilename] = useState(suggestedName);

    useEffect(() => {
        if (isOpen) setFilename(suggestedName);
    }, [isOpen, suggestedName]);

    if (!isOpen) return null;

    const handleConfirm = () => {
        const name = filename.trim() || suggestedName;
        onConfirm(name.endsWith('.pdf') ? name : `${name}.pdf`);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="glass-card w-full max-w-md p-6 mx-4 shadow-2xl" style={{ background: 'var(--bg-card)' }}>
                <h2 className="text-lg font-semibold mb-1" style={{ color: 'var(--text-base)' }}>
                    Descargar Informe PDF
                </h2>
                <p className="text-xs mb-5" style={{ color: 'var(--text-muted)' }}>
                    Puedes personalizar el nombre del archivo antes de descargarlo.
                </p>

                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    Nombre del archivo
                </label>
                <input
                    type="text"
                    value={filename}
                    onChange={e => setFilename(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !loading && handleConfirm()}
                    className="input-field w-full text-sm mb-5"
                    placeholder={suggestedName}
                    autoFocus
                />

                <div className="flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        disabled={loading}
                        className="px-4 py-2 text-sm rounded-lg transition-colors"
                        style={{ color: 'var(--text-muted)', border: '1px solid var(--sidebar-border)' }}
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={loading}
                        className="btn-primary px-4 py-2 text-sm flex items-center gap-2"
                    >
                        {loading
                            ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Descargando…</>
                            : '⬇ Descargar'
                        }
                    </button>
                </div>
            </div>
        </div>
    );
}
