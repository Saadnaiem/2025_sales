export interface RawSalesDataRow {
    [key: string]: any;
    'DIVISION': string;
    'DEPARTMENT'?: string;
    'CATEGORY'?: string;
    'SUBCATEGORY'?: string;
    'CLASS'?: string;
    'BRAND': string;
    'BRANCH CODE'?: string;
    'BRANCH NAME': string;
    'ITEM CODE'?: string;
    'ITEM DESCRIPTION': string;

    // 2024 Metrics
    '2024 CASH SALES': number;
    '2024 CREDIT SALES': number;
    '2024 TOTAL SALES': number;

    // 2025 Metrics
    '2025 CASH SALES': number;
    '2025 CREDIT SALES': number;
    '2025 TOTAL SALES': number;

    // Legacy support (optional, can be mapped from above)
    'SALES2024'?: number;
    'SALES2025'?: number;

    // Search Optimization
    _searchIndex?: string;
}

export interface ParetoResult {
    topCount: number;
    salesPercent: number;
    totalSales: number;
    totalContributors: number;
    topSales: number;
}

export interface EntitySalesData {
    name: string;
    sales2024: number; // Total Sales 2024
    sales2025: number; // Total Sales 2025

    cashSales2024: number;
    creditSales2024: number;

    cashSales2025: number;
    creditSales2025: number;

    growth: number;
    code?: string;
}

export interface ProcessedData {
    totalSales2024: number;
    totalSales2025: number;
    totalCashSales2024: number;
    totalCashSales2025: number;
    totalCreditSales2024: number;
    totalCreditSales2025: number;
    salesGrowthPercentage: number;

    salesByDivision: EntitySalesData[];
    salesByDepartment: EntitySalesData[];
    salesByCategory: EntitySalesData[];
    salesBySubcategory: EntitySalesData[];
    salesByClass: EntitySalesData[];
    salesByBrand: EntitySalesData[];
    salesByBranch: EntitySalesData[];
    salesByItem: EntitySalesData[];

    top10Brands: { name: string; sales2024: number; sales2025: number }[];
    top50Items: { name: string; sales2024: number; sales2025: number }[];

    branchCount2024: number;
    branchCount2025: number;
    brandCount2024: number;
    brandCount2025: number;
    itemCount2024: number;
    itemCount2025: number;

    topDivision: { name: string; sales2024: number; sales2025: number; growth: number; } | null;

    pareto: {
        branches: ParetoResult;
        brands: ParetoResult;
        items: ParetoResult;
    };

    paretoContributors: {
        branches: EntitySalesData[];
        brands: EntitySalesData[];
        items: EntitySalesData[];
    };

    newEntities: {
        branches: { count: number; sales: number; percentOfTotal: number };
        brands: { count: number; sales: number; percentOfTotal: number };
        items: { count: number; sales: number; percentOfTotal: number };
    };

    newBrandsList: { name: string; sales2025: number }[];
    newItemsList: { name: string; sales2025: number; code: string }[];

    lostEntities: {
        brands: { count: number; sales2024: number; percentOfTotal: number };
        items: { count: number; sales2024: number; percentOfTotal: number };
    };

    lostBrandsList: { name: string; sales2024: number }[];
    lostItemsList: { name: string; sales2024: number; code: string }[];

    filterOptions: {
        divisions: string[];
        departments: string[];
        categories: string[];
        subcategories: string[];
        classes: string[];
        branches: string[];
        brands: string[];
        items: string[];
    };
}

export interface FilterState {
    divisions: string[];
    departments: string[];
    categories: string[];
    subcategories: string[];
    classes: string[];
    branches: string[];
    brands: string[];
    items: string[];
    saleType: 'ALL' | 'CASH' | 'CREDIT';
}