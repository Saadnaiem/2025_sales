import React from 'react';
import { Link } from 'react-router-dom';
import { ProcessedData } from '../types';
import { formatNumber, formatNumberAbbreviated, GrowthIndicator } from '../utils/formatters';

const SummaryCard: React.FC<{ title: string; icon: string; children: React.ReactNode; to?: string; }> = ({ title, icon, children, to }) => {
    const cardContent = (
        <div
            className={`flex flex-col h-full bg-slate-800/50 rounded-2xl shadow-xl p-6 border border-slate-700 hover:border-sky-500 hover:shadow-sky-500/10 hover:-translate-y-1 transition-all duration-300 ${to ? 'cursor-pointer' : ''}`}
            role={to ? 'link' : undefined}
            aria-label={`View details for ${title}`}
        >
            <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">{icon}</span>
                <div className="text-base font-bold text-slate-300 uppercase tracking-wider">{title}</div>
            </div>
            <div className="flex-1 flex flex-col justify-center text-left text-base font-medium text-slate-300">
                {children}
            </div>
        </div>
    );

    return to ? <Link to={to} className="focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-2xl">{cardContent}</Link> : cardContent;
};

const MetricCard: React.FC<{ title: string; icon: string; value2025: number; value2024: number; to: string; }> = ({ title, icon, value2025, value2024, to }) => (
    <SummaryCard title={title} icon={icon} to={to}>
        <div className="text-3xl font-extrabold text-green-400">{formatNumber(value2025, 0)}</div>
        <div className="text-base font-bold text-slate-400">2024: {formatNumber(value2024, 0)}</div>
        <GrowthIndicator value={value2024 === 0 ? 0 : ((value2025 - value2024) / value2024) * 100} unit="" className="text-xl mt-1" />
    </SummaryCard>
);

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <h3 className="text-lg font-semibold text-slate-400 tracking-wider mb-4 border-b-2 border-slate-700 pb-2">{children}</h3>
);

export interface SummaryCardsProps {
    data: ProcessedData;
    saleType: 'ALL' | 'CASH' | 'CREDIT';
    filteredBranchCount?: number;
    totalBranchCount?: number;
    percentTotal2025?: number;
    percentTotal2024?: number;
    percentCash2025?: number;
    percentCash2024?: number;
    percentCredit2025?: number;
    percentCredit2024?: number;
}

