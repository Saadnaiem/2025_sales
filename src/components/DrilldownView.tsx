import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { RawSalesDataRow, ProcessedData } from '../types';
import { formatNumberAbbreviated, GrowthIndicator } from '../utils/formatters';
import useOnClickOutside from '../hooks/useOnClickOutside';

type SortDirection = 'ascending' | 'descending';
interface SortConfig { key: string; direction: SortDirection; }

// Update DrilldownItem to include all new metrics
type DrilldownItem = {
    name: string;
    code?: string;
    sales2024?: number;
    sales2025?: number;
    cash2025?: number;
    credit2025?: number;
    cash2024?: number;
    credit2024?: number;
    growth?: number;
    cashGrowth?: number;
    creditGrowth?: number;
    cashContribution2025?: number;
    cashContribution2024?: number;
};
// ... (in DrilldownView)
// Update metric helper to be robust
const getMetric = (row: RawSalesDataRow, year: '2024' | '2025', type: 'TOTAL' | 'CASH' | 'CREDIT') => {
    const key = `${year} ${type} SALES`;
    return (row[key] as number) || 0;
};

// ... (skipping to reprocessLocally update)


export interface DrilldownViewProps {
    allRawData: RawSalesDataRow[];
    globalFilterOptions?: ProcessedData['filterOptions'];
}

const viewTitles: { [key: string]: string } = {
    'divisions': 'All Divisions Deep Dive',
    'departments': 'All Departments Deep Dive',
    'categories': 'All Categories Deep Dive',
    'subcategories': 'All Subcategories Deep Dive',
    'classes': 'All Classes Deep Dive',
    'branches': 'All Branches Deep Dive',
    'brands': 'All Brands Deep Dive',
    'items': 'All Items Deep Dive',
    'pareto_branches': 'Pareto: Top 20% Branches',
    'pareto_brands': 'Pareto: Top 20% Brands',
    'pareto_items': 'Pareto: Top 20% Items',
    'new_brands': 'New Brands in 2025',
    'new_items': 'New Items in 2025',
    'lost_brands': 'Lost Brands from 2024',
    'lost_items': 'Lost Items from 2024',
};

