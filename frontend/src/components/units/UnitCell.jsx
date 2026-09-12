const UnitCell = ({ unit, onClick, isSelected }) => {
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
            {unit.squad_number && (
                <span className="text-[9px] opacity-80 leading-none">
          отд. {unit.squad_number}
        </span>
            )}
        </button>
    );
};

export default UnitCell;