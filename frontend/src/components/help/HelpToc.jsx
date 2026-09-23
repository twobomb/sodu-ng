import { ArrowUp, Lock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { HELP_ACCENTS } from '../../lib/helpContent';
import HelpMarked from './HelpMarked';

/**
 * Панель справа: список разделов справки (дублирует статьи) плюс
 * структура — подразделы активного раздела.
 */
const HelpToc = ({ results, query, activeId, blockedIds, onNavigate }) => {
    const total = results.length;

    return (
        <Card className="overflow-hidden rounded-2xl border-slate-200 shadow-sm">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 dark:bg-white/5">
                <h2 className="text-sm font-semibold text-slate-800">Разделы справки</h2>
                <p className="text-xs text-slate-400">
                    {query ? `Найдено разделов: ${total}` : `Всего разделов: ${total}`}
                </p>
            </div>

            <CardContent className="max-h-[calc(100vh-18rem)] overflow-y-auto p-2">
                <ul className="space-y-0.5">
                    {results.map(({ section }) => {
                        const accent = HELP_ACCENTS[section.accent] || HELP_ACCENTS.slate;
                        const Icon = section.icon;
                        const active = activeId === section.id;
                        const blocked = blockedIds.has(section.id);

                        return (
                            <li key={section.id}>
                                <button
                                    type="button"
                                    onClick={() => onNavigate(section.id)}
                                    className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors ${
                                        active
                                            ? 'bg-gradient-to-r from-orange-50 to-red-50 font-semibold text-orange-600 dark:from-orange-500/20 dark:to-red-500/20 dark:text-orange-300'
                                            : 'text-slate-600 hover:bg-slate-100 dark:hover:bg-white/10'
                                    }`}
                                >
                                    <span
                                        className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md text-white ${accent.iconBg}`}
                                    >
                                        <Icon className="h-3.5 w-3.5" />
                                    </span>
                                    <span className="min-w-0 flex-1 truncate">
                                        <HelpMarked text={section.title} query={query} />
                                    </span>
                                    {blocked && (
                                        <Lock
                                            className="h-3 w-3 flex-shrink-0 text-slate-400"
                                            title="Нет доступа"
                                        />
                                    )}
                                </button>

                                {/* Структура активного раздела */}
                                {active && (
                                    <ul className="mb-1 ml-3 mt-0.5 space-y-0.5 border-l border-slate-200 pl-2 dark:border-white/10">
                                        {section.blocks.map((block) => (
                                            <li key={block.id}>
                                                <button
                                                    type="button"
                                                    onClick={() => onNavigate(section.id, block.id)}
                                                    className="w-full rounded-md px-2 py-1 text-left text-xs text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10"
                                                >
                                                    <HelpMarked
                                                        text={block.title || 'Описание'}
                                                        query={query}
                                                    />
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </li>
                        );
                    })}
                </ul>
            </CardContent>

            <div className="border-t border-slate-200 px-3 py-2">
                <button
                    type="button"
                    onClick={() => onNavigate(null)}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10"
                >
                    <ArrowUp className="h-3.5 w-3.5" />
                    Наверх
                </button>
            </div>
        </Card>
    );
};

export default HelpToc;
