'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { fetchClayTables, fetchTableLeads } from './actions';
import { toast } from 'sonner';
import Loader from '@/components/loader/Loader';
import { supabase } from '@/lib/supabase';

interface ClayTable {
    id: number;
    clay_table_name: string;
    clay_table_id: string | null;
    total_leads: number;
    split_count: number;
    enriched_count: number;
    new_count: number;
}

interface Lead {
    id: number;
    schema: any;
    status: string;
    last_enriched_at: string;
    last_enriched_source: string;
}

interface Column {
    id: number;
    column_name: string;
    column_order: number;
    column_type: string;
    column_raw_name: string;
}

export default function SplitsPage() {
    const params = useParams();
    const router = useRouter();
    const listId = Number(params.listId);

    const [tables, setTables] = useState<ClayTable[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedTable, setSelectedTable] = useState<ClayTable | null>(null);
    const [leads, setLeads] = useState<Lead[]>([]);
    const [isLoadingLeads, setIsLoadingLeads] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(20);
    const [totalPages, setTotalPages] = useState(1);
    const [totalLeads, setTotalLeads] = useState(0);

    const [columns, setColumns] = useState<Column[]>([]);

    useEffect(() => {
        loadTables();
        grabSchema(listId);
    }, [listId]);

    async function loadTables() {
        setIsLoading(true);
        const result = await fetchClayTables(listId);

        if (!result.success) {
            toast.error('Failed to load split tables');
            setIsLoading(false);
            return;
        }

        setTables(result.data || []);
        setIsLoading(false);
    }

    async function loadLeads(tableId: number, page: number = 1, customRowsPerPage?: number) {
        setIsLoadingLeads(true);
        const effectiveRowsPerPage = customRowsPerPage ?? rowsPerPage;
        const result = await fetchTableLeads(tableId, page, effectiveRowsPerPage);

        if (!result.success) {
            toast.error('Failed to load leads');
            setIsLoadingLeads(false);
            return;
        }

        setLeads(result.data?.leads || []);
        setTotalPages(result.data?.totalPages || 1);
        setTotalLeads(result.data?.total || 0);
        setCurrentPage(page);
        setIsLoadingLeads(false);
    }

    function handleViewLeads(table: ClayTable) {
        setSelectedTable(table);
        setCurrentPage(1);
        loadLeads(table.id, 1);
    }

    function handleCloseModal() {
        setSelectedTable(null);
        setLeads([]);
        setCurrentPage(1);
    }

    function handlePageChange(newPage: number) {
        if (selectedTable) {
            loadLeads(selectedTable.id, newPage);
        }
    }

    function handleRowsPerPageChange(newRowsPerPage: number) {
        setRowsPerPage(newRowsPerPage);
        setCurrentPage(1);
        if (selectedTable) {
            loadLeads(selectedTable.id, 1, newRowsPerPage);
        }
    }

    function handleDownloadCSV(tableId: number) {
        const url = `/leads/${listId}/splits/download?clayTableId=${tableId}`;
        window.open(url, '_blank');
    }

    async function grabSchema(listId: number) {
        const { data: cols } = await supabase
            .from('columns')
            .select('*')
            .eq('list_id', listId)
            .order('column_order', { ascending: true });

        setColumns(cols || []);
    }

    function flattenSchema(schema: any): Record<string, any> {
        const flattened: Record<string, any> = {};

        columns.forEach(col => {
            let value = '';

            if (col.column_type === 'schema') {
                value = schema[col.column_name];
            } else if (col.column_type === 'extra_field') {
                value = schema.extra_fields?.[col.column_name];
            } else if (col.column_type === 'internal_enrichment') {
                value = schema.internal_enrichment?.[col.column_name];
            } else if (col.column_type === 'external_enrichment') {
                value = schema.external_enrichment?.[col.column_name];
            }

            flattened[col.column_name] = value;
        });

        return flattened;
    }

    const totalTables = tables.length;
    const totalLeadsAcrossAll = tables.reduce((sum, t) => sum + t.total_leads, 0);
    const totalEnriched = tables.reduce((sum, t) => sum + t.enriched_count, 0);
    const totalSplit = tables.reduce((sum, t) => sum + t.split_count, 0);
    const enrichedPercent = totalLeadsAcrossAll > 0 ? (totalEnriched / totalLeadsAcrossAll) * 100 : 0;

    if (isLoading) {
        return <Loader />;
    }

    return (
        <div className="flex flex-col bg-[#0a0a0a] overflow-hidden" style={{ height: 'calc(100vh - 61px)' }}>
            <div className="flex-1 overflow-y-auto p-6 text-white">
                <div className="max-w-6xl mx-auto w-full">
                    {/* Header */}
                    <div className="mb-6">
                        <button
                            onClick={() => router.back()}
                            className="flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            Back to List
                        </button>
                        <h1 className="text-3xl font-bold">Split Tables</h1>
                    </div>

                    {/* Summary Card */}
                    <div className="bg-[#1a1a1a] p-6 rounded-lg shadow-lg mb-6">
                        <h2 className="text-xl font-semibold mb-4">Overview</h2>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                            <div>
                                <p className="text-gray-400 text-sm">Total Tables</p>
                                <p className="text-2xl font-bold">{totalTables}</p>
                            </div>
                            <div>
                                <p className="text-gray-400 text-sm">Total Leads</p>
                                <p className="text-2xl font-bold">{totalLeadsAcrossAll}</p>
                            </div>
                            <div>
                                <p className="text-gray-400 text-sm">Split</p>
                                <p className="text-2xl font-bold text-blue-400">{totalSplit}</p>
                            </div>
                            <div>
                                <p className="text-gray-400 text-sm">Enriched</p>
                                <p className="text-2xl font-bold text-green-400">{totalEnriched}</p>
                            </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="mt-4">
                            <div className="flex justify-between text-sm mb-2">
                                <span className="text-gray-400">Enrichment Progress</span>
                                <span className="font-semibold">{enrichedPercent.toFixed(1)}%</span>
                            </div>
                            <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
                                <div
                                    className="h-full bg-green-500 transition-all duration-500"
                                    style={{ width: `${enrichedPercent}%` }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Tables Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {tables.map((table) => {
                            const tableEnrichedPercent = table.total_leads > 0
                                ? (table.enriched_count / table.total_leads) * 100
                                : 0;

                            return (
                                <div key={table.id} className="bg-[#1a1a1a] p-6 rounded-lg shadow-lg">
                                    <h3 className="text-lg font-semibold mb-3">{table.clay_table_name}</h3>

                                    <div className="grid grid-cols-3 gap-2 mb-4 text-sm">
                                        <div>
                                            <p className="text-gray-400">Total</p>
                                            <p className="font-bold">{table.total_leads}</p>
                                        </div>
                                        <div>
                                            <p className="text-gray-400">Split</p>
                                            <p className="font-bold text-blue-400">{table.split_count}</p>
                                        </div>
                                        <div>
                                            <p className="text-gray-400">Enriched</p>
                                            <p className="font-bold text-green-400">{table.enriched_count}</p>
                                        </div>
                                    </div>

                                    {/* Progress Bar */}
                                    <div className="mb-4">
                                        <div className="flex justify-between text-xs mb-1">
                                            <span className="text-gray-400">Progress</span>
                                            <span>{tableEnrichedPercent.toFixed(1)}%</span>
                                        </div>
                                        <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                                            <div
                                                className="h-full bg-green-500 transition-all duration-500"
                                                style={{ width: `${tableEnrichedPercent}%` }}
                                            />
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleViewLeads(table)}
                                            className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition"
                                        >
                                            View Leads
                                        </button>
                                        <button
                                            onClick={() => handleDownloadCSV(table.id)}
                                            className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 rounded-lg transition"
                                        >
                                            Download CSV
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Modal for viewing leads */}
                    {selectedTable && (
                        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 overflow-hidden">
                            <div className="bg-[#1a1a1a] rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] flex flex-col">
                                {/* Modal Header */}
                                <div className="p-6 border-b border-gray-700 flex justify-between items-center flex-shrink-0">
                                    <h2 className="text-2xl font-bold">{selectedTable.clay_table_name}</h2>
                                    <button
                                        onClick={handleCloseModal}
                                        className="text-gray-400 hover:text-white transition"
                                    >
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>

                                {/* Modal Body */}
                                <div className="flex-1 overflow-y-auto p-6">
                                    {isLoadingLeads ? (
                                        <div className="flex justify-center items-center h-64">
                                            <div className="animate-spin h-8 w-8 border-4 border-purple-500 border-t-transparent rounded-full" />
                                        </div>
                                    ) : (
                                        <>
                                            {/* Pagination Controls */}
                                            <div className="flex justify-between items-center mb-4 flex-shrink-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm text-gray-400">Rows per page:</span>
                                                    <select
                                                        value={rowsPerPage}
                                                        onChange={(e) => handleRowsPerPageChange(Number(e.target.value))}
                                                        className="bg-gray-800 border border-gray-700 rounded px-3 py-1 text-sm text-white"
                                                    >
                                                        <option value={20}>20</option>
                                                        <option value={100}>100</option>
                                                        <option value={1000}>1000</option>
                                                    </select>
                                                </div>
                                                <div className="text-sm text-gray-400">
                                                    Showing {((currentPage - 1) * rowsPerPage) + 1} - {Math.min(currentPage * rowsPerPage, totalLeads)} of {totalLeads}
                                                </div>
                                            </div>

                                            {/* Table */}
                                            <div className="overflow-x-auto border border-gray-700 rounded-lg">
                                                <table className="w-full text-sm">
                                                    <thead className="bg-gray-800 sticky top-0">
                                                        <tr>
                                                            <th className="px-4 py-2 text-left">Status</th>
                                                            <th className="px-4 py-2 text-left">Last Enriched At</th>
                                                            <th className="px-4 py-2 text-left">Last Enriched Source</th>
                                                            {leads.length > 0 && columns.map(col => (
                                                                <th key={col.id} className="px-4 py-2 text-left">{col.column_raw_name}</th>
                                                            ))}
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {leads.map((lead, idx) => {
                                                            const flattened = flattenSchema(lead.schema);
                                                            return (
                                                                <tr key={lead.id} className={idx % 2 === 0 ? 'bg-gray-900' : 'bg-gray-800'}>
                                                                    <td className="px-4 py-2">
                                                                        <span className={`px-2 py-1 rounded text-xs ${lead.status === 'enriched' ? 'bg-green-900 text-green-400' :
                                                                            lead.status === 'split' ? 'bg-blue-900 text-blue-400' :
                                                                                'bg-gray-700 text-gray-400'
                                                                            }`}>
                                                                            {lead.status || 'new'}
                                                                        </span>
                                                                    </td>
                                                                    <td className="px-4 py-2">
                                                                        {lead.last_enriched_at ? new Date(lead.last_enriched_at).toLocaleString() : 'N/A'}
                                                                    </td>
                                                                    <td className="px-4 py-2">
                                                                        {lead.last_enriched_source || 'Not Enriched'}
                                                                    </td>
                                                                    {columns.map(col => (
                                                                        <td key={col.id} className="px-4 py-2 max-w-xs truncate">
                                                                            {String(flattened[col.column_name] || '')}
                                                                        </td>
                                                                    ))}
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>

                                            {/* Pagination */}
                                            <div className="flex justify-center items-center gap-2 mt-4 flex-shrink-0">
                                                <button
                                                    onClick={() => handlePageChange(currentPage - 1)}
                                                    disabled={currentPage === 1}
                                                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed transition"
                                                >
                                                    Previous
                                                </button>
                                                <span className="text-sm text-gray-400">
                                                    Page {currentPage} of {totalPages}
                                                </span>
                                                <button
                                                    onClick={() => handlePageChange(currentPage + 1)}
                                                    disabled={currentPage === totalPages}
                                                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed transition"
                                                >
                                                    Next
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div >
    );
}
