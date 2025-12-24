import React, { useState, useCallback, useMemo } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, Sector, LabelList, LegendType } from 'recharts';
import { ProcessedData, FilterState } from '../types';
import { useWindowSize } from '../hooks/useWindowSize';

// New unified color palette
const COLORS = {
    green: '#34d399',  // emerald-400
    blue: '#38bdf8',   // sky-500
    red: '#f87171',    // red-400
    violet: '#a78bfa', // violet-400
    slate: '#9ca3af',
    teal: '#2dd4bf'  // teal-400
};
const DIVISION_CHART_PALETTE = ['#38bdf8', '#818cf8', '#34d399', '#fb7185', '#facc15']; // sky, indigo, emerald, rose, amber

const formatNumber = (num: number): string => {
    if (num === null || num === undefined || isNaN(num)) return '-';
    if (Math.abs(num) >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (Math.abs(num) >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (Math.abs(num) >= 1e3) return (num / 1e3).toFixed(1) + 'K';
    return num.toLocaleString(undefined, { maximumFractionDigits: 0 });
};

const CustomYAxisTick = (props: any) => {
    const { x, y, payload, maxChars } = props;
    const value = payload.value as string;

    if (!value) return null;

    const truncatedValue = value.length > maxChars ? `${value.substring(0, maxChars)}...` : value;

    return (
        <g transform={`translate(${x},${y})`}>
            <text x={0} y={0} dy={4} textAnchor="end" fill="white" fontSize={12} fontWeight="bold">
                <title>{value}</title>
                {truncatedValue}
            </text>
        </g>
    );
};

interface ChartsProps {
    data: ProcessedData;
    filters: FilterState;
    onFilterChange: (filters: FilterState) => void;
}

const ChartCard: React.FC<{ title: string; children: React.ReactNode; className?: string }> = ({ title, children, className = '' }) => (
    <div className={`bg-slate-800/50 p-6 rounded-2xl shadow-xl border border-slate-700 hover:border-sky-500 hover:shadow-sky-500/10 hover:-translate-y-1 transition-all duration-300 ${className}`}>
        <h2 className="text-xl font-bold text-white mb-4 text-center">{title}</h2>
        {children}
    </div>
);

const Charts: React.FC<ChartsProps> = ({ data, filters, onFilterChange }) => {
    const [activeIndex, setActiveIndex] = useState<number>(-1);
    const { width } = useWindowSize();
    const isMobile = width < 768; // Tailwind's md breakpoint

    const RADIAN = Math.PI / 180;
    const renderLegendText = (value: string) => {
        return <span className="text-slate-200">{value}</span>;
    };

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            const finalLabel = label || payload[0].name;
            const itemPayload = payload[0].payload;
            const type = filters.saleType || 'ALL';

            return (
                <div className="bg-slate-900/80 backdrop-blur-sm border border-slate-700 p-4 rounded-lg shadow-lg">
                    <p className="font-bold text-green-300 mb-2">{finalLabel}</p>

                    {itemPayload.sales2024 !== undefined && itemPayload.sales2025 !== undefined ? (
                        <>
                            <div style={{ color: COLORS.blue }}>2024 Sales: {formatNumber(itemPayload.sales2024)}</div>
                            {itemPayload.cashSales2024 !== undefined && (type === 'ALL' || type === 'CASH') && <div className="text-xs text-slate-400 pl-2">Cash: {formatNumber(itemPayload.cashSales2024)}</div>}
                            {itemPayload.creditSales2024 !== undefined && (type === 'ALL' || type === 'CREDIT') && <div className="text-xs text-slate-400 pl-2">Credit: {formatNumber(itemPayload.creditSales2024)}</div>}

                            <div style={{ color: COLORS.teal }}>2025 Sales: {formatNumber(itemPayload.sales2025)}</div>
                            {itemPayload.cashSales2025 !== undefined && (type === 'ALL' || type === 'CASH') && <div className="text-xs text-slate-400 pl-2">Cash: {formatNumber(itemPayload.cashSales2025)}</div>}
                            {itemPayload.creditSales2025 !== undefined && (type === 'ALL' || type === 'CREDIT') && <div className="text-xs text-slate-400 pl-2">Credit: {formatNumber(itemPayload.creditSales2025)}</div>}

                            {itemPayload.growth !== undefined && (
                                <div className={itemPayload.growth >= 0 ? 'text-green-400' : 'text-red-400'}>
                                    Growth: {itemPayload.growth === Infinity ? 'New' : `${itemPayload.growth.toFixed(2)}%`}
                                </div>
                            )}
                        </>
                    ) : (
                        payload.map((pld: any, index: number) => (
                            <div key={index} style={{ color: pld.color || pld.fill }}>
                                {pld.name}: {formatNumber(pld.value)}
                            </div>
                        ))
                    )}
                </div>
            );
        }
        return null;
    };

    const renderActiveShape = (props: any) => {
        const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent } = props;

        if (!payload) return null;

        const { sales2024, sales2025 } = payload;
        const growth = sales2024 === 0 ? (sales2025 > 0 ? Infinity : 0) : ((sales2025 - sales2024) / sales2024) * 100;
        const growthColor = growth >= 0 ? COLORS.green : COLORS.red;
        const growthIcon = growth >= 0 ? '▲' : '▼';
        const growthText = growth === Infinity ? 'New' : `${growthIcon} ${Math.abs(growth).toFixed(1)}%`;

        return (
            <g>
                <text x={cx} y={cy - 35} dy={8} textAnchor="middle" fill={fill} className="text-xl font-extrabold">
                    {payload.name}
                </text>
                <text x={cx} y={cy - 10} dy={8} textAnchor="middle" fill="#e5e7eb" className="text-base font-semibold">
                    {`2025: ${formatNumber(payload.sales2025)} (${(percent * 100).toFixed(1)}%)`}
                </text>
                <text x={cx} y={cy + 15} dy={8} textAnchor="middle" fill="#9ca3af" className="text-sm font-medium">
                    {`2024: ${formatNumber(payload.sales2024)}`}
                </text>
                <text x={cx} y={cy + 40} dy={8} textAnchor="middle" fill={growthColor} className="text-base font-bold">
                    {growthText}
                </text>
                <Sector
                    cx={cx}
                    cy={cy}
                    innerRadius={innerRadius}
                    outerRadius={outerRadius + 6}
                    startAngle={startAngle}
                    endAngle={endAngle}
                    fill={fill}
                />
            </g>
        );
    };

    const renderDonutLabel = ({ cx, cy, midAngle, outerRadius, percent, name, sales2024, sales2025 }: any) => {
        const radius = outerRadius + 25; // Position label outside the pie
        const x = cx + radius * Math.cos(-midAngle * RADIAN);
        const y = cy + radius * Math.sin(-midAngle * RADIAN);
        const textAnchor = x > cx ? 'start' : 'end';

        if (percent < 0.03) return null; // Don't render labels for tiny slices

        const growth = sales2024 === 0 ? (sales2025 > 0 ? Infinity : 0) : ((sales2025 - sales2024) / sales2024) * 100;
        let growthText = '';
        let growthColor = 'white';

        if (growth === Infinity) {
            growthText = ' (New)';
            growthColor = COLORS.green;
        } else if (!isNaN(growth)) {
            growthText = ` (${growth >= 0 ? '+' : ''}${growth.toFixed(1)}%)`;
            growthColor = growth >= 0 ? COLORS.green : COLORS.red;
        }

        return (
            <text
                x={x}
                y={y}
                textAnchor={textAnchor}
                dominantBaseline="central"
                className="text-sm font-semibold"
            >
                <tspan fill="white">{name}</tspan>
                <tspan fill={growthColor} dx="4">{growthText}</tspan>
            </text>
        );
    };

    const renderGrowthLabel = (props: any) => {
        const { x, y, width, height, payload } = props;

        if (!payload || width < 20) {
            return null;
        }

        const { growth } = payload;
        let growthText = '';
        let color = '#e5e7eb';
        let bgColor = 'rgba(0, 0, 0, 0.3)';

        if (growth === Infinity) {
            growthText = 'New';
            color = '#f0fdf4'; // green-50
            bgColor = 'rgba(34, 197, 94, 0.7)'; // green-500 with alpha
        } else if (typeof growth === 'number' && !isNaN(growth)) {
            growthText = `${growth >= 0 ? '+' : ''}${growth.toFixed(1)}%`;
            if (growth >= 0) {
                color = '#f0fdf4'; // green-50
                bgColor = 'rgba(34, 197, 94, 0.7)';
            } else {
                color = '#fef2f2'; // rose-50
                bgColor = 'rgba(244, 63, 94, 0.7)';
            }
        } else {
            return null;
        }

        const textWidth = growthText.length * 6.5;
        const padding = 8;
        const rectWidth = textWidth + padding;

        return (
            <g>
                <rect
                    x={x + width + 5}
                    y={y + (height / 2) - 10}
                    width={rectWidth}
                    height={20}
                    rx={5}
                    ry={5}
                    fill={bgColor}
                />
                <text
                    x={x + width + 5 + (rectWidth / 2)}
                    y={y + height / 2}
                    dy={4}
                    fill={color}
                    fontSize="12"
                    fontWeight="bold"
                    textAnchor="middle"
                >
                    {growthText}
                </text>
            </g>
        );
    };

    const onPieEnter = useCallback((_: any, index: number) => {
        setActiveIndex(index);
    }, [setActiveIndex]);

    const onPieLeave = useCallback(() => {
        setActiveIndex(-1);
    }, [setActiveIndex]);

    const handleBarClick = useCallback((filterKey: keyof FilterState, payload: any) => {
        if (payload && payload.name) {
            const value = payload.name;
            const currentFilterValues = filters[filterKey];

            if (
                Array.isArray(currentFilterValues) &&
                currentFilterValues.length === 1 &&
                currentFilterValues[0] === value
            ) {
                onFilterChange({ ...filters, divisions: [], branches: [], brands: [], items: [] });
            } else {
                onFilterChange({ ...filters, divisions: [], branches: [], brands: [], items: [], [filterKey]: [value] });
            }
        }
    }, [onFilterChange, filters]);


    const handleDonutClick = useCallback(() => {
        if (data.salesByDivision && data.salesByDivision[activeIndex]) {
            const divisionName = data.salesByDivision[activeIndex].name;
            const currentFilterValues = filters.divisions;

            if (Array.isArray(currentFilterValues) && currentFilterValues.length === 1 && currentFilterValues[0] === divisionName) {
                onFilterChange({ ...filters, divisions: [], branches: [], brands: [], items: [] });
            } else {
                onFilterChange({ ...filters, divisions: [divisionName], branches: [], brands: [], items: [] });
            }
        }
    }, [activeIndex, data.salesByDivision, onFilterChange, filters]);

    const yearComparisonData = [
        { name: '2024', value: data.totalSales2024, sales2024: data.totalSales2024, sales2025: 0 },
        { name: '2025', value: data.totalSales2025, sales2024: 0, sales2025: data.totalSales2025 },
    ];

    const yoyGrowth = data.salesGrowthPercentage;
    const growthColor = yoyGrowth >= 0 ? COLORS.green : COLORS.red;
    const growthIcon = yoyGrowth >= 0 ? '▲' : '▼';
    const growthText = yoyGrowth === Infinity ? 'New' : `${growthIcon} ${Math.abs(yoyGrowth).toFixed(1)}%`;

    const calculateGrowth = (current: number, previous: number) =>
        previous === 0 ? (current > 0 ? Infinity : 0) : ((current - previous) / previous) * 100;

    const top10BrandsSorted = useMemo(() =>
        [...data.top10Brands]
            .map(brand => ({ ...brand, growth: calculateGrowth(brand.sales2025, brand.sales2024) }))
            .sort((a, b) => b.sales2025 - a.sales2025),
        [data.top10Brands]);

    const allBranchesSorted = useMemo(() =>
        [...data.salesByBranch].sort((a, b) => b.sales2025 - a.sales2025),
        [data.salesByBranch]);

    const top50ItemsSorted = useMemo(() =>
        [...data.top50Items]
            .map(item => ({ ...item, growth: calculateGrowth(item.sales2025, item.sales2024) }))
            .sort((a, b) => b.sales2025 - a.sales2025),
        [data.top50Items]);

    const barHeight = isMobile ? 22 : 25;
    const allBranchesChartHeight = Math.max(400, allBranchesSorted.length * barHeight);
    const top50ItemsChartHeight = Math.max(400, top50ItemsSorted.length * barHeight);

    const divisionPieProps: any = {
        activeIndex,
        activeShape: renderActiveShape,
        data: data.salesByDivision,
        cx: "50%",
        cy: "50%",
        innerRadius: 100,
        outerRadius: 140,
        dataKey: "sales2025",
        onMouseEnter: onPieEnter,
        onClick: handleDonutClick,
        className: "cursor-pointer",
        labelLine: false,
        label: activeIndex === -1 ? renderDonutLabel : false,
    };

    const legendPayload: Array<{ value: string; type: LegendType; id: string; color: string; }> = [
        { value: '2024', type: 'square', id: 'ID01', color: COLORS.blue },
        { value: '2025', type: 'square', id: 'ID02', color: COLORS.green }
    ];


    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChartCard title="Sales by Year Comparison">
                <ResponsiveContainer width="100%" height={400}>
                    <PieChart margin={{ top: 30, right: 30, bottom: 30, left: 30 }}>
                        <Pie
                            data={yearComparisonData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            outerRadius={140}
                            innerRadius={100}
                            fill="#8884d8"
                            dataKey="value"
                        >
                            <Cell fill={COLORS.blue} />
                            <Cell fill={COLORS.teal} />
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                        <Legend formatter={renderLegendText} />
                        <text x="50%" y="45%" textAnchor="middle" dominantBaseline="middle" className="text-base font-bold" fill="#FFFFFF">
                            YOY Growth
                        </text>
                        <text x="50%" y="58%" textAnchor="middle" dominantBaseline="middle" className="text-4xl font-extrabold" fill={growthColor}>
                            {growthText}
                        </text>
                    </PieChart>
                </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Sales by Division (2025)">
                <ResponsiveContainer width="100%" height={400}>
                    <PieChart
                        margin={{ top: 30, right: 30, bottom: 30, left: 30 }}
                        onMouseLeave={onPieLeave}
                    >
                        <Pie {...divisionPieProps}>
                            {data.salesByDivision.map((_entry, index) => (
                                <Cell key={`cell-${index}`} fill={DIVISION_CHART_PALETTE[index % DIVISION_CHART_PALETTE.length]} />
                            ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Top 10 Brands by 2025 Sales" className="lg:col-span-2">
                <ResponsiveContainer width="100%" height={400}>
                    <BarChart
                        layout="vertical"
                        data={top10BrandsSorted}
                        margin={isMobile
                            ? { top: 20, right: 80, bottom: 20, left: 80 }
                            : { left: 100, top: 20, right: 80, bottom: 20 }
                        }
                        className="cursor-pointer"
                        barCategoryGap="20%"
                    >
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis type="number" stroke="white" tickFormatter={formatNumber} tick={{ fill: 'white', fontWeight: 'bold' }} />
                        <YAxis type="category" dataKey="name" stroke="white" width={isMobile ? 80 : 100} tick={<CustomYAxisTick maxChars={isMobile ? 10 : 12} />} interval={0} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend payload={legendPayload} formatter={renderLegendText} />
                        <Bar dataKey="sales2024" name="2024" fill={COLORS.blue} onClick={(payload) => handleBarClick('brands', payload)} />
                        <Bar dataKey="sales2025" name="2025" fill={COLORS.green} onClick={(payload) => handleBarClick('brands', payload)}>
                            {!isMobile && <LabelList dataKey="growth" content={renderGrowthLabel} />}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Top 50 Items by 2025 Sales" className="lg:col-span-2">
                <ResponsiveContainer width="100%" height={top50ItemsChartHeight}>
                    <BarChart
                        layout="vertical"
                        data={top50ItemsSorted}
                        margin={isMobile
                            ? { top: 20, right: 80, bottom: 20, left: 120 }
                            : { left: 250, top: 20, right: 80, bottom: 20 }
                        }
                        className="cursor-pointer"
                        barCategoryGap="20%"
                    >
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis type="number" stroke="white" tickFormatter={formatNumber} tick={{ fill: 'white', fontWeight: 'bold' }} />
                        <YAxis type="category" dataKey="name" stroke="white" width={isMobile ? 120 : 250} tick={<CustomYAxisTick maxChars={isMobile ? 18 : 35} />} interval={0} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend payload={legendPayload} formatter={renderLegendText} />
                        <Bar dataKey="sales2024" name="2024" fill={COLORS.blue} onClick={(payload) => handleBarClick('items', payload)} />
                        <Bar dataKey="sales2025" name="2025" fill={COLORS.green} onClick={(payload) => handleBarClick('items', payload)}>
                            {!isMobile && <LabelList dataKey="growth" content={renderGrowthLabel} />}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="All Branches Performance & Growth %" className="lg:col-span-2">
                <ResponsiveContainer width="100%" height={allBranchesChartHeight}>
                    <BarChart
                        layout="vertical"
                        data={allBranchesSorted}
                        margin={isMobile
                            ? { top: 20, right: 80, bottom: 20, left: 100 }
                            : { left: 150, top: 20, right: 80, bottom: 20 }
                        }
                        className="cursor-pointer"
                        barCategoryGap="20%"
                    >
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis type="number" stroke="white" tickFormatter={formatNumber} tick={{ fill: 'white', fontWeight: 'bold' }} />
                        <YAxis type="category" dataKey="name" stroke="white" width={isMobile ? 100 : 150} tick={<CustomYAxisTick maxChars={isMobile ? 15 : 20} />} interval={0} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend payload={legendPayload} formatter={renderLegendText} />
                        <Bar dataKey="sales2024" name="2024" fill={COLORS.blue} onClick={(payload) => handleBarClick('branches', payload)} />
                        <Bar dataKey="sales2025" name="2025" fill={COLORS.green} onClick={(payload) => handleBarClick('branches', payload)}>
                            {!isMobile && <LabelList dataKey="growth" content={renderGrowthLabel} />}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </ChartCard>
        </div>
    );
};

export default Charts;