const UnitCell = ({ unit, onClick, isSelected, big = false }) => {
    // Большой режим — расширенная информация
    if (big) {
        return (
            <button
                type="button"
                onClick={() => onClick(unit)}
                title={`${unit.name}${unit.plate_number ? ` · ${unit.plate_number}` : ''}\n${unit.status_name}`}
                className={`relative h-20 min-w-[150px] px-2 py-1.5 rounded-lg text-white text-left transition-all hover:scale-[1.03] hover:shadow-lg border-2 ${
                    isSelected ? 'border-slate-800 ring-2 ring-slate-400' : 'border-transparent'
                } flex flex-col gap-0.5 overflow-hidden`}
                style={{ backgroundColor: unit.status_color || '#94a3b8' }}
            >
                <div className="flex items-center gap-1.5 w-full">
                    <span className="text-[10px] uppercase tracking-wide opacity-90 leading-none truncate">
                        {unit.type_short_name || '—'}
                    </span>
                    {unit.call_id && (
                        <span
                            className="ml-auto inline-block h-4 w-4 shrink-0 rounded-sm border-2 border-white/70"
                            style={{ backgroundColor: unit.call_color || '#fff' }}
                            title={unit.call_code || 'Вызов'}
                        />
                    )}
                </div>
                <span className="text-[11px] font-bold leading-tight truncate w-full">
                    {unit.name}
                </span>
                {unit.call_id && unit.call_code && (
                    <span className="text-[10px] font-semibold opacity-100 leading-none truncate w-full">
                        {unit.call_code}
                    </span>
                )}
            </button>
        );
    }

    // Компактный режим
    return (
        <button
            type="button"
            onClick={() => onClick(unit)}
            title={`${unit.name}${unit.plate_number ? ` · ${unit.plate_number}` : ''}\n${unit.status_name}`}
            className={`relative h-10 min-w-[72px] px-2 rounded-md text-white text-[11px] font-bold transition-all hover:scale-105 hover:shadow-lg flex flex-col items-center justify-center gap-0.5 border-2 ${
                isSelected ? 'border-slate-800 ring-2 ring-slate-400' : 'border-transparent'
            }`}
            style={{ backgroundColor: unit.status_color || '#94a3b8' }}
        >
            <span className="leading-none tracking-wider">
                {unit.type_short_name || '—'}
            </span>
        </button>
    );
};

export default UnitCell;