

import React, { useState, useEffect, useMemo } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import Papa from 'papaparse';
import { RawSalesDataRow, ProcessedData, FilterState } from './types';
import { processSalesData, normalizeRow } from './services/dataProcessor';
import { fetchSalesData } from './services/dataFetcher';
import LoadingIndicator from './components/LoadingIndicator';
import Dashboard from './components/Dashboard';
import DrilldownView from './components/DrilldownView';
import LoginPage from './components/LoginPage';
import ProtectedRoute from './components/ProtectedRoute';
import MainLayout from './components/MainLayout';

const createEmptyProcessedData = (filterOptions: ProcessedData['filterOptions']): ProcessedData => ({
    totalSales2024: 0, totalSales2025: 0, totalCashSales2024: 0, totalCashSales2025: 0, totalCreditSales2024: 0, totalCreditSales2025: 0, salesGrowthPercentage: 0,
    salesByDivision: [], salesByDepartment: [], salesByCategory: [], salesBySubcategory: [], salesByClass: [],
    salesByBrand: [], salesByBranch: [], salesByItem: [],
    top10Brands: [], top50Items: [], branchCount2024: 0, branchCount2025: 0, brandCount2024: 0, brandCount2025: 0, itemCount2024: 0,
    itemCount2025: 0, topDivision: null,
    pareto: {
        branches: { topCount: 0, salesPercent: 0, totalSales: 0, totalContributors: 0, topSales: 0 },
        brands: { topCount: 0, salesPercent: 0, totalSales: 0, totalContributors: 0, topSales: 0 },
        items: { topCount: 0, salesPercent: 0, totalSales: 0, totalContributors: 0, topSales: 0 },
    },
    paretoContributors: { branches: [], brands: [], items: [] },
    newEntities: {
        branches: { count: 0, sales: 0, percentOfTotal: 0 },
        brands: { count: 0, sales: 0, percentOfTotal: 0 },
        items: { count: 0, sales: 0, percentOfTotal: 0 },
    },
    newBrandsList: [], newItemsList: [],
    lostEntities: {
        brands: { count: 0, sales2024: 0, percentOfTotal: 0 },
        items: { count: 0, sales2024: 0, percentOfTotal: 0 },
    },
    lostBrandsList: [], lostItemsList: [], filterOptions: filterOptions,
});

