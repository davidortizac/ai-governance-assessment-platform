import React, { useEffect, useState } from 'react';
import api from '../lib/api';

interface Client {
    id: string;
    name: string;
    industry: string | null;
    contactEmail: string | null;
    contactName: string | null;
    _count: { assessments: number };
    assessments: Array<{
        id: string;
        type: string;
        status: string;
        createdAt: string;
        createdBy: { id: string; name: string; email: string } | null;
    }>;
    createdAt: string;
}

export default function ClientsPage() {
    const [clients, setClients] = useState<Client[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingClient, setEditingClient] = useState<Client | null>(null);
    const [search, setSearch] = useState('');
    const [form, setForm] = useState({ name: '', industry: '', contactEmail: '', contactName: '' });

    const fetchClients = async () => {
        try {
            const params = search ? { search } : {};
            const res = await api.get('/clients', { params });
            setClients(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchClients(); }, [search]);

    const openCreate = () => {
        setEditingClient(null);
        setForm({ name: '', industry: '', contactEmail: '', contactName: '' });
        setShowModal(true);
    };

    const openEdit = (client: Client) => {
        setEditingClient(client);
        setForm({
            name: client.name,
            industry: client.industry || '',
            contactEmail: client.contactEmail || '',
            contactName: client.contactName || '',
        });
        setShowModal(true);
    };

    const handleSave = async () => {
        try {
            if (editingClient) {
                await api.put(`/clients/${editingClient.id}`, form);
            } else {
                await api.post('/clients', form);
            }
            setShowModal(false);
            fetchClients();
        } catch (err) {
            console.error(err);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Estás seguro de eliminar este cliente?')) return;
        try {
            await api.delete(`/clients/${id}`);
            fetchClients();
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div className="space-y-6 fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-surface-100">Clientes</h1>
                    <p className="text-sm text-surface-500 mt-1">Gestión de organizaciones evaluadas</p>
                </div>
                <button onClick={openCreate} className="btn-primary">
                    + Nuevo Cliente
                </button>
            </div>

            {/* Search */}
            <div className="max-w-md">
                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar clientes..."
                    className="input-field"
                />
            </div>

            {/* Table */}
            {loading ? (
                <div className="flex items-center justify-center h-32">
                    <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
                </div>
            ) : (
                <div className="glass-card overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-surface-700/50">
                                    <th className="text-left px-6 py-4 text-xs font-medium text-surface-500 uppercase tracking-wider">Nombre</th>
                                    <th className="text-left px-6 py-4 text-xs font-medium text-surface-500 uppercase tracking-wider">Industria</th>
                                    <th className="text-left px-6 py-4 text-xs font-medium text-surface-500 uppercase tracking-wider">Contacto</th>
                                    <th className="text-left px-6 py-4 text-xs font-medium text-surface-500 uppercase tracking-wider">Evaluador</th>
                                    <th className="text-center px-6 py-4 text-xs font-medium text-surface-500 uppercase tracking-wider">Evaluaciones</th>
                                    <th className="text-right px-6 py-4 text-xs font-medium text-surface-500 uppercase tracking-wider">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-surface-800/50">
                                {clients.map(client => (
                                    <tr key={client.id} className="hover:bg-surface-800/30 transition-colors">
                                        <td className="px-6 py-4">
                                            <p className="text-sm font-medium text-surface-200">{client.name}</p>
                                            <p className="text-xs text-surface-500">{client.contactEmail}</p>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-surface-400">{client.industry || '-'}</td>
                                        <td className="px-6 py-4 text-sm text-surface-400">{client.contactName || '-'}</td>
                                        <td className="px-6 py-4">
                                            {client.assessments?.[0]?.createdBy ? (
                                                <div>
                                                    <p className="text-sm text-surface-200">{client.assessments[0].createdBy.name}</p>
                                                    <p className="text-xs text-surface-500">{client.assessments[0].createdBy.email}</p>
                                                </div>
                                            ) : (
                                                <span className="text-sm text-surface-500">—</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="badge-info">{client._count.assessments}</span>
                                        </td>
                                        <td className="px-6 py-4 text-right space-x-2">
                                            <button onClick={() => openEdit(client)} className="text-xs text-primary-400 hover:text-primary-300">
                                                Editar
                                            </button>
                                            <button onClick={() => handleDelete(client.id)} className="text-xs text-red-400 hover:text-red-300">
                                                Eliminar
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {clients.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center text-surface-500">
                                            No se encontraron clientes
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="glass-card w-full max-w-lg p-6 fade-in">
                        <h3 className="text-lg font-semibold text-surface-100 mb-4">
                            {editingClient ? 'Editar Cliente' : 'Nuevo Cliente'}
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-surface-400 mb-1">Nombre *</label>
                                <input
                                    type="text"
                                    value={form.name}
                                    onChange={e => setForm({ ...form, name: e.target.value })}
                                    className="input-field"
                                    placeholder="Nombre de la organización"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-surface-400 mb-1">Industria</label>
                                <input
                                    type="text"
                                    value={form.industry}
                                    onChange={e => setForm({ ...form, industry: e.target.value })}
                                    className="input-field"
                                    placeholder="Tecnología, Banca, Salud..."
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-surface-400 mb-1">Email de contacto</label>
                                <input
                                    type="email"
                                    value={form.contactEmail}
                                    onChange={e => setForm({ ...form, contactEmail: e.target.value })}
                                    className="input-field"
                                    placeholder="contacto@empresa.com"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-surface-400 mb-1">Nombre del contacto</label>
                                <input
                                    type="text"
                                    value={form.contactName}
                                    onChange={e => setForm({ ...form, contactName: e.target.value })}
                                    className="input-field"
                                    placeholder="Nombre completo"
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-6">
                            <button onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button>
                            <button onClick={handleSave} className="btn-primary" disabled={!form.name}>Guardar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