const DrilldownView: React.FC<DrilldownViewProps> = ({ allRawData, globalFilterOptions }) => {
    const { viewType = '' } = useParams<{ viewType: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'sales2025', direction: 'descending' });
    const [showFilters, setShowFilters] = useState(false);
    const filterContainerRef = useRef<HTMLDivElement>(null);

    useOnClickOutside(filterContainerRef, () => setShowFilters(false));

    const [localFilters, setLocalFilters] = useState({
        division: [] as string[],
        department: [] as string[],
        category: [] as string[],
        subcategory: [] as string[],
        class: [] as string[],
        branch: [] as string[],
        brand: [] as string[],
        item: [] as string[],
    });
    const [filterSearch, setFilterSearch] = useState({
        division: '', branch: '', brand: '', item: ''
    });
    const [saleType, setSaleType] = useState<'ALL' | 'CASH' | 'CREDIT'>('ALL');

    // Handle initial query params (e.g. ?division=Beauty&department=Skin Care...)
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        setLocalFilters(prev => ({
            ...prev,
            division: params.get('division') ? [params.get('division')!] : [],
            department: params.get('department') ? [params.get('department')!] : [],
            category: params.get('category') ? [params.get('category')!] : [],
            subcategory: params.get('subcategory') ? [params.get('subcategory')!] : [],
            class: params.get('class') ? [params.get('class')!] : [],
            brand: params.get('brand') ? [params.get('brand')!] : [],
        }));
    }, [location.search]);

    const toggleFilter = (key: keyof typeof localFilters, value: string) => {
        const currentValues = localFilters[key];
        const newValues = currentValues.includes(value)
            ? currentValues.filter(v => v !== value)
            : [...currentValues, value];
        setLocalFilters(prev => ({ ...prev, [key]: newValues }));
    };

    const { availableBranches, availableBrands } = useMemo(() => {
        if (!globalFilterOptions) return { availableBranches: [], availableBrands: [] };
        let branches = globalFilterOptions.branches;
        let brands = globalFilterOptions.brands;

        // Simplify availability logic: if any hierarchy filter is active, narrow down branches/brands
        const hasHierarchyFilter = localFilters.division.length > 0 || localFilters.department.length > 0 || localFilters.category.length > 0;

        if (hasHierarchyFilter) {
            const branchSet = new Set<string>();
            const brandSet = new Set<string>();

            allRawData.forEach(row => {
                const match =
                    (localFilters.division.length === 0 || localFilters.division.includes(row['DIVISION'] || '')) &&
                    (localFilters.department.length === 0 || localFilters.department.includes(row['DEPARTMENT'] || '')) &&
                    (localFilters.category.length === 0 || localFilters.category.includes(row['CATEGORY'] || '')) &&
                    (localFilters.subcategory.length === 0 || localFilters.subcategory.includes(row['SUBCATEGORY'] || '')) &&
                    (localFilters.class.length === 0 || localFilters.class.includes(row['CLASS'] || ''));

                if (match) {
                    branchSet.add(row['BRANCH NAME']);
                    brandSet.add(row['BRAND']);
                }
            });
            branches = Array.from(branchSet).sort();
            brands = Array.from(brandSet).sort();
        }

        return { availableBranches: branches, availableBrands: brands };
    }, [allRawData, globalFilterOptions, localFilters]);

    // Reset dependent filters? For deep dive navigation, we perform a navigate() which resets via useEffect
    // So we don't need aggressive auto-clearing here for the click-path.

    const handleLocalMultiSelectChange = (e: React.ChangeEvent<HTMLSelectElement>, filterKey: keyof typeof localFilters) => {
        const selectedOptions = Array.from(e.target.selectedOptions, (option: HTMLOptionElement) => option.value);
        setLocalFilters(prev => ({ ...prev, [filterKey]: selectedOptions }));
        setShowFilters(false);
    };

    const resetLocalFilters = () => {
        setLocalFilters({ division: [], department: [], category: [], subcategory: [], class: [], branch: [], brand: [], item: [] });
        setSearchTerm('');
        setFilterSearch({ division: '', branch: '', brand: '', item: '' });
        setShowFilters(false);
        navigate(location.pathname);
    };

    const handleBack = () => {
        const p = new URLSearchParams(location.search);
        const div = p.get('division');
        const dept = p.get('department');
        const cat = p.get('category');
        const sub = p.get('subcategory');
        const cls = p.get('class');
        const brand = p.get('brand');

        if (viewType === 'items' && brand) {
            return navigate(`/details/brands?division=${encodeURIComponent(div || '')}&department=${encodeURIComponent(dept || '')}&category=${encodeURIComponent(cat || '')}&subcategory=${encodeURIComponent(sub || '')}&class=${encodeURIComponent(cls || '')}`);
        }
        if (viewType === 'brands' && cls) {
            return navigate(`/details/classes?division=${encodeURIComponent(div || '')}&department=${encodeURIComponent(dept || '')}&category=${encodeURIComponent(cat || '')}&subcategory=${encodeURIComponent(sub || '')}`);
        }
        if (viewType === 'classes' && sub) {
            return navigate(`/details/subcategories?division=${encodeURIComponent(div || '')}&department=${encodeURIComponent(dept || '')}&category=${encodeURIComponent(cat || '')}`);
        }
        if (viewType === 'subcategories' && cat) {
            return navigate(`/details/categories?division=${encodeURIComponent(div || '')}&department=${encodeURIComponent(dept || '')}`);
        }
        if (viewType === 'categories' && dept) {
            return navigate(`/details/departments?division=${encodeURIComponent(div || '')}`);
        }
        if (viewType === 'departments' && div) {
            return navigate(`/details/divisions`);
        }
        navigate('/');
    };

    const {
        processedData,
        tableTitle,
        headers,
        summaryTotals,
        summaryDescription,
        visibleFilters,
        entityTypeLabel,
        performanceRateStats
    } = useMemo(() => {



        let locallyFilteredRawData = allRawData.filter(row => {
            return (localFilters.division.length === 0 || localFilters.division.includes(row['DIVISION'] || '')) &&
                (localFilters.department.length === 0 || localFilters.department.includes(row['DEPARTMENT'] || '')) &&
                (localFilters.category.length === 0 || localFilters.category.includes(row['CATEGORY'] || '')) &&
                (localFilters.subcategory.length === 0 || localFilters.subcategory.includes(row['SUBCATEGORY'] || '')) &&
                (localFilters.class.length === 0 || localFilters.class.includes(row['CLASS'] || '')) &&
                (localFilters.branch.length === 0 || localFilters.branch.includes(row['BRANCH NAME'])) &&
                (localFilters.brand.length === 0 || localFilters.brand.includes(row['BRAND'])) &&
                (localFilters.item.length === 0 || localFilters.item.includes(row['ITEM DESCRIPTION']));
        });

        let displayData: DrilldownItem[] = [];
        let currentTitle = viewTitles[viewType] || 'Deep Dive';
        let localTotal24 = 0;
        let localTotal25 = 0;

        locallyFilteredRawData.forEach(row => {
            const t24 = getMetric(row, '2024', 'TOTAL') || (row['SALES2024'] as number) || 0;
            const t25 = getMetric(row, '2025', 'TOTAL') || (row['SALES2025'] as number) || 0;
            localTotal24 += t24;
            localTotal25 += t25;
        });

        const reprocessLocally = (entityKey: 'BRANCH NAME' | 'BRAND' | 'ITEM DESCRIPTION' | 'DIVISION' | 'DEPARTMENT' | 'CATEGORY' | 'SUBCATEGORY' | 'CLASS') => {
            const sales: { [key: string]: { s24: number, s25: number, c25: number, cr25: number, c24: number, cr24: number, code?: string } } = {};
            locallyFilteredRawData.forEach(row => {
                const key = row[entityKey];
                if (key) {
                    sales[key] = sales[key] || { s24: 0, s25: 0, c25: 0, cr25: 0, c24: 0, cr24: 0, code: row['ITEM CODE'] };
                    sales[key].s24 += getMetric(row, '2024', 'TOTAL') || (row['SALES2024'] as number) || 0;
                    sales[key].s25 += getMetric(row, '2025', 'TOTAL') || (row['SALES2025'] as number) || 0;

                    sales[key].c25 += getMetric(row, '2025', 'CASH');
                    sales[key].cr25 += getMetric(row, '2025', 'CREDIT');
                    sales[key].c24 += getMetric(row, '2024', 'CASH');
                    sales[key].cr24 += getMetric(row, '2024', 'CREDIT');
                }
            });
            return Object.entries(sales).map(([name, { s24, s25, c25, cr25, c24, cr24, code }]) => ({
                name,
                code,
                sales2024: s24,
                sales2025: s25,
                cash2025: c25,
                credit2025: cr25,
                cash2024: c24,
                credit2024: cr24,
                growth: s24 === 0 ? (s25 > 0 ? Infinity : 0) : ((s25 - s24) / s24) * 100,
                cashGrowth: c24 === 0 ? (c25 > 0 ? Infinity : 0) : ((c25 - c24) / c24) * 100,
                creditGrowth: cr24 === 0 ? (cr25 > 0 ? Infinity : 0) : ((cr25 - cr24) / cr24) * 100,
                cashContribution2025: s25 > 0 ? (c25 / s25) * 100 : 0,
                cashContribution2024: s24 > 0 ? (c24 / s24) * 100 : 0
            }));
        };

        const findNewOrLost = (isNew: boolean) => {
            const entityKey = viewType.includes('brand') ? 'BRAND' : 'ITEM DESCRIPTION';
            const sales: { [key: string]: { s24: number, s25: number, c25: number, cr25: number, code?: string } } = {};
            locallyFilteredRawData.forEach(row => {
                const key = row[entityKey];
                if (key) {
                    sales[key] = sales[key] || { s24: 0, s25: 0, c25: 0, cr25: 0, code: row['ITEM CODE'] };
                    const t24 = getMetric(row, '2024', 'TOTAL') || (row['SALES2024'] as number) || 0;
                    const t25 = getMetric(row, '2025', 'TOTAL') || (row['SALES2025'] as number) || 0;
                    sales[key].s24 += t24;
                    sales[key].s25 += t25;
                    sales[key].c25 += getMetric(row, '2025', 'CASH');
                    sales[key].cr25 += getMetric(row, '2025', 'CREDIT');
                }
            });

            return Object.entries(sales)
                .filter(([, { s24, s25 }]) => (isNew ? (s25 > 0 && s24 === 0) : (s24 > 0 && s25 === 0)))
                .map(([name, { s24, s25, c25, cr25, code }]) => ({ name, code, sales2024: s24, sales2025: s25, cash2025: c25, credit2025: cr25 }));
        };

        const findPareto = (entityKey: 'BRANCH NAME' | 'BRAND' | 'ITEM DESCRIPTION') => {
            const aggregated = reprocessLocally(entityKey);
            const sorted = aggregated.filter(i => (i.sales2025 || 0) > 0).sort((a, b) => (b.sales2025 || 0) - (a.sales2025 || 0));
            const topCount = Math.max(1, Math.ceil(sorted.length * 0.20));
            return sorted.slice(0, topCount);
        };

        let entityTypeLabel = "Rows";
        if (viewType.includes('branch')) entityTypeLabel = "Branches";
        else if (viewType.includes('brand')) entityTypeLabel = "Brands";
        else if (viewType.includes('item')) entityTypeLabel = "Items";
        else if (viewType.includes('division')) entityTypeLabel = "Divisions";
        else if (viewType.includes('department')) entityTypeLabel = "Departments";
        else if (viewType.includes('subcategor')) entityTypeLabel = "Subcategories";
        else if (viewType.includes('categor')) entityTypeLabel = "Categories";
        else if (viewType.includes('class')) entityTypeLabel = "Classes";

        switch (viewType) {
            case 'divisions': displayData = reprocessLocally('DIVISION'); break;
            case 'departments': displayData = reprocessLocally('DEPARTMENT'); break;
            case 'categories': displayData = reprocessLocally('CATEGORY'); break;
            case 'subcategories': displayData = reprocessLocally('SUBCATEGORY'); break;
            case 'classes': displayData = reprocessLocally('CLASS'); break;

            case 'branches': {
                const aggregated = reprocessLocally('BRANCH NAME');
                const aggMap = new Map(aggregated.map(i => [i.name, i]));
                displayData = availableBranches.map(branchName => {
                    const existing = aggMap.get(branchName);
                    if (existing) return existing;
                    return {
                        name: branchName,
                        sales2024: 0, sales2025: 0,
                        cash2025: 0, credit2025: 0,
                        cash2024: 0, credit2024: 0,
                        growth: 0, cashGrowth: 0, creditGrowth: 0,
                        cashContribution2025: 0, cashContribution2024: 0
                    };
                });
                break;
            }
            case 'brands': displayData = reprocessLocally('BRAND'); break;
            case 'items': displayData = reprocessLocally('ITEM DESCRIPTION'); break;

            case 'pareto_branches': displayData = findPareto('BRANCH NAME'); break;
            case 'pareto_brands': displayData = findPareto('BRAND'); break;
            case 'pareto_items': displayData = findPareto('ITEM DESCRIPTION'); break;
            case 'new_brands': case 'new_items': displayData = findNewOrLost(true); break;
            case 'lost_brands': case 'lost_items': displayData = findNewOrLost(false); break;
            default: displayData = [];
        }

        const isItemView = viewType.includes('item');

        const allHeaders = [
            { key: 'rowNumber', label: '#' },
            { key: 'code', label: 'Item Code' },
            { key: 'name', label: 'Name' },
            { key: 'sales2025', label: 'Total 2025', className: 'text-right' },
            { key: 'cash2025', label: 'Cash 2025', className: 'text-right bg-sky-900/20 text-sky-100' },
            { key: 'credit2025', label: 'Credit 2025', className: 'text-right bg-orange-900/20 text-orange-100' },
            { key: 'cashContribution2025', label: 'Cash % 25', className: 'text-right text-xs bg-sky-900/20 text-sky-200' },

            { key: 'sales2024', label: 'Total 2024', className: 'text-right border-l border-slate-600' },
            { key: 'cash2024', label: 'Cash 2024', className: 'text-right bg-sky-900/10 text-sky-200/70' },
            { key: 'credit2024', label: 'Credit 2024', className: 'text-right bg-orange-900/10 text-orange-200/70' },
            { key: 'cashContribution2024', label: 'Cash % 24', className: 'text-right text-xs bg-sky-900/10 text-sky-200/70' },

            { key: 'growth', label: 'Total GR%', className: 'text-right border-l border-slate-600' },
            { key: 'cashGrowth', label: 'Cash GR%', className: 'text-right text-xs' },
            { key: 'creditGrowth', label: 'Credit GR%', className: 'text-right text-xs' },
        ];
        const getHeaders = (keys: string[]) => allHeaders.filter(h => keys.includes(h.key));

        let currentHeaders;
        const defaultKeys = ['rowNumber', 'name', 'sales2025', 'sales2024', 'growth', 'cash2025', 'cash2024', 'cashContribution2025', 'cashGrowth', 'credit2025', 'credit2024', 'creditGrowth'];
        if (isItemView) defaultKeys.splice(1, 0, 'code');

        switch (viewType) {
            case 'new_brands': currentHeaders = getHeaders(['rowNumber', 'name', 'sales2025', 'cash2025', 'credit2025', 'contribution2025']); break;
            case 'new_items': currentHeaders = getHeaders(['rowNumber', 'code', 'name', 'sales2025', 'cash2025', 'credit2025', 'contribution2025']); break;
            case 'lost_brands': currentHeaders = getHeaders(['rowNumber', 'name', 'sales2024', 'contribution2024']); break;
            case 'lost_items': currentHeaders = getHeaders(['rowNumber', 'code', 'name', 'sales2024', 'contribution2024']); break;
            default:
                currentHeaders = getHeaders(defaultKeys);
        }

        let finalData = displayData.map(item => ({
            ...item,
            contribution2025: localTotal25 > 0 && item.sales2025 ? (item.sales2025 / localTotal25) * 100 : 0,
            contribution2024: localTotal24 > 0 && item.sales2024 ? (item.sales2024 / localTotal24) * 100 : 0
        }));

        if (searchTerm) finalData = finalData.filter(item =>
            item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (item.code && item.code.toLowerCase().includes(searchTerm.toLowerCase()))
        );

        if (sortConfig.key) {
            finalData.sort((a, b) => {
                const aValue = (a as any)[sortConfig.key] ?? -Infinity;
                const bValue = (b as any)[sortConfig.key] ?? -Infinity;
                if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
                return 0;
            });
        }

        const summaryTotals = {
            count: finalData.length,
            total2025: finalData.reduce((acc, item) => acc + (item.sales2025 || 0), 0),
            total2024: finalData.reduce((acc, item) => acc + (item.sales2024 || 0), 0),
            totalCash2025: finalData.reduce((acc, item) => acc + (item.cash2025 || 0), 0),
            totalCash2024: finalData.reduce((acc, item) => acc + (item.cash2024 || 0), 0),
            totalCredit2025: finalData.reduce((acc, item) => acc + (item.credit2025 || 0), 0),
            totalCredit2024: finalData.reduce((acc, item) => acc + (item.credit2024 || 0), 0),
            growth: 0,
        };
        summaryTotals.growth = ((current, previous) => previous === 0 ? (current > 0 ? Infinity : 0) : ((current - previous) / previous) * 100)(summaryTotals.total2025, summaryTotals.total2024);

        const generateDescription = () => {
            // Description simplified for the deep dive
            return `Drilldown: ${currentTitle}`;
        };

        // USER REQUEST: filter by branch and brand in ALL pages
        const visibleFilters = {
            division: false, // Hidden for deep dive, handled by clicks
            branch: true,
            brand: true
        };

        let performanceRateStats: { rate: number; sold: number; total: number } | null = null;
        const isBrandOrItemView = viewType.includes('brand') || viewType.includes('item');

        if (isBrandOrItemView) {
            const totalInView = displayData.length;
            if (totalInView > 0) {
                const soldInView = displayData.filter(item => item.sales2025 && item.sales2025 > 0).length;
                performanceRateStats = {
                    rate: (soldInView / totalInView) * 100,
                    sold: soldInView,
                    total: totalInView
                };
            } else {
                performanceRateStats = { rate: 0, sold: 0, total: 0 };
            }
        }

        return {
            processedData: finalData,
            tableTitle: currentTitle,
            headers: currentHeaders,
            summaryTotals,
            summaryDescription: generateDescription(),
            visibleFilters,
            entityTypeLabel,
            performanceRateStats
        };
    }, [viewType, allRawData, searchTerm, sortConfig, localFilters, location.pathname]);

    const requestSort = (key: string) => {
        if (key === 'rowNumber') return; // Do not sort by row number
        let direction: SortDirection = 'descending';
        if (sortConfig.key === key && sortConfig.direction === 'descending') direction = 'ascending';
        setSortConfig({ key, direction });
    };

    const getSortClassName = (name: string) => !sortConfig || sortConfig.key !== name || name === 'rowNumber' ? '' : sortConfig.direction === 'ascending' ? 'sort-asc' : 'sort-desc';

    const renderCell = (item: any, headerKey: string, index: number) => {
        const value = item[headerKey];
        switch (headerKey) {
            case 'rowNumber': return <td className="p-4 text-center text-slate-400">{index + 1}</td>;
            case 'code': return <td className="p-4 font-mono text-sm text-slate-400">{value}</td>;
            case 'name':
                // Drilldown Logic
                if (viewType === 'divisions') {
                    return <td className="p-4" title={value}><button onClick={() => navigate(`/details/departments?division=${encodeURIComponent(value)}`)} className="text-sky-400 hover:underline text-left font-medium">{value}</button></td>;
                }
                if (viewType === 'departments') {
                    // Need current division context. It's in localFilters.division[0]
                    const div = localFilters.division[0] || '';
                    return <td className="p-4" title={value}><button onClick={() => navigate(`/details/categories?division=${encodeURIComponent(div)}&department=${encodeURIComponent(value)}`)} className="text-sky-400 hover:underline text-left font-medium">{value}</button></td>;
                }
                if (viewType === 'categories') {
                    const div = localFilters.division[0] || '';
                    const dept = localFilters.department[0] || '';
                    return <td className="p-4" title={value}><button onClick={() => navigate(`/details/subcategories?division=${encodeURIComponent(div)}&department=${encodeURIComponent(dept)}&category=${encodeURIComponent(value)}`)} className="text-sky-400 hover:underline text-left font-medium">{value}</button></td>;
                }
                if (viewType === 'subcategories') {
                    const div = localFilters.division[0] || '';
                    const dept = localFilters.department[0] || '';
                    const cat = localFilters.category[0] || '';
                    return <td className="p-4" title={value}><button onClick={() => navigate(`/details/classes?division=${encodeURIComponent(div)}&department=${encodeURIComponent(dept)}&category=${encodeURIComponent(cat)}&subcategory=${encodeURIComponent(value)}`)} className="text-sky-400 hover:underline text-left font-medium">{value}</button></td>;
                }
                if (viewType === 'classes') {
                    const div = localFilters.division[0] || '';
                    const dept = localFilters.department[0] || '';
                    const cat = localFilters.category[0] || '';
                    const sub = localFilters.subcategory[0] || '';
                    return <td className="p-4" title={value}><button onClick={() => navigate(`/details/brands?division=${encodeURIComponent(div)}&department=${encodeURIComponent(dept)}&category=${encodeURIComponent(cat)}&subcategory=${encodeURIComponent(sub)}&class=${encodeURIComponent(value)}`)} className="text-sky-400 hover:underline text-left font-medium">{value}</button></td>;
                }
                if (viewType === 'brands') {
                    // Only if we are IN a deep dive context (meaning we have some params) do we want to link to items WITH those params
                    // If we are just in "All Brands" globally, we might just want to see items for that brand.
                    const div = localFilters.division[0] || '';
                    const dept = localFilters.department[0] || '';
                    const cat = localFilters.category[0] || '';
                    const sub = localFilters.subcategory[0] || '';
                    const cls = localFilters.class[0] || '';

                    let url = `/details/items?brand=${encodeURIComponent(value)}`;
                    if (div) url += `&division=${encodeURIComponent(div)}`;
                    if (dept) url += `&department=${encodeURIComponent(dept)}`;
                    if (cat) url += `&category=${encodeURIComponent(cat)}`;
                    if (sub) url += `&subcategory=${encodeURIComponent(sub)}`;
                    if (cls) url += `&class=${encodeURIComponent(cls)}`;

                    return <td className="p-4" title={value}><button onClick={() => navigate(url)} className="text-sky-400 hover:underline text-left font-medium">{value}</button></td>;

                }

                return <td className={`p-4 font-medium truncate max-w-sm ${(item.sales2025 || 0) === 0 ? 'text-rose-400' : 'text-white'}`} title={value}>{value}</td>;

            case 'sales2025': return <td className="p-4 text-right font-semibold text-green-300">{formatNumberAbbreviated(value)}</td>;
            case 'cash2025': return <td className="p-4 text-right text-xs text-sky-200">{formatNumberAbbreviated(value)}</td>;
            case 'credit2025': return <td className="p-4 text-right text-xs text-orange-200">{formatNumberAbbreviated(value)}</td>;
            case 'cashContribution2025': return <td className="p-4 text-right text-xs text-sky-200">{typeof value === 'number' ? `${value.toFixed(1)}%` : '-'}</td>;

            case 'sales2024': return <td className="p-4 text-right text-slate-400">{formatNumberAbbreviated(value)}</td>;
            case 'cash2024': return <td className="p-4 text-right text-xs text-sky-200/70">{formatNumberAbbreviated(value)}</td>;
            case 'credit2024': return <td className="p-4 text-right text-xs text-orange-200/70">{formatNumberAbbreviated(value)}</td>;
            case 'cashContribution2024': return <td className="p-4 text-right text-xs text-sky-200/70">{typeof value === 'number' ? `${value.toFixed(1)}%` : '-'}</td>;

            case 'growth': return <td className="p-4 text-right"><GrowthIndicator value={value} /></td>;
            case 'cashGrowth': return <td className="p-4 text-right text-xs"><GrowthIndicator value={value} /></td>;
            case 'creditGrowth': return <td className="p-4 text-right text-xs"><GrowthIndicator value={value} /></td>;

            case 'contribution2025':
            case 'contribution2024':
                return <td className="p-4 text-right">{typeof value === 'number' ? `${value.toFixed(2)}%` : '-'}</td>;
            default: return <td></td>;
        }
    };

    const handleDownloadCSV = () => {
        const csvHeaders = headers.map(h => h.label);
        const csvContent = [
            csvHeaders.join(','),
            ...processedData.map((item, index) =>
                headers.map(h => {
                    if (h.key === 'rowNumber') return index + 1;
                    const value = (item as any)[h.key];
                    if (typeof value === 'string' && value.includes(',')) return `"${value}"`;
                    if (typeof value === 'number' && h.key.includes('contribution')) return `${value.toFixed(2)}%`;
                    if (typeof value === 'number' && h.key === 'growth') {
                        if (value === Infinity) return 'New';
                        return `${value.toFixed(2)}%`;
                    }
                    return value;
                }).join(',')
            )
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.setAttribute('href', URL.createObjectURL(blob));
        link.setAttribute('download', `${viewType}_data.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleDownloadPDF = () => {
        const doc = new jsPDF();
        doc.text(tableTitle, 14, 20);

        const tableColumn = headers.map(h => h.label);
        const tableRows: any[][] = processedData.map((item, index) =>
            headers.map(h => {
                if (h.key === 'rowNumber') return index + 1;
                const value = (item as any)[h.key];
                if (h.key === 'growth') return value === Infinity ? 'New' : typeof value === 'number' ? `${value.toFixed(2)}%` : '-';
                if (h.key.includes('contribution')) return typeof value === 'number' ? `${value.toFixed(2)}%` : '-';
                if (typeof value === 'number') return formatNumberAbbreviated(value);
                return value || '-';
            })
        );

        (doc as any).autoTable({
            head: [tableColumn], body: tableRows, startY: 25, theme: 'grid',
            headStyles: { fillColor: [34, 197, 94] }, // Green-500
            styles: { font: 'helvetica', fontSize: 8 },
        });
        doc.save(`${viewType}_report.pdf`);
    };

    const tableFooter = useMemo(() => {
        const firstNumericIndex = headers.findIndex(h => ['sales2025', 'sales2024'].includes(h.key));
        let labelColSpan = headers.length;
        if (firstNumericIndex > -1) {
            labelColSpan = firstNumericIndex;
        }

        const totalContribution2025 = processedData.reduce((acc, item) => acc + ((item as any).contribution2025 || 0), 0);
        const totalContribution2024 = processedData.reduce((acc, item) => acc + ((item as any).contribution2024 || 0), 0);

        return (

            <tr className="bg-slate-700/90 text-sm font-bold uppercase tracking-wider text-white border-b-2 border-slate-500">
                <td colSpan={labelColSpan} className="p-4 text-center">
                    Totals ({summaryTotals.count.toLocaleString()} {entityTypeLabel})
                </td>
                {headers.slice(labelColSpan).map(h => {
                    switch (h.key) {
                        case 'sales2025': return <td key={h.key} className="p-4 text-right text-green-300">{formatNumberAbbreviated(summaryTotals.total2025)}</td>
                        case 'cash2025': return <td key={h.key} className="p-4 text-right text-xs text-sky-200">{formatNumberAbbreviated(summaryTotals.totalCash2025)}</td>
                        case 'credit2025': return <td key={h.key} className="p-4 text-right text-xs text-orange-200">{formatNumberAbbreviated(summaryTotals.totalCredit2025)}</td>
                        case 'cashContribution2025': return <td key={h.key} className="p-4 text-right text-xs text-sky-200">{summaryTotals.total2025 > 0 ? `${((summaryTotals.totalCash2025 / summaryTotals.total2025) * 100).toFixed(1)}%` : '-'}</td>

                        case 'sales2024': return <td key={h.key} className="p-4 text-right text-slate-300">{formatNumberAbbreviated(summaryTotals.total2024)}</td>
                        case 'cash2024': return <td key={h.key} className="p-4 text-right text-xs text-sky-200/70">{formatNumberAbbreviated(summaryTotals.totalCash2024)}</td>
                        case 'credit2024': return <td key={h.key} className="p-4 text-right text-xs text-orange-200/70">{formatNumberAbbreviated(summaryTotals.totalCredit2024)}</td>
                        case 'cashContribution2024': return <td key={h.key} className="p-4 text-right text-xs text-sky-200/70">{summaryTotals.total2024 > 0 ? `${((summaryTotals.totalCash2024 / summaryTotals.total2024) * 100).toFixed(1)}%` : '-'}</td>

                        case 'growth': return <td key={h.key} className="p-4 text-right"><GrowthIndicator value={summaryTotals.growth} /></td>

                        // Average or Total growth for subsets? Usually not additive. Leave blank or calc weighted avg.
                        case 'cashGrowth': {
                            const val = ((current, previous) => previous === 0 ? (current > 0 ? Infinity : 0) : ((current - previous) / previous) * 100)(summaryTotals.totalCash2025, summaryTotals.totalCash2024);
                            return <td key={h.key} className="p-4 text-right text-xs text-sky-200"><GrowthIndicator value={val} /></td>
                        }
                        case 'creditGrowth': {
                            const val = ((current, previous) => previous === 0 ? (current > 0 ? Infinity : 0) : ((current - previous) / previous) * 100)(summaryTotals.totalCredit2025, summaryTotals.totalCredit2024);
                            return <td key={h.key} className="p-4 text-right text-xs text-orange-200"><GrowthIndicator value={val} /></td>
                        }

                        default: return <td key={h.key}></td>;
                    }
                })}
            </tr>
        );

    }, [headers, processedData, summaryTotals, entityTypeLabel]);

    // FIX: Explicitly typed 'val' as string[] to resolve a type inference issue with Object.values.
    const activeFilterCount = Object.values(localFilters).reduce((acc, val: string[]) => acc + val.length, 0);
    const totalActiveIndicators = activeFilterCount + (searchTerm ? 1 : 0);

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <button onClick={handleBack} className="p-2 rounded-md bg-green-600 hover:bg-green-700 transition-colors" aria-label="Back">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 17l-5-5m0 0l5-5m-5 5h12" />
                        </svg>
                    </button>
                    <h1 className="text-3xl font-extrabold text-white">{tableTitle}</h1>
                </div>

                <div className="flex items-center gap-2">
                    <select
                        value={saleType}
                        onChange={(e) => setSaleType(e.target.value as 'ALL' | 'CASH' | 'CREDIT')}
                        className="bg-slate-700 text-white rounded-lg px-3 py-2 border border-slate-600 focus:ring-sky-500 focus:border-sky-500 text-sm font-bold"
                    >
                        <option value="ALL">Total Sales</option>
                        <option value="CASH">Cash Sales</option>
                        <option value="CREDIT">Credit Sales</option>
                    </select>

                    <button onClick={handleDownloadCSV} className="px-4 py-2 bg-slate-700 text-white font-bold rounded-lg shadow-md hover:bg-sky-600 transition-all flex items-center gap-2 text-sm">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        CSV
                    </button>
                    <button onClick={handleDownloadPDF} className="px-4 py-2 bg-slate-700 text-white font-bold rounded-lg shadow-md hover:bg-sky-600 transition-all flex items-center gap-2 text-sm">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        PDF
                    </button>
                </div>
            </div>
            <div className="p-6 bg-slate-800/50 rounded-2xl shadow-lg border border-slate-700">
                <h2 className="text-xl font-bold text-white mb-2">Table Insights</h2>
                <p className="text-slate-300 mb-4">{summaryDescription}</p>
                <div className={`grid grid-cols-2 ${performanceRateStats !== null ? 'md:grid-cols-5' : 'md:grid-cols-4'} gap-4 text-center`}>
                    <div className="bg-slate-700/50 p-4 rounded-lg">
                        <div className="text-sm font-bold text-slate-400 uppercase">Total {entityTypeLabel}</div>
                        <div className="text-2xl font-extrabold text-white">{summaryTotals.count.toLocaleString()}</div>
                    </div>
                    {performanceRateStats !== null && (
                        <div className="bg-slate-700/50 p-4 rounded-lg">
                            <div className="text-sm font-bold text-slate-400 uppercase">Items Performance Rate</div>
                            <div className="text-2xl font-extrabold text-sky-400">{performanceRateStats.rate.toFixed(2)}%</div>
                            <div className="text-sm font-bold text-green-400">{performanceRateStats.sold.toLocaleString()} / {performanceRateStats.total.toLocaleString()} sold</div>
                        </div>
                    )}
                    <div className="bg-slate-700/50 p-4 rounded-lg">
                        <div className="text-sm font-bold text-slate-400 uppercase">2025 Sales</div>
                        <div className="text-2xl font-extrabold text-green-400">{formatNumberAbbreviated(summaryTotals.total2025)}</div>
                    </div>
                    <div className="bg-slate-700/50 p-4 rounded-lg">
                        <div className="text-sm font-bold text-slate-400 uppercase">2024 Sales</div>
                        <div className="text-2xl font-extrabold text-slate-300">{formatNumberAbbreviated(summaryTotals.total2024)}</div>
                    </div>
                    <div className="bg-slate-700/50 p-4 rounded-lg">
                        <div className="text-sm font-bold text-slate-400 uppercase">Overall Growth</div>
                        <div className="text-2xl font-extrabold"><GrowthIndicator value={summaryTotals.growth} /></div>
                    </div>
                </div>
            </div>
            <div ref={filterContainerRef} className="p-6 bg-slate-800/50 rounded-2xl shadow-lg border border-slate-700">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="relative w-full md:max-w-md">
                        <input
                            type="text"
                            placeholder="Search by name or code..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-slate-700 border border-slate-600 rounded-lg py-3 pl-10 pr-4 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                        />
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className="relative px-6 py-3 bg-sky-600 text-white font-bold rounded-lg shadow-md hover:bg-sky-700 transition-all flex items-center gap-2"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                            </svg>
                            {showFilters ? 'Hide' : 'Show'} Filters
                            {totalActiveIndicators > 0 && (
                                <span className="absolute -top-2 -right-2 flex items-center justify-center h-6 w-6 rounded-full bg-green-500 text-white text-xs font-bold border-2 border-slate-800">
                                    {totalActiveIndicators}
                                </span>
                            )}
                        </button>
                        <button
                            onClick={resetLocalFilters}
                            className="px-6 py-3 bg-rose-600 text-white font-bold rounded-lg shadow-md hover:bg-rose-700 transition-all flex items-center gap-2"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M20 20v-5h-5M4 20h5v-5M20 4h-5v5" /></svg>
                            Reset
                        </button>
                    </div>
                </div>
                {showFilters && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-6 pt-6 border-t border-slate-700">
                        {globalFilterOptions && visibleFilters.division && (
                            <div className="flex flex-col h-64">
                                <label className="block text-sm font-bold text-slate-300 mb-2 ml-1">Filter by Division</label>
                                <input
                                    type="text"
                                    placeholder="Search..."
                                    className="mb-2 p-1.5 bg-slate-800 border border-slate-600 rounded text-xs text-white"
                                    value={filterSearch.division}
                                    onChange={(e) => setFilterSearch(prev => ({ ...prev, division: e.target.value }))}
                                />
                                <div className="bg-slate-700/50 rounded-lg p-2 overflow-y-auto border border-slate-600 flex-1">
                                    {globalFilterOptions.divisions.filter(o => o.toLowerCase().includes(filterSearch.division.toLowerCase())).map(opt => (
                                        <label key={opt} className="flex items-center space-x-2 p-1.5 hover:bg-slate-600/50 rounded cursor-pointer transition-colors">
                                            <input type="checkbox" checked={localFilters.division.includes(opt)} onChange={() => toggleFilter('division', opt)} className="form-checkbox h-4 w-4 text-sky-500 rounded bg-slate-800 border-slate-500" />
                                            <span className="text-slate-300 text-sm leading-tight">{opt}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}
                        {globalFilterOptions && visibleFilters.branch && (
                            <div className="flex flex-col h-64">
                                <label className="block text-sm font-bold text-slate-300 mb-2 ml-1">Filter by Branch</label>
                                <input
                                    type="text"
                                    placeholder="Search..."
                                    className="mb-2 p-1.5 bg-slate-800 border border-slate-600 rounded text-xs text-white"
                                    value={filterSearch.branch}
                                    onChange={(e) => setFilterSearch(prev => ({ ...prev, branch: e.target.value }))}
                                />
                                <div className="bg-slate-700/50 rounded-lg p-2 overflow-y-auto border border-slate-600 flex-1">
                                    {availableBranches.filter(o => o.toLowerCase().includes(filterSearch.branch.toLowerCase())).map(opt => (
                                        <label key={opt} className="flex items-center space-x-2 p-1.5 hover:bg-slate-600/50 rounded cursor-pointer transition-colors">
                                            <input type="checkbox" checked={localFilters.branch.includes(opt)} onChange={() => toggleFilter('branch', opt)} className="form-checkbox h-4 w-4 text-sky-500 rounded bg-slate-800 border-slate-500" />
                                            <span className="text-slate-300 text-sm leading-tight">{opt}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}
                        {globalFilterOptions && visibleFilters.brand && (
                            <div className="flex flex-col h-64">
                                <label className="block text-sm font-bold text-slate-300 mb-2 ml-1">Filter by Brand</label>
                                <input
                                    type="text"
                                    placeholder="Search..."
                                    className="mb-2 p-1.5 bg-slate-800 border border-slate-600 rounded text-xs text-white"
                                    value={filterSearch.brand}
                                    onChange={(e) => setFilterSearch(prev => ({ ...prev, brand: e.target.value }))}
                                />
                                <div className="bg-slate-700/50 rounded-lg p-2 overflow-y-auto border border-slate-600 flex-1">
                                    {availableBrands.filter(o => o.toLowerCase().includes(filterSearch.brand.toLowerCase())).map(opt => (
                                        <label key={opt} className="flex items-center space-x-2 p-1.5 hover:bg-slate-600/50 rounded cursor-pointer transition-colors">
                                            <input type="checkbox" checked={localFilters.brand.includes(opt)} onChange={() => toggleFilter('brand', opt)} className="form-checkbox h-4 w-4 text-sky-500 rounded bg-slate-800 border-slate-500" />
                                            <span className="text-slate-300 text-sm leading-tight">{opt}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}
                        {/* Item Description Filter - Always available if we have data, logic handled by useMemo if expansive, but let's try direct map first. Could be huge. */}
                        {/* Optimization: Only show available items in current view? The user asked for "filter per item description". */}
                        <div className="flex flex-col h-64">
                            <label className="block text-sm font-bold text-slate-300 mb-2 ml-1">Filter by Item</label>
                            <input
                                type="text"
                                placeholder="Search..."
                                className="mb-2 p-1.5 bg-slate-800 border border-slate-600 rounded text-xs text-white"
                                value={filterSearch.item}
                                onChange={(e) => setFilterSearch(prev => ({ ...prev, item: e.target.value }))}
                            />
                            <div className="bg-slate-700/50 rounded-lg p-2 overflow-y-auto border border-slate-600 flex-1">
                                {/* Using 50 cap to avoid explosive rendering, filtered by search */}
                                {Array.from(new Set(allRawData.map(r => r['ITEM DESCRIPTION']))).filter(o => o && o.toLowerCase().includes(filterSearch.item.toLowerCase())).slice(0, 100).map(opt => (
                                    <label key={opt} className="flex items-center space-x-2 p-1.5 hover:bg-slate-600/50 rounded cursor-pointer transition-colors">
                                        <input type="checkbox" checked={localFilters.item.includes(opt)} onChange={() => toggleFilter('item', opt)} className="form-checkbox h-4 w-4 text-sky-500 rounded bg-slate-800 border-slate-500" />
                                        <span className="text-slate-300 text-sm leading-tight truncate" title={opt}>{opt}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
                <div className="overflow-x-auto mt-6">
                    <table className="min-w-full text-left text-sm text-slate-300 table-sortable table-banded">
                        <thead className="bg-slate-700/50 text-xs text-slate-200 uppercase tracking-wider">
                            <tr>{headers.map(h => <th key={h.key} scope="col" className={`p-4 ${h.className || ''}`} onClick={() => requestSort(h.key)}><span className={getSortClassName(h.key)}>{h.label}</span></th>)}</tr>
                            {/* Grand Total Row Moved Here */}
                            {processedData.length > 0 && tableFooter}
                        </thead>
                        <tbody>
                            {processedData.map((item, index) => <tr key={`${item.name}-${index}`} className={`border-b border-slate-700 hover:bg-sky-500/10 transition-colors ${(item.sales2025 || 0) === 0 ? 'text-rose-400 bg-rose-900/10' : ''}`}>{headers.map(h => renderCell(item, h.key, index))}</tr>)}
                        </tbody>
                    </table>
                </div>
                {processedData.length === 0 && <div className="text-center py-8 text-slate-400">No results found for your search or filter selection.</div>}
            </div>
        </div >
    );
};

export default DrilldownView;