const App: React.FC = () => {
    const [loadingState, setLoadingState] = useState({ isLoading: true, progress: 0, message: '' });
    const [error, setError] = useState<string | null>(null);
    const [allData, setAllData] = useState<RawSalesDataRow[]>([]);
    const [processedData, setProcessedData] = useState<ProcessedData | null>(null);
    const [filters, setFilters] = useState<FilterState>({
        divisions: [], departments: [], categories: [], subcategories: [], classes: [],
        branches: [], brands: [], items: [], saleType: 'ALL'
    });
    const [searchTerm, setSearchTerm] = useState('');
    const [isAuthenticated, setIsAuthenticated] = useState(localStorage.getItem('isAuthenticated') === 'true');
    const navigate = useNavigate();
    const location = useLocation();

    // Effect to sync auth state across tabs
    useEffect(() => {
        const handleStorageChange = () => {
            setIsAuthenticated(localStorage.getItem('isAuthenticated') === 'true');
        };

        window.addEventListener('storage', handleStorageChange);

        return () => {
            window.removeEventListener('storage', handleStorageChange);
        };
    }, []);

    useEffect(() => {
        const loadData = async () => {
            setError(null);
            setLoadingState({ isLoading: true, progress: 10, message: 'Initiating download...' });

            const { data, error: fetchError } = await fetchSalesData((msg: string) =>
                setLoadingState(prev => ({ ...prev, message: msg }))
            );

            if (fetchError || !data) {
                setError(fetchError || 'Failed to fetching data.');
                setLoadingState({ isLoading: false, progress: 0, message: '' });
                return;
            }

            setLoadingState({ isLoading: true, progress: 25, message: 'Parsing data...' });

            Papa.parse<Record<string, string>>(data, {
                header: true, skipEmptyLines: true, worker: true,
                complete: (results) => {
                    setLoadingState({ isLoading: true, progress: 50, message: 'Validating data...' });
                    const fileHeaders = results.meta.fields?.map(h => h.trim().toUpperCase()) || [];

                    // Basic validation to ensure we have *some* data
                    if (fileHeaders.length === 0 || results.data.length === 0) {
                        setError("Parsed data is empty or invalid format.");
                        setLoadingState({ isLoading: false, progress: 0, message: '' });
                        return;
                    }

                    // Strict column check can be relaxed or kept. Keeping minimal check.
                    const requiredHeaders = ['DIVISION']; // Minimal check
                    const missingHeaders = requiredHeaders.filter(h => !fileHeaders.includes(h));

                    if (missingHeaders.length > 0) {
                        setError(`Missing critical columns: ${missingHeaders.join(', ')}`);
                        setLoadingState({ isLoading: false, progress: 0, message: '' });
                        return;
                    }

                    setAllData(results.data.map(row => normalizeRow(row, fileHeaders)));
                    setLoadingState({ isLoading: true, progress: 75, message: 'Processing data...' });
                },
                error: (err: any) => {
                    setError(`Failed to parse CSV data: ${err.message}`);
                    setLoadingState({ isLoading: false, progress: 0, message: '' });
                }
            });
        };

        loadData();
    }, []);

    useEffect(() => {
        if (allData.length > 0) {
            try {
                const data = processSalesData(allData);
                setProcessedData(data);
                setLoadingState({ isLoading: true, progress: 100, message: 'Done!' });
                setTimeout(() => setLoadingState({ isLoading: false, progress: 0, message: '' }), 500);
            } catch (err: any) {
                setError(err instanceof Error ? `Error processing data: ${err.message}` : 'An unknown error occurred during data processing.');
                setLoadingState({ isLoading: false, progress: 0, message: '' });
            }
        }
    }, [allData]);

    // Generic Debounce Hook
    function useDebounce<T>(value: T, delay: number): T {
        const [debouncedValue, setDebouncedValue] = useState<T>(value);
        useEffect(() => {
            const handler = setTimeout(() => setDebouncedValue(value), delay);
            return () => clearTimeout(handler);
        }, [value, delay]);
        return debouncedValue;
    }

    const debouncedSearchTerm = useDebounce(searchTerm, 300);

    // Optimized Filtering: Returns the raw rows matching the filters
    const filteredRows = useMemo(() => {
        if (!allData || allData.length === 0) return [];

        const lowercasedTerm = debouncedSearchTerm.toLowerCase();

        return allData.filter(row => {
            // Dropdown filters
            const { divisions, departments, categories, branches, brands } = filters;

            // Fast fail checks
            if (divisions.length > 0 && !divisions.includes(row['DIVISION'])) return false;
            // Add check: only filter by Department if selected
            if (departments.length > 0 && (!row['DEPARTMENT'] || !departments.includes(row['DEPARTMENT']))) return false;
            if (categories.length > 0 && (!row['CATEGORY'] || !categories.includes(row['CATEGORY']))) return false;
            if (branches.length > 0 && !branches.includes(row['BRANCH NAME'])) return false;
            if (brands.length > 0 && !brands.includes(row['BRAND'])) return false;

            // Search term filter using optimized index
            if (lowercasedTerm) {
                // If _searchIndex exists, use it. Otherwise fall back to slower individual field checks (safety)
                if (row._searchIndex) {
                    return row._searchIndex.includes(lowercasedTerm);
                }
                return (
                    (row['DIVISION']?.toLowerCase().includes(lowercasedTerm)) ||
                    (row['DEPARTMENT']?.toLowerCase().includes(lowercasedTerm)) ||
                    (row['CATEGORY']?.toLowerCase().includes(lowercasedTerm)) ||
                    (row['BRANCH NAME']?.toLowerCase().includes(lowercasedTerm)) ||
                    (row['BRANCH CODE']?.toLowerCase().includes(lowercasedTerm)) ||
                    (row['BRAND']?.toLowerCase().includes(lowercasedTerm)) ||
                    (row['ITEM DESCRIPTION']?.toLowerCase().includes(lowercasedTerm)) ||
                    (row['ITEM CODE']?.toLowerCase().includes(lowercasedTerm)) ||
                    (row['CLASS']?.toLowerCase().includes(lowercasedTerm)) ||
                    (row['SUBCATEGORY']?.toLowerCase().includes(lowercasedTerm))
                );
            }

            return true;
        });
    }, [allData, filters, debouncedSearchTerm]);

    // Process the ALREADY FILTERED rows to get the stats (Summary Cards, Charts, etc.)
    const processedFilteredData = useMemo(() => {
        if (filteredRows.length > 0) {
            return processSalesData(filteredRows, processedData?.filterOptions, filters.saleType);
        }
        // If no rows match the filters, return an empty processed data structure
        return createEmptyProcessedData(processedData?.filterOptions || {
            divisions: [], departments: [], categories: [], subcategories: [], classes: [],
            branches: [], brands: [], items: []
        });
    }, [filteredRows, processedData?.filterOptions, filters.saleType]);

    const handleLogin = () => {
        localStorage.setItem('isAuthenticated', 'true');
        setIsAuthenticated(true);
        const from = location.state?.from?.pathname || '/';
        navigate(from, { replace: true });
    };

    const handleLogout = () => {
        localStorage.removeItem('isAuthenticated');
        setIsAuthenticated(false);
        navigate('/login');
    };

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setLoadingState({ isLoading: true, progress: 25, message: 'Parsing uploaded file...' });
        setError(null);

        Papa.parse<Record<string, string>>(file, {
            header: true,
            skipEmptyLines: true,
            worker: true,
            complete: (results) => {
                setLoadingState({ isLoading: true, progress: 50, message: 'Validating data...' });
                const requiredHeaders = ['DIVISION', 'BRANCH NAME', 'BRAND', 'ITEM DESCRIPTION'];
                const fileHeaders = results.meta.fields?.map(h => h.trim().toUpperCase()) || [];
                const missingHeaders = requiredHeaders.filter(h => !fileHeaders.includes(h));

                if (missingHeaders.length > 0) {
                    setError(`Missing required columns: ${missingHeaders.join(', ')}`);
                    setLoadingState({ isLoading: false, progress: 0, message: '' });
                    return;
                }

                setAllData(results.data.map(row => normalizeRow(row, fileHeaders)));
                setLoadingState({ isLoading: true, progress: 75, message: 'Processing data...' });
            },
            error: (err: any) => {
                setError(`Failed to parse CSV data: ${err.message}`);
                setLoadingState({ isLoading: false, progress: 0, message: '' });
            }
        });
    };

    const renderContent = () => {
        if (error) {
            return (
                <div className="flex flex-col items-center justify-center min-h-screen text-center bg-gray-50 p-4">
                    <div className="w-full max-w-2xl bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-xl shadow-sm mb-8" role="alert">
                        <strong className="font-bold text-lg block mb-2">Unable to Load Data</strong>
                        <span className="block">{error}</span>
                    </div>

                    <div className="flex flex-col items-center gap-4 bg-white p-8 rounded-xl shadow-lg border border-gray-100 max-w-md w-full">
                        <h2 className="text-xl font-bold text-gray-800">Manual Upload (Fallback)</h2>
                        <p className="text-sm text-gray-500 mb-4">If the automatic download fails, you can upload the CSV manually below.</p>
                        <label className="block w-full">
                            <span className="sr-only">Choose CSV file</span>
                            <input
                                type="file"
                                accept=".csv"
                                onChange={handleFileUpload}
                                className="hidden"
                            />
                            <div className="flex flex-col items-center justify-center px-4 py-6 bg-indigo-50 text-indigo-600 rounded-lg border-2 border-dashed border-indigo-200 hover:bg-indigo-100 hover:border-indigo-300 transition-all duration-300 group">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mb-2 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                </svg>
                                <span className="font-semibold">Click to Upload CSV</span>
                            </div>
                        </label>

                        <div className="relative w-full py-2">
                            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-gray-200"></span></div>
                            <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-gray-400">Or</span></div>
                        </div>

                        <button
                            onClick={() => window.location.reload()}
                            className="text-gray-500 hover:text-indigo-600 text-sm font-medium underline transition-colors"
                        >
                            Try fetching again
                        </button>
                    </div>
                </div>
            );
        }
        if (loadingState.isLoading || (!processedFilteredData && isAuthenticated)) {
            return <div className="min-h-screen flex items-center justify-center"><LoadingIndicator progress={loadingState.progress} message={loadingState.message} /></div>;
        }

        return (
            <Routes>
                <Route path="/login" element={<LoginPage onLogin={handleLogin} />} />
                <Route
                    element={
                        <ProtectedRoute isAuthenticated={isAuthenticated}>
                            <MainLayout />
                        </ProtectedRoute>
                    }
                >
                    <Route
                        path="/"
                        element={
                            <Dashboard
                                data={processedFilteredData!}
                                filters={filters}
                                onFilterChange={setFilters}
                                onLogout={handleLogout}
                                searchTerm={searchTerm}
                                onSearchChange={setSearchTerm}
                            />
                        }
                    />
                    <Route
                        path="/details/:viewType"
                        element={<DrilldownView allRawData={filteredRows} globalFilterOptions={processedFilteredData?.filterOptions} />}
                    />
                </Route>
            </Routes>
        );
    };

    return <div className="min-h-screen">{renderContent()}</div>;
};

export default App;