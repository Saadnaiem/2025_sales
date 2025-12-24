import { RawSalesDataRow, ProcessedData, ParetoResult, EntitySalesData } from '../types';

export const normalizeRow = (row: Record<string, string>, headers: string[]): RawSalesDataRow => {
    const normalized: { [key: string]: any } = {};
    const allPossibleHeaders = [
        'DIVISION', 'DEPARTMENT', 'CATEGORY', 'SUBCATEGORY', 'CLASS',
        'BRAND', 'BRANCH NAME', 'BRANCH CODE', 'ITEM CODE', 'ITEM DESCRIPTION',
        '2024 CASH SALES', '2024 CREDIT SALES', '2024 TOTAL SALES',
        '2025 CASH SALES', '2025 CREDIT SALES', '2025 TOTAL SALES',
        // Legacy maps if needed, but we focus on new ones. 
        'SALES2024', 'SALES2025'
    ];

    // Helper to find header case-insensitively
    const findHeader = (target: string) => headers.find(h => h.trim().toUpperCase() === target);

    for (const header of allPossibleHeaders) {
        const fileHeader = findHeader(header);
        let value = fileHeader ? row[fileHeader] : undefined;

        if (typeof value === 'string') {
            value = value.trim();
            if (value === '#N/A' || value === 'N/A' || value === '') {
                // For sales columns (containing SALES), default to '0'. Else empty string.
                value = header.includes('SALES') ? '0' : '';
            }
        }

        if (header.includes('SALES')) {
            const parseSalesValue = (val: any): number => {
                if (val === null || val === undefined) return 0;
                let str = String(val).trim();
                if (str === "" || str.toLowerCase() === 'n/a' || str === '#n/a') return 0;

                const isNegative = str.startsWith('-') || str.endsWith('-') || (str.startsWith('(') && str.endsWith(')'));
                const numericStr = str.replace(/[^0-9.]/g, '');
                const num = parseFloat(numericStr);

                if (isNaN(num)) return 0;

                const result = isNegative ? -Math.abs(num) : Math.abs(num);
                return result === 0 ? 0 : result;
            };
            normalized[header] = parseSalesValue(value);
        } else {
            normalized[header] = (typeof value === 'string' ? value.toUpperCase() : value) || '';
        }
    }

    // Map legacy SALES2024/2025 if they exist and the new ones don't, or vice-versa logic if needed.
    // Logic: If '2024 TOTAL SALES' is 0 but 'SALES2024' exists, maybe use that. 
    // BUT we trust the user's new file structure. 
    // We strictly map the new columns to the interface fields.


    // Create pre-computed search index
    normalized._searchIndex = [
        normalized['DIVISION'],
        normalized['DEPARTMENT'],
        normalized['CATEGORY'],
        normalized['SUBCATEGORY'],
        normalized['CLASS'],
        normalized['BRAND'],
        normalized['BRANCH NAME'],
        normalized['BRANCH CODE'],
        normalized['ITEM CODE'],
        normalized['ITEM DESCRIPTION']
    ].map(val => String(val || '').toLowerCase()).join(' ');

    return normalized as RawSalesDataRow;
};

const calculatePareto = (salesData: { name: string, sales: number }[]): { result: ParetoResult, contributors: string[] } => {
    const sortedData = salesData.filter(item => item.sales > 0).sort((a, b) => b.sales - a.sales);

    const totalContributors = sortedData.length;
    if (totalContributors === 0) return { result: { topCount: 0, salesPercent: 0, totalSales: 0, totalContributors: 0, topSales: 0 }, contributors: [] };

    const totalSales = sortedData.reduce((acc, item) => acc + item.sales, 0);
    if (totalSales === 0) return { result: { topCount: 0, salesPercent: 0, totalSales: 0, totalContributors, topSales: 0 }, contributors: [] };

    const top20PercentCount = Math.max(1, Math.ceil(totalContributors * 0.20));
    const count = Math.min(top20PercentCount, totalContributors);

    const topContributors = sortedData.slice(0, count);
    const salesFromTop20Percent = topContributors.reduce((acc, item) => acc + item.sales, 0);

    const percentOfSales = (salesFromTop20Percent / totalSales) * 100;

    return {
        result: {
            topCount: count,
            salesPercent: percentOfSales,
            totalSales,
            totalContributors,
            topSales: salesFromTop20Percent
        },
        contributors: topContributors.map(c => c.name)
    };
};

