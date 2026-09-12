import { Loader2, Clock } from 'lucide-react';
import { useGlobalHistory } from '../../hooks/useUnits';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

const GlobalHistoryLog = ({ onSelectUnit }) => {
    const { data: history, isLoading } = useGlobalHistory(50);

    if (isLoading) {
        return (
            <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
            </div>
        );
    }

    if (!history?.length) {
        return (
            <div className="text-center text-slate-400 text-sm py-12 px-4">
                <Clock className="h-10 w-10 mx-auto text-slate-300 mb-3" />
                <p>Пока нет изменений статусов</p>
            </div>
        );
    }

    return (
        <div className="divide-y divide-slate-100">
            {history.map((h) => {
                const time = new Date(h.changed_at);

                return (
                    <div key={h.id} className="px-4 py-4 hover:bg-slate-50">
                        {/* Техника + тип */}
                        <div className="flex items-start gap-3">
              <span
                  className="h-4 w-4 rounded-full flex-shrink-0 mt-1"
                  style={{ backgroundColor: h.status_color }}
              />
                            <div className="flex-1 min-w-0">
                                <div className="text-base leading-tight">
                                    <button
                                        type="button"
                                        onClick={() => onSelectUnit?.(h.unit_id)}
                                        className="font-semibold text-slate-800 hover:text-orange-600 hover:underline transition-colors text-left"
                                        title="Открыть информацию о технике"
                                    >
                                        {h.unit_name}
                                    </button>
                                    {h.unit_type_short && (
                                        <span className="text-sm text-slate-400 ml-2">
                      ({h.unit_type_short})
                    </span>
                                    )}
                                </div>
                                <div className="text-sm text-slate-500 mt-1">
                                    {h.department_name}
                                    {h.unit_plate_number && (
                                        <span className="ml-2 font-mono text-slate-400">
                      {h.unit_plate_number}
                    </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Бейдж статуса */}
                        <div className="mt-3 pl-7">
              <span
                  className="inline-block px-3 py-1 rounded-md text-sm font-medium text-white"
                  style={{ backgroundColor: h.status_color }}
              >
                {h.status_name}
              </span>
                        </div>

                        {/* Время: дата мелко, время крупно. Автор — мелко справа */}
                        <div className="mt-3 pl-7 flex items-baseline justify-between gap-3">
                            <div className="flex items-baseline gap-2">
                <span className="text-xs text-slate-400 font-medium tabular-nums">
                  {format(time, 'dd.MM.yyyy', { locale: ru })}
                </span>
                                <span className="text-xl font-bold text-slate-800 tabular-nums tracking-tight leading-none">
                  {format(time, 'HH:mm:ss')}
                </span>
                            </div>
                            {h.changed_by_display_name || h.changed_by_username ? (
                                <span className="text-xs text-slate-400 truncate">
                  {h.changed_by_display_name || h.changed_by_username}
                </span>
                            ) : null}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default GlobalHistoryLog;