const SummaryCards: React.FC<SummaryCardsProps> = ({ 
    data, 
    saleType,
    filteredBranchCount,
    totalBranchCount,
    percentTotal2025,
    percentTotal2024,
    percentCash2025,
    percentCash2024,
    percentCredit2025,
    percentCredit2024
}) => {
    const isFiltered = saleType !== 'ALL';

    return (
        <div className="flex flex-col gap-8">
            <section>
                <SectionTitle>{isFiltered ? `${saleType === 'CASH' ? 'Cash' : 'Credit'} Sales Overview` : 'Key Metrics Breakdown'}</SectionTitle>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                    {/* Filtered Branches Card */}
                    <SummaryCard title="Branches" icon="🏬" to="/details/branches">
                        <div className="text-3xl font-extrabold text-green-400">
                            {filteredBranchCount ?? data.branchCount2025} / {totalBranchCount ?? data.branchCount2025}
                        </div>
                        <div className="text-sm font-bold text-slate-400 mb-1">Filtered / Total</div>
                        <div className="text-xs text-slate-400 font-semibold">2025: {data.branchCount2025} branches</div>
                        <div className="text-xs text-slate-400 font-semibold">2024: {data.branchCount2024} branches</div>
                    </SummaryCard>
                    
                    {/* % Sales of Filtered Branches Card */}
                    <SummaryCard title="% Sales (Filtered Branches)" icon="📊">
                        <div className="text-lg text-slate-300">2025: <span className="font-extrabold text-green-400">{(percentTotal2025 ?? 100).toFixed(1)}%</span></div>
                        <div className="text-lg text-slate-300">2024: <span className="font-extrabold text-slate-400">{(percentTotal2024 ?? 100).toFixed(1)}%</span></div>
                    </SummaryCard>
                    
                    {/* Total Sales Card */}
                    <SummaryCard title="Total Sales" icon="💰">
                        <div className="text-lg text-slate-300">2025: <span className="font-extrabold text-green-400">{formatNumberAbbreviated(data.totalSales2025)}</span> {percentTotal2025 !== undefined && <span className="text-xs">({percentTotal2025.toFixed(1)}%)</span>}</div>
                        <div className="text-lg text-slate-300">2024: <span className="font-extrabold text-slate-400">{formatNumberAbbreviated(data.totalSales2024)}</span> {percentTotal2024 !== undefined && <span className="text-xs">({percentTotal2024.toFixed(1)}%)</span>}</div>
                        <div className="mt-1"><GrowthIndicator value={data.totalSales2024 === 0 ? (data.totalSales2025 > 0 ? Infinity : 0) : ((data.totalSales2025 - data.totalSales2024) / data.totalSales2024) * 100} className="text-sm" /></div>
                    </SummaryCard>
                    
                    {/* Cash Sales Card */}
                    <SummaryCard title="Cash Sales" icon="💵">
                        <div className="text-lg text-sky-300">2025: <span className="font-extrabold text-sky-400">{formatNumberAbbreviated(data.totalCashSales2025)}</span> {percentCash2025 !== undefined && <span className="text-xs">({percentCash2025.toFixed(1)}%)</span>}</div>
                        <div className="text-lg text-sky-300">2024: <span className="font-extrabold text-sky-200">{formatNumberAbbreviated(data.totalCashSales2024)}</span> {percentCash2024 !== undefined && <span className="text-xs">({percentCash2024.toFixed(1)}%)</span>}</div>
                        <div className="mt-1"><GrowthIndicator value={data.totalCashSales2024 === 0 ? (data.totalCashSales2025 > 0 ? Infinity : 0) : ((data.totalCashSales2025 - data.totalCashSales2024) / data.totalCashSales2024) * 100} className="text-sm" /></div>
                    </SummaryCard>
                    
                    {/* Credit Sales Card */}
                    <SummaryCard title="Credit Sales" icon="💳">
                        <div className="text-lg text-orange-300">2025: <span className="font-extrabold text-orange-400">{formatNumberAbbreviated(data.totalCreditSales2025)}</span> {percentCredit2025 !== undefined && <span className="text-xs">({percentCredit2025.toFixed(1)}%)</span>}</div>
                        <div className="text-lg text-orange-300">2024: <span className="font-extrabold text-orange-200">{formatNumberAbbreviated(data.totalCreditSales2024)}</span> {percentCredit2024 !== undefined && <span className="text-xs">({percentCredit2024.toFixed(1)}%)</span>}</div>
                        <div className="mt-1"><GrowthIndicator value={data.totalCreditSales2024 === 0 ? (data.totalCreditSales2025 > 0 ? Infinity : 0) : ((data.totalCreditSales2025 - data.totalCreditSales2024) / data.totalCreditSales2024) * 100} className="text-sm" /></div>
                    </SummaryCard>
                    
                    {/* Top Division and Metrics */}
                    <SummaryCard title="Top Division" icon="🏆" to="/details/divisions">
                        {data.topDivision ? (
                            <>
                                <div className="text-xl font-bold text-sky-400 truncate" title={data.topDivision.name}>{data.topDivision.name}</div>
                                <div className="text-sm text-slate-400">2025 Sales: {formatNumberAbbreviated(data.topDivision.sales2025)}</div>
                                <GrowthIndicator value={data.topDivision.growth} className="text-xl" />
                            </>
                        ) : <div className="text-xl font-bold text-slate-400">-</div>}
                    </SummaryCard>
                    <MetricCard title="Brands" icon="🏷️" value2025={data.brandCount2025} value2024={data.brandCount2024} to="/details/brands" />
                    <MetricCard title="Items" icon="📦" value2025={data.itemCount2025} value2024={data.itemCount2024} to="/details/items" />
                </div>
            </section>
            
            <section>
                <SectionTitle>Pareto Analysis (80/20 Rule)</SectionTitle>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <SummaryCard title="Top 20% Branches" icon="📊" to="/details/pareto_branches">
                        <p className="text-sm">
                            Top <b>{formatNumber(data.pareto.branches.topCount)}</b> of <b>{formatNumber(data.pareto.branches.totalContributors)}</b> branches generate:
                        </p>
                        <div className="flex items-baseline justify-start gap-4 mt-2">
                            <div className="text-green-400 font-extrabold text-3xl" title={`Exact: ${data.pareto.branches.salesPercent.toFixed(4)}%`}>
                                {data.pareto.branches.salesPercent.toFixed(1)}%
                            </div>
                            <div className="text-sky-400 font-bold text-xl">
                                {formatNumberAbbreviated(data.pareto.branches.topSales)}
                            </div>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">of total 2025 sales</p>
                    </SummaryCard>
                    <SummaryCard title="Top 20% Brands" icon="📊" to="/details/pareto_brands">
                        <p className="text-sm">
                            Top <b>{formatNumber(data.pareto.brands.topCount)}</b> of <b>{formatNumber(data.pareto.brands.totalContributors)}</b> brands generate:
                        </p>
                        <div className="flex items-baseline justify-start gap-4 mt-2">
                            <div className="text-green-400 font-extrabold text-3xl" title={`Exact: ${data.pareto.brands.salesPercent.toFixed(4)}%`}>
                                {data.pareto.brands.salesPercent.toFixed(1)}%
                            </div>
                            <div className="text-sky-400 font-bold text-xl">
                                {formatNumberAbbreviated(data.pareto.brands.topSales)}
                            </div>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">of total 2025 sales</p>
                    </SummaryCard>
                    <SummaryCard title="Top 20% Items" icon="📊" to="/details/pareto_items">
                        <p className="text-sm">
                            Top <b>{formatNumber(data.pareto.items.topCount)}</b> of <b>{formatNumber(data.pareto.items.totalContributors)}</b> items generate:
                        </p>
                        <div className="flex items-baseline justify-start gap-4 mt-2">
                            <div className="text-green-400 font-extrabold text-3xl" title={`Exact: ${data.pareto.items.salesPercent.toFixed(4)}%`}>
                                {data.pareto.items.salesPercent.toFixed(1)}%
                            </div>
                            <div className="text-sky-400 font-bold text-xl">
                                {formatNumberAbbreviated(data.pareto.items.topSales)}
                            </div>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">of total 2025 sales</p>
                    </SummaryCard>
                </div>
            </section>

            <section>
                <SectionTitle>Brand & Item Lifecycle</SectionTitle>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    <SummaryCard title="New Brands (2025)" icon="✨" to="/details/new_brands">
                        <div className="text-3xl font-extrabold text-green-400">{formatNumber(data.newEntities.brands.count)}</div>
                        <div className="text-sm">Sales: {formatNumberAbbreviated(data.newEntities.brands.sales)}</div>
                        <div className="text-sm">{data.newEntities.brands.percentOfTotal.toFixed(2)}% of Total Sales</div>
                    </SummaryCard>

                    <SummaryCard title="Lost Brands (2024)" icon="👋" to="/details/lost_brands">
                        <div className="text-3xl font-extrabold text-rose-400">{formatNumber(data.lostEntities.brands.count)}</div>
                        <div className="text-base font-bold text-slate-400">2024 Sales: {formatNumberAbbreviated(data.lostEntities.brands.sales2024)}</div>
                        <div className="text-sm">{data.lostEntities.brands.percentOfTotal.toFixed(2)}% of 2024 Sales</div>
                    </SummaryCard>

                    <SummaryCard title="New Items (2025)" icon="💡" to="/details/new_items">
                        <div className="text-3xl font-extrabold text-green-400">{formatNumber(data.newEntities.items.count)}</div>
                        <div className="text-sm">Sales: {formatNumberAbbreviated(data.newEntities.items.sales)}</div>
                        <div className="text-sm">{data.newEntities.items.percentOfTotal.toFixed(2)}% of Total Sales</div>
                    </SummaryCard>

                    <SummaryCard title="Lost Items (2024)" icon="📉" to="/details/lost_items">
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