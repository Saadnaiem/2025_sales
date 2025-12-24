import React from 'react';
import { ProcessedData } from '../types';

// For full numbers (counts)
const formatNumber = (num: number, decimals = 0): string => {
    if (num === null || num === undefined || isNaN(num)) return '-';
    if (num === Infinity) return '∞';
    return num.toLocaleString(undefined, { maximumFractionDigits: decimals });
};

// For abbreviated numbers (sales)
const formatNumberAbbreviated = (num: number): string => {
    if (num === null || num === undefined || isNaN(num)) return '-';
    if (Math.abs(num) >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (Math.abs(num) >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (Math.abs(num) >= 1e3) return (num / 1e3).toFixed(1) + 'K';
    return num.toLocaleString(undefined, { maximumFractionDigits: 0 });
};

const GrowthIndicator: React.FC<{ value: number, unit?: string, invert?: boolean }> = ({ value, unit = '%', invert = false }) => {
    const isPositive = !invert ? value >= 0 : value <= 0;
    const color = isPositive ? 'text-green-400' : 'text-rose-400';
    const icon = isPositive ? '▲' : '▼';

    if (value === Infinity) {
        return <div className="text-xl font-bold text-green-400">▲ New</div>;
    }
    if (isNaN(value)) return null;
    return <div className={`text-xl font-bold ${color}`}>{icon} {Math.abs(value).toFixed(2)}{unit}</div>;
};

const SummaryCard: React.FC<{ title: string; icon: React.ReactNode; children?: React.ReactNode; trend?: { value: number; isPositive: boolean }; color?: string; borderColor?: string; value?: string | number }> = ({ title, icon, children, trend, color, borderColor, value }) => (
    <div className={`flex flex-col h-full bg-slate-800/50 rounded-2xl shadow-xl p-6 border border-slate-700 hover:border-sky-500 hover:shadow-sky-500/10 hover:-translate-y-1 transition-all duration-300`}>
        <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">{icon}</span>
            <div className="text-base font-bold text-slate-300 uppercase tracking-wider">{title}</div>
        </div>
        {value && (
            <div className="flex items-end gap-2 mb-2">
                <p className="text-3xl font-extrabold text-white">{value}</p>
                {/* <span className="text-xs text-slate-400 mb-1.5 font-medium">2025</span> */}
            </div>
        )}
        <div className="flex-1 flex flex-col justify-center text-left text-base font-medium text-slate-300">
            {children}
        </div>
        {trend && (
            <div className="flex items-center gap-2 pt-2 border-t border-slate-700/50 mt-2">
                <span className={`text-sm font-bold flex items-center gap-1 ${trend.isPositive ? 'text-green-400' : 'text-red-400'}`}>
                    {trend.isPositive ? '▲' : '▼'} {trend.value.toFixed(1)}%
                </span>
                <span className="text-xs text-slate-500">vs 2024</span>
            </div>
        )}
    </div>
);

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <h3 className="text-lg font-semibold text-slate-400 tracking-wider mb-4 border-b-2 border-slate-700 pb-2">{children}</h3>
);

interface SummaryCardsProps {
    data: ProcessedData;
    saleType: 'ALL' | 'CASH' | 'CREDIT';
}

const SummaryCards: React.FC<SummaryCardsProps> = ({ data, saleType }) => {
    // 1. Calculate Growth helper
    const calculateGrowth = (current: number, previous: number) => {
        if (previous === 0) return 0;
        return ((current - previous) / previous) * 100;
    };

    // 2. Prepare metrics for each type
    const totalGrowth = calculateGrowth(data.totalSales2025, data.totalSales2024);
    const cashGrowth = calculateGrowth(data.totalCashSales2025, data.totalCashSales2024);
    const creditGrowth = calculateGrowth(data.totalCreditSales2025, data.totalCreditSales2024);

    // 3. Helper to render a Sales Card
    const renderSalesCard = (title: string, current: number, previous: number, growth: number, colorClass: string, iconColor: string) => {
        const growthColor = growth >= 0 ? 'text-green-400' : 'text-red-400';
        const growthSign = growth >= 0 ? '+' : '';

        return (
            <div className={`p-6 rounded-2xl shadow-lg border border-slate-700 bg-gradient-to-br from-slate-800 to-slate-900`}>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-slate-400 font-bold text-sm uppercase tracking-wider">{title}</h3>
                    <div className="p-2 bg-slate-700/50 rounded-lg">
                        <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 ${iconColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                </div>
                <div className="space-y-2">
                    <div className="flex items-end gap-2">
                        <p className={`text-3xl font-extrabold ${colorClass}`}>{formatNumberAbbreviated(current)}</p>
                        <span className="text-xs text-slate-400 mb-1.5 font-medium">2025</span>
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-slate-700/50">
                        <p className={`text-sm font-bold ${growthColor} flex items-center gap-1`}>
                            {growth >= 0 ? (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 8.586 15.586 4H12z" clipRule="evenodd" /></svg>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12 13a1 1 0 100 2h5a1 1 0 001-1v-5a1 1 0 10-2 0v2.586l-4.293-4.293a1 1 0 00-1.414 0L8 9.586 3.707 5.293a1 1 0 00-1.414 1.414l5 5a1 1 0 001.414 0L11 7.414 15.586 12H12z" clipRule="evenodd" /></svg>
                            )}
                            {growthSign}{growth.toFixed(1)}%
                        </p>
                        <p className="text-xs text-slate-500">vs {formatNumberAbbreviated(previous)} (2024)</p>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col gap-8">
            <section>
                {/* 3 Columns to accommodate Total, Cash, Credit + Entities nicely */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                    {/* 1. SALES CARDS */}
                    {/* Always show Total (matches the filter context if specific, or global total if 'ALL') */}
                    {saleType === 'ALL' &&
                        renderSalesCard("Total Sales", data.totalSales2025, data.totalSales2024, totalGrowth, "text-white", "text-sky-400")
                    }
                    {saleType === 'CASH' &&
                        renderSalesCard("Cash Sales", data.totalCashSales2025, data.totalCashSales2024, cashGrowth, "text-emerald-200", "text-emerald-400")
                    }
                    {saleType === 'CREDIT' &&
                        renderSalesCard("Credit Sales", data.totalCreditSales2025, data.totalCreditSales2024, creditGrowth, "text-orange-200", "text-orange-400")
                    }

                    {/* Show dedicated Cash/Credit cards ONLY if we are in 'ALL' mode, OR if specifically selected */}
                    {(saleType === 'ALL') &&
                        renderSalesCard("Cash Sales", data.totalCashSales2025, data.totalCashSales2024, cashGrowth, "text-emerald-200", "text-emerald-400")
                    }

                    {(saleType === 'ALL') &&
                        renderSalesCard("Credit Sales", data.totalCreditSales2025, data.totalCreditSales2024, creditGrowth, "text-orange-200", "text-orange-400")
                    }

                    {/* 2. ENTITY CARDS */}
                    {/* Branch Count Card */}
                    <div className={`p-6 rounded-2xl shadow-lg border border-slate-700 bg-gradient-to-br from-slate-800 to-slate-900`}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-slate-400 font-bold text-sm uppercase tracking-wider">Active Branches</h3>
                            <div className="p-2 bg-slate-700/50 rounded-lg">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                </svg>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-end gap-2">
                                <p className="text-3xl font-extrabold text-white">{data.branchCount2025}</p>
                                <span className="text-xs text-slate-400 mb-1.5 font-medium">2025</span>
                            </div>
                            <div className="flex items-center gap-2 pt-2 border-t border-slate-700/50">
                                <span className="text-xs text-slate-500">vs {data.branchCount2024} (2024)</span>
                            </div>
                        </div>
                    </div>

                    {/* Brand Count Card */}
                    <div className={`p-6 rounded-2xl shadow-lg border border-slate-700 bg-gradient-to-br from-slate-800 to-slate-900`}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-slate-400 font-bold text-sm uppercase tracking-wider">Active Brands</h3>
                            <div className="p-2 bg-slate-700/50 rounded-lg">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                </svg>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-end gap-2">
                                <p className="text-3xl font-extrabold text-white">{data.brandCount2025}</p>
                                <span className="text-xs text-slate-400 mb-1.5 font-medium">2025</span>
                            </div>
                            <div className="flex items-center gap-2 pt-2 border-t border-slate-700/50">
                                <span className="text-xs text-slate-500">vs {data.brandCount2024} (2024)</span>
                            </div>
                        </div>
                    </div>

                    {/* Item Count Card */}
                    <div className={`p-6 rounded-2xl shadow-lg border border-slate-700 bg-gradient-to-br from-slate-800 to-slate-900`}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-slate-400 font-bold text-sm uppercase tracking-wider">Active Items</h3>
                            <div className="p-2 bg-slate-700/50 rounded-lg">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-pink-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                </svg>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-end gap-2">
                                <p className="text-3xl font-extrabold text-white">{data.itemCount2025}</p>
                                <span className="text-xs text-slate-400 mb-1.5 font-medium">2025</span>
                            </div>
                            <div className="flex items-center gap-2 pt-2 border-t border-slate-700/50">
                                <span className="text-xs text-slate-500">vs {data.itemCount2024} (2024)</span>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section>
                <SectionTitle>Pareto Analysis (80/20 Rule)</SectionTitle>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <SummaryCard title="Branches" icon="📊">
                        <p>Top <b>{data.pareto.branches.topCount}</b> (20%) of <b>{data.pareto.branches.totalContributors}</b> branches generate <b>{data.pareto.branches.salesPercent.toFixed(1)}%</b> of 2025 sales.</p>
                    </SummaryCard>
                    <SummaryCard title="Brands" icon="📊">
                        <p>Top <b>{data.pareto.brands.topCount}</b> (20%) of <b>{data.pareto.brands.totalContributors}</b> brands generate <b>{data.pareto.brands.salesPercent.toFixed(1)}%</b> of 2025 sales.</p>
                    </SummaryCard>
                    <SummaryCard title="Items" icon="📊">
                        <p>Top <b>{data.pareto.items.topCount}</b> (20%) of <b>{data.pareto.items.totalContributors}</b> items generate <b>{data.pareto.items.salesPercent.toFixed(1)}%</b> of sales.</p>
                    </SummaryCard>
                </div>
            </section>

            <section>
                <SectionTitle>Brand & Item Lifecycle</SectionTitle>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    <SummaryCard title="New Brands (2025)" icon="✨">
                        <div className="text-3xl font-extrabold text-green-400">{formatNumber(data.newEntities.brands.count)}</div>
                        <div className="text-sm">Sales: {formatNumberAbbreviated(data.newEntities.brands.sales)}</div>
                        <div className="text-sm">{data.newEntities.brands.percentOfTotal.toFixed(2)}% of Total Sales</div>
                    </SummaryCard>

                    <SummaryCard title="Lost Brands (2024)" icon="👋">
                        <div className="text-3xl font-extrabold text-rose-400">{formatNumber(data.lostEntities.brands.count)}</div>
                        <div className="text-base font-bold text-slate-400">2024 Sales: {formatNumberAbbreviated(data.lostEntities.brands.sales2024)}</div>
                        <div className="text-sm">{data.lostEntities.brands.percentOfTotal.toFixed(2)}% of 2024 Sales</div>
                    </SummaryCard>

                    <SummaryCard title="New Items (2025)" icon="💡">
                        <div className="text-3xl font-extrabold text-green-400">{formatNumber(data.newEntities.items.count)}</div>
                        <div className="text-sm">Sales: {formatNumberAbbreviated(data.newEntities.items.sales)}</div>
                        <div className="text-sm">{data.newEntities.items.percentOfTotal.toFixed(2)}% of Total Sales</div>
                    </SummaryCard>

                    <SummaryCard title="Lost Items (2024)" icon="📉">
                        <div className="text-3xl font-extrabold text-rose-400">{formatNumber(data.lostEntities.items.count)}</div>
                        <div className="text-base font-bold text-slate-400">2024 Sales: {formatNumberAbbreviated(data.lostEntities.items.sales2024)}</div>
                        <div className="text-sm">{data.lostEntities.items.percentOfTotal.toFixed(2)}% of 2024 Sales</div>
                    </SummaryCard>
                </div>
            </section>
        </div>
    );
};

export default SummaryCards;