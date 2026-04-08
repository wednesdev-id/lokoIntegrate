import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Download, Loader2 } from 'lucide-react';
import adminService from '../services/admin.service';
import { MasterDataContactResponse } from '../types/admin';

const MasterDataContact = () => {
    const [contacts, setContacts] = useState<MasterDataContactResponse[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(true);

    // Filters
    const [search, setSearch] = useState('');
    const [sessionId, setSessionId] = useState('');
    const [sessionCode, setSessionCode] = useState('');
    const [page, setPage] = useState(1);
    const [limit] = useState(20);
    const [total, setTotal] = useState(0);

    const observerRef = useRef<IntersectionObserver | null>(null);
    const lastElementRef = useRef<HTMLTableRowElement | null>(null);

    const fetchContacts = async (pageNum: number, append: boolean = false) => {
        if (append) {
            setLoadingMore(true);
        } else {
            setLoading(true);
            setError(null);
        }

        try {
            const response = await adminService.getMasterDataContacts({
                page: pageNum,
                limit,
                search: search || undefined,
                session_id: sessionId || undefined,
                session_code: sessionCode || undefined,
            });

            if (response.success) {
                const newContacts = response.data || [];
                if (append) {
                    setContacts(prev => [...prev, ...newContacts]);
                } else {
                    setContacts(newContacts);
                }
                if (response.pagination) {
                    setTotal(response.pagination.total);
                    setHasMore(pageNum < response.pagination.total_pages);
                }
            } else {
                setError(response.message || 'Gagal memuat data kontak');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Terjadi kesalahan sistem');
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    };

    // Initial load and filter changes
    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            setPage(1);
            setContacts([]);
            setHasMore(true);
            fetchContacts(1, false);
        }, 500); // Debounce search

        return () => clearTimeout(delayDebounceFn);
    }, [search, sessionId, sessionCode]);

    // Load more when page changes
    useEffect(() => {
        if (page > 1) {
            fetchContacts(page, true);
        }
    }, [page]);

    // Intersection Observer for lazy loading
    const handleObserver = useCallback((entries: IntersectionObserverEntry[]) => {
        const [entry] = entries;
        if (entry.isIntersecting && hasMore && !loadingMore && !loading) {
            setPage(prev => prev + 1);
        }
    }, [hasMore, loadingMore, loading]);

    useEffect(() => {
        if (observerRef.current) {
            observerRef.current.disconnect();
        }

        observerRef.current = new IntersectionObserver(handleObserver, {
            rootMargin: '100px',
        });

        if (lastElementRef.current) {
            observerRef.current.observe(lastElementRef.current);
        }

        return () => {
            if (observerRef.current) {
                observerRef.current.disconnect();
            }
        };
    }, [handleObserver, contacts]);

    const handleExport = async () => {
        try {
            const blob = await adminService.exportMasterDataContacts({
                search: search || undefined,
                session_id: sessionId || undefined,
                session_code: sessionCode || undefined,
            });

            const url = window.URL.createObjectURL(new Blob([blob]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `contacts_export_${new Date().getTime()}.csv`);
            document.body.appendChild(link);
            link.click();
            link.parentNode?.removeChild(link);
        } catch (err) {
            alert('Gagal mengekspor data: ' + (err instanceof Error ? err.message : 'Kesalahan sistem'));
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Master Data Kontak</h1>
                    <p className="text-sm text-gray-500 mt-1">Kelola dan ekspor semua kontak pelanggan yang terhubung.</p>
                </div>
                <div className="mt-4 md:mt-0">
                    <button
                        onClick={handleExport}
                        className="inline-flex items-center px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                    >
                        <Download className="h-4 w-4 mr-2" />
                        Ekspor CSV
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl shadow-sm p-4 mb-6 border border-gray-100 flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                        type="text"
                        placeholder="Cari nama atau nomor telepon..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                    />
                </div>
                <div className="w-full md:w-64">
                    <input
                        type="text"
                        placeholder="Filter Session ID"
                        value={sessionId}
                        onChange={(e) => setSessionId(e.target.value)}
                        className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                    />
                </div>
                <div className="w-full md:w-64">
                    <input
                        type="text"
                        placeholder="Validate Session Code"
                        value={sessionCode}
                        onChange={(e) => setSessionCode(e.target.value)}
                        className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                    />
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-6 text-sm">
                    {error}
                </div>
            )}

            {/* Table Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                {loading && contacts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12">
                        <Loader2 className="h-8 w-8 text-primary-600 animate-spin" />
                        <p className="text-sm text-gray-500 mt-2">Memuat data...</p>
                    </div>
                ) : contacts.length === 0 ? (
                    <div className="text-center py-12">
                        <p className="text-gray-500 text-sm">Tidak ada kontak ditemukan.</p>
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto max-h-[calc(100vh-400px)] overflow-y-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50 sticky top-0 z-10">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nama</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">No Telepon</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pelanggan</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Session ID</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dibuat Pada</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {contacts.map((contact, index) => (
                                        <tr
                                            key={contact.id}
                                            ref={index === contacts.length - 1 ? lastElementRef : null}
                                            className="hover:bg-gray-50 transition-colors"
                                        >
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center">
                                                    <div className="h-8 w-8 rounded-full bg-primary-50 flex items-center justify-center text-primary-600 font-medium text-xs">
                                                        {contact.name ? contact.name[0].toUpperCase() : '?'}
                                                    </div>
                                                    <div className="ml-3">
                                                        <div className="text-sm font-medium text-gray-900">{contact.name || 'Unknown'}</div>
                                                        <div className="text-xs text-gray-500">{contact.jid}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {contact.phone_number}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                                                {contact.user_name || '-'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-gray-500 font-mono text-xs">
                                                {contact.session_id}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {new Date(contact.created_at).toLocaleDateString('id-ID', {
                                                    year: 'numeric',
                                                    month: 'short',
                                                    day: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Loading More Indicator */}
                        {loadingMore && (
                            <div className="flex items-center justify-center py-4 border-t border-gray-100">
                                <Loader2 className="h-5 w-5 text-primary-600 animate-spin mr-2" />
                                <span className="text-sm text-gray-500">Memuat lebih banyak...</span>
                            </div>
                        )}

                        {/* Footer Info */}
                        <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
                            <p className="text-sm text-gray-500">
                                Menampilkan <span className="font-medium">{contacts.length}</span> dari <span className="font-medium">{total}</span> kontak
                                {hasMore && ' (scroll untuk memuat lebih banyak)'}
                            </p>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default MasterDataContact;
