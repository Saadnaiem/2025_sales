import React, { useState } from 'react';
import { FilterState, ProcessedData } from '../types';

interface FilterControlsProps {
    options: ProcessedData['filterOptions'];
    filters: FilterState;
    onFilterChange: (filters: FilterState) => void;
    searchTerm: string;
    onSearchChange: (term: string) => void;
    onReset: () => void;
}

const FilterControls: React.FC<FilterControlsProps> = ({ options, filters, onFilterChange, searchTerm, onSearchChange, onReset }) => {
    const [showFilters, setShowFilters] = useState(false);
    const toggleFilter = (key: keyof FilterState, value: string) => {
        const currentValues = filters[key] as string[];
        const newValues = currentValues.includes(value)
            ? currentValues.filter(v => v !== value)
            : [...currentValues, value];
        onFilterChange({ ...filters, [key]: newValues });
    };

    // Helper to render a checkbox group
    const renderFilterGroup = (label: string, key: keyof FilterState, options: string[]) => (
        <div className="flex flex-col h-full">
            <label className="block text-sm font-bold text-slate-300 mb-2 ml-1">{label}</label>
            <div className="bg-slate-700/50 rounded-lg p-2 max-h-48 overflow-y-auto border border-slate-600 flex-1">
                {options.length === 0 ? <div className="text-slate-500 text-xs p-2">No options available</div> : options.map(opt => (
                    <label key={opt} className="flex items-center space-x-2 p-1.5 hover:bg-slate-600/50 rounded cursor-pointer transition-colors">
                        <input
                            type="checkbox"
                            checked={(filters[key] as string[]).includes(opt)}
                            onChange={() => toggleFilter(key, opt)}
                            className="form-checkbox h-4 w-4 text-sky-500 rounded focus:ring-sky-500 bg-slate-800 border-slate-500 transition duration-150 ease-in-out"
                        />
                        <span className="text-slate-300 text-sm leading-tight">{opt}</span>
                    </label>
                ))}
            </div>
        </div>
    );

    const handleReset = () => {
        onReset();
        // setShowFilters(false); // Keep filters open so user sees them clearing
    };

    // FIX: Explicitly typed 'val' as string[] to resolve a type inference issue with Object.values.
    // FIX: Check for array to exclude 'saleType' string from count
    const activeFilterCount = Object.values(filters).reduce((acc, val) => acc + (Array.isArray(val) ? val.length : 0), 0);
    const totalActiveIndicators = activeFilterCount + (searchTerm ? 1 : 0);

    return (
        <div className="p-6 bg-slate-800/50 rounded-2xl shadow-lg border border-slate-700">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="relative flex-1">
                    <input
                        type="text"
                        placeholder="Search anything (e.g. Nivea, Jeddah Branch, Pharmacy...)"
                        value={searchTerm}
                        onChange={(e) => onSearchChange(e.target.value)}
                        list="search-suggestions"
                        className="w-full pl-10 pr-4 py-3 bg-slate-700 text-white border border-slate-600 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent placeholder-slate-400 shadow-sm"
                    />
                    <datalist id="search-suggestions">
                        {options.brands.slice(0, 50).map(b => <option key={`brand-${b}`} value={b} />)}
                        {options.divisions.map(d => <option key={`div-${d}`} value={d} />)}
                        {options.branches.slice(0, 20).map(b => <option key={`branch-${b}`} value={b} />)}
                    </datalist>
                    <svg
                        className="absolute left-3 top-3.5 h-5 w-5 text-slate-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                </div>

                <div className="flex items-center gap-4">
                    <div className="hidden md:block">
                        <select
                            value={filters.saleType}
                            onChange={(e) => onFilterChange({ ...filters, saleType: e.target.value as 'ALL' | 'CASH' | 'CREDIT' })}
                            className="bg-orange-600 text-white rounded-lg px-3 py-3 border border-orange-500 focus:ring-orange-500 focus:border-orange-500 font-medium hover:bg-orange-700 transition-colors cursor-pointer appearance-none"
                            style={{ backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.7rem center', backgroundSize: '1em' }}
                        >
                            <option value="ALL" className="bg-slate-700">Total Sales</option>
                            <option value="CASH" className="bg-slate-700">Cash Sales</option>
                            <option value="CREDIT" className="bg-slate-700">Credit Sales</option>
                        </select>
                    </div>

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
                        onClick={handleReset}
                        className="px-6 py-3 bg-rose-600 text-white font-bold rounded-lg shadow-md hover:bg-rose-700 transition-all flex items-center gap-2"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M20 20v-5h-5M4 20h5v-5M20 4h-5v5" />
                        </svg>
                        Reset
                    </button>
                </div>
            </div>

            {showFilters && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-6 pt-6 border-t border-slate-700">
                    {renderFilterGroup('Division', 'divisions', options.divisions)}
                    {renderFilterGroup('Department', 'departments', options.departments)}
                    {renderFilterGroup('Category', 'categories', options.categories)}
                    {renderFilterGroup('Subcategory', 'subcategories', options.subcategories)}
                    {renderFilterGroup('Class', 'classes', options.classes)}
                    {renderFilterGroup('Branch', 'branches', options.branches)}
                    {renderFilterGroup('Brand', 'brands', options.brands)}

                    {/* Sale Type moved to top bar */}
                    <div className="md:hidden">
                        <label htmlFor="saleTypeFilterMobile" className="block text-sm font-bold text-slate-300 mb-2 ml-1">Sale Type</label>
                        <select
                            id="saleTypeFilterMobile"
                            className="w-full bg-slate-700 text-white rounded-md p-2 border border-slate-600 focus:ring-sky-500 focus:border-sky-500 h-[42px]"
                            value={filters.saleType}
                            onChange={(e) => onFilterChange({ ...filters, saleType: e.target.value as 'ALL' | 'CASH' | 'CREDIT' })}
                        >
                            <option value="ALL">Total Sales</option>
                            <option value="CASH">Cash Sales</option>
                            <option value="CREDIT">Credit Sales</option>
                        </select>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FilterControls;