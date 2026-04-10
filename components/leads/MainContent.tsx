'use client';

import { useEffect, useState } from 'react';
import { useListStore } from '@/stores/listStore';
import { toast } from 'sonner';
import Loader from '@/components/loader/Loader';
import Link from 'next/link';
import { startLeadImport, fetchListDetails, updateLeadSplit, updateListStatus, startLeadSplitting } from '@/app/(dashboard)/leads/actions';
import { fetchLeadProgress } from '@/app/(dashboard)/leads/[listId]/splits/actions';

export default function MainContent() {
    const { lists, activeListId, updateList } = useListStore();
    const [isImporting, setIsImporting] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [leadSplitInput, setLeadSplitInput] = useState<string>('');
    const [isUpdatingLeadSplit, setIsUpdatingLeadSplit] = useState(false);
    const [isEditingLeadSplit, setIsEditingLeadSplit] = useState(false);
    const [isStartingClayUpload, setIsStartingClayUpload] = useState(false);
    const [progressData, setProgressData] = useState<{
        new_count: number;
        split_count: number;
        enriched_count: number;
        total_count: number;
    } | null>(null);
    const activeList = lists?.find((list) => list.id === activeListId);

    // Fetch list details when a list is selected
    useEffect(() => {
        if (!activeListId) return;
        handleFetchListDetails();
    }, [activeListId]);

    async function handleFetchListDetails() {
        if (!activeListId) return;

        try {
            const result = await fetchListDetails(activeListId);

            if (!result.success) {
                console.error('Error fetching list details:');
                return;
            }

            if (result.data) {
                updateList(activeListId, result.data);

                // Load progress if status is leads_split_complete
                if (result.data.status === 'leads_split_complete') {
                    loadProgress();
                }
            }
        } catch (error) {
            console.error('Unexpected error fetching list:', error);
        }
    }

    async function loadProgress() {
        if (!activeListId) return;

        const result = await fetchLeadProgress(activeListId);
        if (result.success && result.data) {
            setProgressData(result.data);
        }
    }

    async function handleRefresh() {
        setIsRefreshing(true);
        await handleFetchListDetails();
        toast.success('List details refreshed');
        setIsRefreshing(false);
    }

    async function handleStartImport() {
        if (!activeList) return;

        // Show immediate feedback
        toast.success('Import started successfully!');
        setIsImporting(true);

        // Call the Edge Function in the background without waiting
        startLeadImport(activeList.id)
            .then((result) => {
                if (!result.success) {
                    console.error('Import error:', result.error);
                    toast.error('Import failed to start: ' + result.error);
                } else {
                    console.log('Import Edge Function called successfully');
                }
            })
            .catch((error) => {
                console.error('Unexpected error calling import:', error);
            });

        // Update the list status immediately
        setTimeout(() => {
            setIsImporting(false);
            handleFetchListDetails();
        }, 1000);
    }

    async function handleUpdateLeadSplit() {
        if (!activeList || !leadSplitInput) return;

        const leadSplitValue = parseInt(leadSplitInput);
        if (isNaN(leadSplitValue) || leadSplitValue <= 0) {
            toast.error('Please enter a valid positive number');
            return;
        }

        // Validate: lead_split must be <= total_leads
        if (activeList.total_leads && leadSplitValue > activeList.total_leads) {
            toast.error(`Lead split cannot exceed total leads (${activeList.total_leads})`);
            return;
        }

        setIsUpdatingLeadSplit(true);

        try {
            const result = await updateLeadSplit(activeList.id, leadSplitValue);

            if (!result.success) {
                toast.error('Failed to update lead split: ' + result.error);
                setIsUpdatingLeadSplit(false);
                return;
            }

            // Update status to split_configured
            const statusResult = await updateListStatus(activeList.id, 'split_configured');

            if (!statusResult.success) {
                toast.error('Failed to update status');
            }

            // Update local state with both lead_split and status
            updateList(activeList.id, {
                lead_split: leadSplitValue,
                status: 'split_configured'
            });

            toast.success('Lead split configured successfully!');
            setLeadSplitInput('');
            setIsEditingLeadSplit(false);
        } catch (error) {
            console.error('Unexpected error updating lead split:', error);
            toast.error('An unexpected error occurred');
        } finally {
            setIsUpdatingLeadSplit(false);
        }
    }

    async function handleStartClayUpload() {
        if (!activeList) return;

        setIsStartingClayUpload(true);

        try {
            // Call the edge function via server action
            const result = await startLeadSplitting(activeList.id);

            if (!result.success) {
                toast.error('Failed to start lead splitting: ' + result.error);
                await updateListStatus(activeList.id, 'lead_split_failed');
                // Update local state to show failed status
                updateList(activeList.id, {
                    status: 'lead_split_failed',
                    error: result.error
                });
                setIsStartingClayUpload(false);
                return;
            }

            // Update local state to splitting_leads (edge function will update to leads_split_complete)
            updateList(activeList.id, { status: 'splitting_leads' });
            toast.success('Lead splitting started!');

            // Poll for completion (refresh after a delay)
            setTimeout(async () => {
                await handleFetchListDetails();
                setIsStartingClayUpload(false);

                // Check if completed successfully
                const updatedList = lists.find(l => l.id === activeList.id);
                if (updatedList?.status === 'leads_split_complete') {
                    const clayTablesCount = result.data?.created?.length || 0;
                    toast.success(`Lead splitting completed! Created ${clayTablesCount} split tables.`);
                } else if (updatedList?.status === 'lead_split_failed') {
                    toast.error('Lead splitting failed: ' + updatedList.error);
                }
            }, 3000);
        } catch (error) {
            console.error('Unexpected error starting lead splitting:', error);
            toast.error('An unexpected error occurred');

            // Update DB status to failed
            await updateListStatus(activeList.id, 'lead_split_failed');

            // Update local state
            updateList(activeList.id, {
                status: 'lead_split_failed',
                error: 'An unexpected error occurred'
            });

            setIsStartingClayUpload(false);
        }
    }

    if (!activeList) {
        return (
            <div className="flex items-center justify-center h-full">
                <p className="text-gray-400">No list selected</p>
            </div>
        );
    }

    const progress = activeList.total_leads
        ? ((activeList.leads_processed || 0) / activeList.total_leads) * 100
        : 0;

    const isCompleted = activeList.status === 'completed';
    const isFailed = activeList.status === 'import failed';
    const isProcessing = activeList.status === 'processing';

    return (
        <div className="flex flex-col p-6 text-white" style={{ height: 'calc(100vh - 61px)' }}>
            {(isImporting || isRefreshing) && <Loader />}

            <div className="max-w-3xl mx-auto w-full">
                {/* Header with Refresh Button */}
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-3xl font-bold">{activeList.name}</h1>
                    <button
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                        className="cursor-pointer flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <svg
                            className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                            />
                        </svg>
                        {isRefreshing ? 'Refreshing...' : 'Refresh'}
                    </button>
                </div>

                {/* List Metadata */}
                <div className="bg-[#1a1a1a] p-6 rounded-lg shadow-lg mb-6">
                    <h2 className="text-xl font-semibold mb-4">List Details</h2>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <p className="text-gray-400">Total Leads</p>
                            <p className="text-2xl font-bold">{activeList.total_leads || 0}</p>
                        </div>
                        <div>
                            <p className="text-gray-400">Leads Processed</p>
                            <p className="text-2xl font-bold">{activeList.leads_processed || 0}</p>
                        </div>
                        <div>
                            <p className="text-gray-400">Status</p>
                            <p className={`text-lg font-semibold ${isCompleted ? 'text-green-500' :
                                isFailed ? 'text-red-500' :
                                    isProcessing ? 'text-yellow-500' :
                                        'text-blue-500'
                                }`}>
                                {activeList.status || 'uploaded'}
                            </p>
                        </div>
                        <div>
                            <p className="text-gray-400">File Path</p>
                            <p className="text-sm truncate">{activeList.filepath || 'N/A'}</p>
                        </div>
                    </div>

                    {/* Progress Bar */}
                    {activeList.total_leads && activeList.total_leads > 0 && (
                        <div className="mt-6">
                            <div className="flex justify-between text-sm mb-2">
                                <span className="text-gray-400">Import Progress</span>
                                <span className="font-semibold">{progress.toFixed(1)}%</span>
                            </div>
                            <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
                                <div
                                    className={`h-full transition-all duration-500 ${isCompleted ? 'bg-green-500' :
                                        isFailed ? 'bg-red-500' :
                                            'bg-blue-500'
                                        }`}
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Import Button */}
                <div className="bg-[#1a1a1a] p-6 rounded-lg shadow-lg">
                    <h2 className="text-xl font-semibold mb-4">Import Leads</h2>
                    <p className="text-gray-400 mb-4">
                        Click the button below to start importing leads from the uploaded CSV file into the database.
                        Use the refresh button above to check the import progress.
                    </p>

                    <button
                        onClick={handleStartImport}
                        disabled={isImporting || isCompleted ||
                            activeList.status === 'split_configured' ||
                            activeList.status === 'splitting_leads' ||
                            activeList.status === 'leads_split_complete'}
                        className={`w-full py-3 px-6 rounded-lg transition duration-200 shadow-md font-semibold ${isImporting || isCompleted ||
                            activeList.status === 'split_configured' ||
                            activeList.status === 'splitting_leads' ||
                            activeList.status === 'leads_split_complete'
                            ? 'bg-gray-600 cursor-not-allowed'
                            : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 cursor-pointer'
                            }`}
                    >
                        {isCompleted ||
                            activeList.status === 'split_configured' ||
                            activeList.status === 'splitting_leads' ||
                            activeList.status === 'leads_split_complete' ? '✓ Import Completed' :
                            isImporting ? 'Starting Import...' :
                                'Start Import'}
                    </button>

                    {(isCompleted ||
                        activeList.status === 'split_configured' ||
                        activeList.status === 'splitting_leads' ||
                        activeList.status === 'leads_split_complete') && (
                            <div className="mt-4 p-4 bg-green-900/30 border border-green-500 rounded-lg">
                                <p className="text-green-400 font-semibold">
                                    ✓ Successfully imported {activeList.leads_processed} leads!
                                </p>
                            </div>
                        )}

                    {isFailed && (
                        <div className="mt-4 p-4 bg-red-900/30 border border-red-500 rounded-lg">
                            <p className="text-red-400 font-semibold">
                                ✗ Import failed. Please try again or contact support.
                            </p>
                            {activeList.error && (
                                <p className="text-red-300 text-sm mt-2">{activeList.error}</p>
                            )}
                        </div>
                    )}
                </div>

                {/* Lead Split Configuration Section - Shows when status >= 'completed' AND not import_failed */}
                {(isCompleted ||
                    activeList.status === 'split_configured' ||
                    activeList.status === 'splitting_leads' ||
                    activeList.status === 'leads_split_complete') &&
                    activeList.status !== 'import_failed' && (
                        <div className="bg-[#1a1a1a] p-6 rounded-lg shadow-lg mt-6">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-xl font-semibold">Lead Split Configuration</h2>
                                {activeList.status !== 'completed' && !isEditingLeadSplit && (
                                    <button
                                        onClick={() => setIsEditingLeadSplit(true)}
                                        className="text-sm px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded transition duration-200"
                                    >
                                        Edit
                                    </button>
                                )}
                            </div>

                            {/* Read-only mode - when split is configured and not editing */}
                            {activeList.status !== 'completed' && !isEditingLeadSplit ? (
                                <div className="p-4 bg-green-900/30 border border-green-500 rounded-lg">
                                    <div className="flex items-center gap-2">
                                        <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                        </svg>
                                        <p className="text-green-400 font-semibold">
                                            Configured: <span className="font-bold">{activeList.lead_split}</span> leads per table
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                /* Edit mode - when status is 'completed' or editing */
                                <>
                                    <p className="text-gray-400 mb-4">
                                        Enter the number of leads to split and upload to Clay tables.
                                    </p>

                                    {activeList.lead_split && !isEditingLeadSplit && (
                                        <div className="mb-4 p-3 bg-blue-900/30 border border-blue-500 rounded-lg">
                                            <p className="text-blue-400 text-sm">
                                                Current Lead Split: <span className="font-bold">{activeList.lead_split}</span>
                                            </p>
                                        </div>
                                    )}

                                    <div className="flex gap-3">
                                        <input
                                            type="number"
                                            min="1"
                                            value={leadSplitInput}
                                            onChange={(e) => setLeadSplitInput(e.target.value)}
                                            placeholder="Enter number of leads to split"
                                            className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                        />
                                        <button
                                            onClick={handleUpdateLeadSplit}
                                            disabled={isUpdatingLeadSplit || !leadSplitInput}
                                            className={`px-6 py-3 rounded-lg transition duration-200 shadow-md font-semibold ${isUpdatingLeadSplit || !leadSplitInput
                                                ? 'bg-gray-600 cursor-not-allowed'
                                                : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 cursor-pointer'
                                                }`}
                                        >
                                            {isUpdatingLeadSplit ? 'Saving...' : isEditingLeadSplit ? 'Update' : 'Save Split'}
                                        </button>
                                        {isEditingLeadSplit && (
                                            <button
                                                onClick={() => {
                                                    setIsEditingLeadSplit(false);
                                                    setLeadSplitInput('');
                                                }}
                                                className="px-4 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition duration-200"
                                            >
                                                Cancel
                                            </button>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                {/* Lead Splitting Section - Shows when status >= 'split_configured' */}
                {(activeList.status === 'split_configured' ||
                    activeList.status === 'splitting_leads' ||
                    activeList.status === 'leads_split_complete' ||
                    activeList.status === 'lead_split_failed') && (
                        <div className="bg-[#1a1a1a] p-6 rounded-lg shadow-lg mt-6">
                            <h2 className="text-xl font-semibold mb-4">Lead Splitting</h2>

                            {/* Split Configured - Ready to split */}
                            {activeList.status === 'split_configured' && (
                                <>
                                    <p className="text-gray-400 mb-4">
                                        Ready to split {activeList.lead_split} leads per table.
                                    </p>
                                    <button
                                        onClick={handleStartClayUpload}
                                        disabled={isStartingClayUpload}
                                        className={`w-full py-3 px-6 rounded-lg transition duration-200 shadow-md font-semibold ${isStartingClayUpload
                                            ? 'bg-gray-600 cursor-not-allowed'
                                            : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 cursor-pointer'
                                            }`}
                                    >
                                        {isStartingClayUpload ? 'Starting Split...' : 'Start Lead Split'}
                                    </button>
                                </>
                            )}

                            {/* Splitting - In progress */}
                            {activeList.status === 'splitting_leads' && (
                                <div className="p-4 bg-blue-900/30 border border-blue-500 rounded-lg">
                                    <div className="flex items-center gap-3">
                                        <svg className="animate-spin h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        <p className="text-blue-400 font-semibold">
                                            Splitting leads...
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Split Complete - Success */}
                            {activeList.status === 'leads_split_complete' && (
                                <div className="p-4 bg-green-900/30 border border-green-500 rounded-lg">
                                    <div className="flex items-center gap-2">
                                        <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                        </svg>
                                        <p className="text-green-400 font-semibold">
                                            ✓ Leads split successfully
                                        </p>
                                    </div>
                                    <p className="text-gray-400 text-sm mt-2">
                                        Leads have been split into tables with {activeList.lead_split} leads each.
                                    </p>
                                </div>
                            )}

                            {/* Split Failed - Error with retry */}
                            {activeList.status === 'lead_split_failed' && (
                                <div className="p-4 bg-red-900/30 border border-red-500 rounded-lg">
                                    <div className="flex items-center gap-2 mb-2">
                                        <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                        </svg>
                                        <p className="text-red-400 font-semibold">
                                            ✗ Lead splitting failed
                                        </p>
                                    </div>
                                    {activeList.error && (
                                        <p className="text-red-300 text-sm mb-3">{activeList.error}</p>
                                    )}
                                    <button
                                        onClick={handleStartClayUpload}
                                        disabled={isStartingClayUpload}
                                        className={`w-full py-3 px-6 rounded-lg transition duration-200 shadow-md font-semibold ${isStartingClayUpload
                                            ? 'bg-gray-600 cursor-not-allowed'
                                            : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 cursor-pointer'
                                            }`}
                                    >
                                        {isStartingClayUpload ? 'Retrying...' : 'Retry Split'}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                {/* Progress Tracking Section - Shows when status is leads_split_complete */}
                {activeList.status === 'leads_split_complete' && progressData && (
                    <div className="bg-[#1a1a1a] p-6 rounded-lg shadow-lg mt-6">
                        <h2 className="text-xl font-semibold mb-4">Lead Processing Progress</h2>

                        {/* Stats Grid */}
                        <div className="grid grid-cols-4 gap-4 mb-4">
                            <div className="bg-gray-800 p-4 rounded-lg">
                                <p className="text-gray-400 text-sm mb-1">Total</p>
                                <p className="text-2xl font-bold">{progressData.total_count}</p>
                            </div>
                            <div className="bg-gray-800 p-4 rounded-lg">
                                <p className="text-gray-400 text-sm mb-1">New</p>
                                <p className="text-2xl font-bold text-gray-400">{progressData.new_count}</p>
                            </div>
                            <div className="bg-blue-900/30 p-4 rounded-lg border border-blue-500">
                                <p className="text-blue-400 text-sm mb-1">Split</p>
                                <p className="text-2xl font-bold text-blue-400">{progressData.split_count}</p>
                            </div>
                            <div className="bg-green-900/30 p-4 rounded-lg border border-green-500">
                                <p className="text-green-400 text-sm mb-1">Enriched</p>
                                <p className="text-2xl font-bold text-green-400">{progressData.enriched_count}</p>
                            </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="mb-4">
                            <div className="flex justify-between text-sm mb-2">
                                <span className="text-gray-400">Enrichment Progress</span>
                                <span className="font-semibold">
                                    {progressData.total_count > 0
                                        ? ((progressData.enriched_count / progressData.total_count) * 100).toFixed(1)
                                        : 0}%
                                </span>
                            </div>
                            <div className="w-full bg-gray-700 rounded-full h-4 overflow-hidden flex">
                                {progressData.new_count > 0 && (
                                    <div
                                        className="h-full bg-gray-500 transition-all duration-500"
                                        style={{ width: `${(progressData.new_count / progressData.total_count) * 100}%` }}
                                        title={`New: ${progressData.new_count}`}
                                    />
                                )}
                                {progressData.split_count > 0 && (
                                    <div
                                        className="h-full bg-blue-500 transition-all duration-500"
                                        style={{ width: `${(progressData.split_count / progressData.total_count) * 100}%` }}
                                        title={`Split: ${progressData.split_count}`}
                                    />
                                )}
                                {progressData.enriched_count > 0 && (
                                    <div
                                        className="h-full bg-green-500 transition-all duration-500"
                                        style={{ width: `${(progressData.enriched_count / progressData.total_count) * 100}%` }}
                                        title={`Enriched: ${progressData.enriched_count}`}
                                    />
                                )}
                            </div>
                        </div>

                        {/* View Split Tables Button */}
                        <Link href={`/leads/${activeList.id}/splits`}>
                            <button className="w-full py-3 px-6 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 transition duration-200 shadow-md font-semibold">
                                View Split Tables
                            </button>
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
}