// Accumulator interface
interface SalesAgg {
    s24_total: number;
    s24_cash: number;
    s24_credit: number;
    s25_total: number;
    s25_cash: number;
    s25_credit: number;
    code?: string;
}

export const processSalesData = (data: RawSalesDataRow[], existingFilterOptions?: ProcessedData['filterOptions'], saleType: 'ALL' | 'CASH' | 'CREDIT' = 'ALL'): ProcessedData => {
    if (data.length === 0) return null as any;

    let totalSales2024 = 0;
    let totalSales2025 = 0;
    let totalCashSales2024 = 0;
    let totalCashSales2025 = 0;
    let totalCreditSales2024 = 0;
    let totalCreditSales2025 = 0;

    // Aggregators for all dimensions
    const divisions: { [key: string]: SalesAgg } = {};
    const departments: { [key: string]: SalesAgg } = {};
    const categories: { [key: string]: SalesAgg } = {};
    const subcategories: { [key: string]: SalesAgg } = {};
    const classes: { [key: string]: SalesAgg } = {};
    const brands: { [key: string]: SalesAgg } = {};
    const branches: { [key: string]: SalesAgg } = {};
    const items: { [key: string]: SalesAgg } = {};

    const distinct = {
        branches24: new Set<string>(), branches25: new Set<string>(),
        brands24: new Set<string>(), brands25: new Set<string>(),
        items24: new Set<string>(), items25: new Set<string>(),
    };

    data.forEach(row => {
        // Extract metrics
        const cash24 = row['2024 CASH SALES'] || 0;
        const credit24 = row['2024 CREDIT SALES'] || 0;
        const total24 = row['2024 TOTAL SALES'] || (cash24 + credit24) || row['SALES2024'] || 0;

        const cash25 = row['2025 CASH SALES'] || 0;
        const credit25 = row['2025 CREDIT SALES'] || 0;
        const total25 = row['2025 TOTAL SALES'] || (cash25 + credit25) || row['SALES2025'] || 0;

        totalSales2024 += total24;
        totalSales2025 += total25;
        totalCashSales2024 += cash24;
        totalCashSales2025 += cash25;
        totalCreditSales2024 += credit24;
        totalCreditSales2025 += credit25;

        // Generic aggregator function
        const aggregate = (store: { [key: string]: SalesAgg }, key: string, code?: string) => {
            if (!key) return;
            if (!store[key]) {
                store[key] = {
                    s24_total: 0, s24_cash: 0, s24_credit: 0,
                    s25_total: 0, s25_cash: 0, s25_credit: 0,
                    code: code
                };
            }
            store[key].s24_total += total24;
            store[key].s24_cash += cash24;
            store[key].s24_credit += credit24;
            store[key].s25_total += total25;
            store[key].s25_cash += cash25;
            store[key].s25_credit += credit25;
        };

        aggregate(divisions, row['DIVISION']);
        aggregate(departments, row['DEPARTMENT'] || '');
        aggregate(categories, row['CATEGORY'] || '');
        aggregate(subcategories, row['SUBCATEGORY'] || '');
        aggregate(classes, row['CLASS'] || '');
        aggregate(brands, row['BRAND']);
        aggregate(branches, row['BRANCH NAME'], row['BRANCH CODE']);
        aggregate(items, row['ITEM DESCRIPTION'], row['ITEM CODE']);

        // Distinct counting for KPIs (using filtered Sales > 0 as active criteria)
        const active24 = saleType === 'ALL' ? total24 : (saleType === 'CASH' ? cash24 : credit24);
        const active25 = saleType === 'ALL' ? total25 : (saleType === 'CASH' ? cash25 : credit25);

        if (row['BRANCH NAME']) {
            if (active24 > 0) distinct.branches24.add(row['BRANCH NAME']);
            if (active25 > 0) distinct.branches25.add(row['BRANCH NAME']);
        }
        if (row['BRAND']) {
            if (active24 > 0) distinct.brands24.add(row['BRAND']);
            if (active25 > 0) distinct.brands25.add(row['BRAND']);
        }
        if (row['ITEM DESCRIPTION']) {
            if (active24 > 0) distinct.items24.add(row['ITEM DESCRIPTION']);
            if (active25 > 0) distinct.items25.add(row['ITEM DESCRIPTION']);
        }
    });

    const calculateGrowth = (current: number, previous: number) =>
        previous === 0 ? (current > 0 ? Infinity : 0) : ((current - previous) / previous) * 100;

    const finalTotalSales2024 = saleType === 'ALL' ? totalSales2024 : (saleType === 'CASH' ? totalCashSales2024 : totalCreditSales2024);
    const finalTotalSales2025 = saleType === 'ALL' ? totalSales2025 : (saleType === 'CASH' ? totalCashSales2025 : totalCreditSales2025);

    const salesGrowthPercentage = calculateGrowth(finalTotalSales2025, finalTotalSales2024);

    const transform = (obj: { [key: string]: SalesAgg }): EntitySalesData[] =>
        Object.entries(obj).map(([name, data]) => {
            let primarySales24 = data.s24_total;
            let primarySales25 = data.s25_total;

            if (saleType === 'CASH') {
                primarySales24 = data.s24_cash;
                primarySales25 = data.s25_cash;
            } else if (saleType === 'CREDIT') {
                primarySales24 = data.s24_credit;
                primarySales25 = data.s25_credit;
            }

            return {
                name,
                sales2024: primarySales24,
                sales2025: primarySales25,
                cashSales2024: data.s24_cash,
                creditSales2024: data.s24_credit,
                cashSales2025: data.s25_cash,
                creditSales2025: data.s25_credit,
                growth: calculateGrowth(primarySales25, primarySales24),
                code: data.code
            };
        });

    // Generate arrays
    const salesByDivision = transform(divisions).sort((a, b) => b.sales2025 - a.sales2025);
    const salesByDepartment = transform(departments).sort((a, b) => b.sales2025 - a.sales2025);
    const salesByCategory = transform(categories).sort((a, b) => b.sales2025 - a.sales2025);
    const salesBySubcategory = transform(subcategories).sort((a, b) => b.sales2025 - a.sales2025);
    const salesByClass = transform(classes).sort((a, b) => b.sales2025 - a.sales2025);
    const salesByBrand = transform(brands).sort((a, b) => b.sales2025 - a.sales2025);
    const salesByBranch = transform(branches).sort((a, b) => b.sales2025 - a.sales2025);
    const salesByItem = transform(items).sort((a, b) => b.sales2025 - a.sales2025);

    const top10Brands = salesByBrand.slice(0, 10).map(({ name, sales2024, sales2025 }) => ({ name, sales2024, sales2025 }));
    const top50Items = salesByItem.slice(0, 50).map(({ name, sales2024, sales2025 }) => ({ name, sales2024, sales2025 }));
    const topDivision = salesByDivision[0] || null;

    // Pareto (using Total Sales 2025)
    // FIX: Use filtered sales for Pareto too? The user said "all charts and cards... filtered". 
    // Pareto usually implies importance. If I filter for Cash, I probably want Pareto of Cash.
    // The previous code passed `i.sales2025` which comes from `salesBy...` which IS already transformed/filtered.
    // SO Pareto is already correct.
    const paretoBranches = calculatePareto(salesByBranch.map(i => ({ name: i.name, sales: i.sales2025 })));
    const paretoBrands = calculatePareto(salesByBrand.map(i => ({ name: i.name, sales: i.sales2025 })));
    const paretoItems = calculatePareto(salesByItem.map(i => ({ name: i.name, sales: i.sales2025 })));

    // Contributors mapping
    const paretoContributors = {
        branches: salesByBranch.filter(b => paretoBranches.contributors.includes(b.name)),
        brands: salesByBrand.filter(b => paretoBrands.contributors.includes(b.name)),
        items: salesByItem.filter(i => paretoItems.contributors.includes(i.name)),
    };

    // New/Lost entities (Logic uses total sales)
    // FIX: Should use filtered sales.
    // The current implementation uses: `x.sales2025 > 0`. `x.sales2025` is transformed/filtered.
    // So `salesByBranch` has filtered sales.
    // `newBranchesSales` sum uses `curr.sales2025`. Correct.
    // `percentOfTotal` uses `totalSales2025` (the raw variable). This is WRONG if we want % of *filtered* total.
    // I need to use `finalTotalSales2025`.

    // Calculating New Entities
    const newBranchNames = salesByBranch.filter(x => x.sales2025 > 0 && x.sales2024 === 0);
    const newBranchesSales = newBranchNames.reduce((acc, curr) => acc + curr.sales2025, 0);
    const newBranches = {
        count: newBranchNames.length,
        sales: newBranchesSales,
        percentOfTotal: finalTotalSales2025 > 0 ? (newBranchesSales / finalTotalSales2025) * 100 : 0
    };

    const newBrandsListFull = salesByBrand.filter(x => x.sales2025 > 0 && x.sales2024 === 0);
    const newBrandsSales = newBrandsListFull.reduce((acc, curr) => acc + curr.sales2025, 0);
    const newBrands = {
        count: newBrandsListFull.length,
        sales: newBrandsSales,
        percentOfTotal: finalTotalSales2025 > 0 ? (newBrandsSales / finalTotalSales2025) * 100 : 0
    };

    const newItemsListFull = salesByItem.filter(x => x.sales2025 > 0 && x.sales2024 === 0);
    const newItemsSales = newItemsListFull.reduce((acc, curr) => acc + curr.sales2025, 0);
    const newItems = {
        count: newItemsListFull.length,
        sales: newItemsSales,
        percentOfTotal: finalTotalSales2025 > 0 ? (newItemsSales / finalTotalSales2025) * 100 : 0
    };

    // Calculating Lost Entities
    const lostBrandsListFull = salesByBrand.filter(x => x.sales2024 > 0 && x.sales2025 === 0);
    const lostBrandsSales = lostBrandsListFull.reduce((acc, curr) => acc + curr.sales2024, 0);
    const lostBrands = {
        count: lostBrandsListFull.length,
        sales2024: lostBrandsSales,
        percentOfTotal: finalTotalSales2024 > 0 ? (lostBrandsSales / finalTotalSales2024) * 100 : 0
    };

    const lostItemsListFull = salesByItem.filter(x => x.sales2024 > 0 && x.sales2025 === 0);
    const lostItemsSales = lostItemsListFull.reduce((acc, curr) => acc + curr.sales2024, 0);
    const lostItems = {
        count: lostItemsListFull.length,
        sales2024: lostItemsSales,
        percentOfTotal: finalTotalSales2024 > 0 ? (lostItemsSales / finalTotalSales2024) * 100 : 0
    };

    return {
        // We will return totalSales based on filter for general charts, but also expose the raw totals explicitly.
        totalSales2024: finalTotalSales2024,
        totalSales2025: finalTotalSales2025,
        totalCashSales2024: saleType === 'CREDIT' ? 0 : totalCashSales2024,
        totalCashSales2025: saleType === 'CREDIT' ? 0 : totalCashSales2025,
        totalCreditSales2024: saleType === 'CASH' ? 0 : totalCreditSales2024,
        totalCreditSales2025: saleType === 'CASH' ? 0 : totalCreditSales2025,
        salesGrowthPercentage,
        salesByDivision,
        salesByDepartment,
        salesByCategory,
        salesBySubcategory,
        salesByClass,
        salesByBrand,
        salesByBranch,
        salesByItem,
        top10Brands,
        top50Items,
        topDivision,
        branchCount2024: distinct.branches24.size,
        branchCount2025: distinct.branches25.size,
        brandCount2024: distinct.brands24.size,
        brandCount2025: distinct.brands25.size,
        itemCount2024: distinct.items24.size,
        itemCount2025: distinct.items25.size,
        pareto: {
            branches: paretoBranches.result,
            brands: paretoBrands.result,
            items: paretoItems.result,
        },
        paretoContributors,
        newEntities: {
            branches: newBranches,
            brands: newBrands,
            items: newItems,
        },
        newBrandsList: newBrandsListFull.map(x => ({ name: x.name, sales2025: x.sales2025 })),
        newItemsList: newItemsListFull.map(x => ({ name: x.name, sales2025: x.sales2025, code: x.code || '' })),
        lostEntities: {
            brands: lostBrands,
            items: lostItems,
        },
        lostBrandsList: lostBrandsListFull.map(x => ({ name: x.name, sales2024: x.sales2024 })),
        lostItemsList: lostItemsListFull.map(x => ({ name: x.name, sales2024: x.sales2024, code: x.code || '' })),
        filterOptions: existingFilterOptions || {
            divisions: [...new Set(data.map(r => r['DIVISION']))].filter((x): x is string => !!x).sort(),
            departments: [...new Set(data.map(r => r['DEPARTMENT']))].filter((x): x is string => !!x).sort(),
            categories: [...new Set(data.map(r => r['CATEGORY']))].filter((x): x is string => !!x).sort(),
            subcategories: [...new Set(data.map(r => r['SUBCATEGORY']))].filter((x): x is string => !!x).sort(),
            classes: [...new Set(data.map(r => r['CLASS']))].filter((x): x is string => !!x).sort(),
            branches: [...new Set(data.map(r => r['BRANCH NAME']))].filter((x): x is string => !!x).sort(),
            brands: [...new Set(data.map(r => r['BRAND']))].filter((x): x is string => !!x).sort(),
        },
    };
};