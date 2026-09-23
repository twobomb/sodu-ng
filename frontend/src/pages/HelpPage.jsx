import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { HelpCircle, Search, X, Bug, MessageCircle, Sparkles, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { usePermissions } from '../hooks/usePermissions';
import {
    HELP_SECTIONS,
    searchHelp,
    countHelpMatches,
    isHelpSectionAvailable,
} from '../lib/helpContent';
import HelpArticle from '../components/help/HelpArticle';
import HelpToc from '../components/help/HelpToc';
import ReportBugModal from '../components/ReportBugModal';

/**
 * Страница «Справка»: описание всех разделов системы.
 *  - поиск сверху — ищет по названиям, текстам, спискам и правам доступа;
 *  - статьи разделов слева, панель «Разделы справки» со структурой справа;
 *  - разделы, недоступные пользователю по правам, помечаются значком, но остаются в справке.
 */
const HelpPage = () => {
    const { has, isDeveloper, permissions } = usePermissions();
    const [query, setQuery] = useState('');
    const [activeId, setActiveId] = useState(HELP_SECTIONS[0].id);
    const [reportOpen, setReportOpen] = useState(false);
    const searchRef = useRef(null);

    // Разделы, недоступные текущему пользователю (по его правам)
    const blockedIds = useMemo(() => {
        const check = (permission) => isDeveloper || permissions.includes(permission);
        return new Set(
            HELP_SECTIONS.filter((section) => !isHelpSectionAvailable(section, check)).map(
                (section) => section.id
            )
        );
    }, [isDeveloper, permissions]);

    // Результаты поиска: без запроса — все разделы в исходном порядке
    const results = useMemo(() => searchHelp(HELP_SECTIONS, query), [query]);
    const matchedBlocks = useMemo(() => countHelpMatches(results), [results]);
    const isSearching = query.trim().length > 0;

    // Переход из оглавления (или наверх страницы)
    const handleNavigate = useCallback((sectionId, blockId) => {
        if (!sectionId) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }
        const anchor = blockId ? `help-${sectionId}-${blockId}` : `help-${sectionId}`;
        const target = document.getElementById(anchor);
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, []);

    // Горячие клавиши: Ctrl+K (или «/») — фокус на поиске
    useEffect(() => {
        const onKeyDown = (event) => {
            const target = event.target;
            const typing =
                target instanceof HTMLElement &&
                (target.tagName === 'INPUT' ||
                    target.tagName === 'TEXTAREA' ||
                    target.isContentEditable);

            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
                event.preventDefault();
                searchRef.current?.focus();
                searchRef.current?.select();
                return;
            }
            if (event.key === '/' && !typing) {
                event.preventDefault();
                searchRef.current?.focus();
            }
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, []);

    // Scroll-spy: определяем активный раздел для оглавления
    useEffect(() => {
        if (typeof IntersectionObserver === 'undefined') return undefined;

        const nodes = HELP_SECTIONS.map((section) =>
            document.getElementById(`help-${section.id}`)
        ).filter(Boolean);
        if (!nodes.length) return undefined;

        const observer = new IntersectionObserver(
            (entries) => {
                const visible = entries
                    .filter((entry) => entry.isIntersecting)
                    .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
                if (visible[0]) setActiveId(visible[0].target.dataset.helpSection);
            },
            { rootMargin: '-120px 0px -65% 0px', threshold: 0 }
        );

        nodes.forEach((node) => observer.observe(node));
        return () => observer.disconnect();
    }, [query]);

    return (
        <div className="space-y-4">
            {/* Заголовок и быстрая связь с разработчиком */}
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h2 className="flex items-center gap-2 text-2xl font-bold text-slate-800">
                        <HelpCircle className="h-6 w-6 text-orange-500" />
                        Справка
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                        Описание разделов системы: вызовы, техника, мониторинг, отчёты, чат,
                        структура, справочники, пользователи.
                    </p>
                </div>
                <Button
                    onClick={() => setReportOpen(true)}
                    className="rounded-lg gap-2 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700"
                >
                    <Bug className="h-4 w-4" />
                    Сообщить об ошибке
                </Button>
            </div>

            {/* Поиск по справке */}
            <Card className="rounded-2xl border-slate-200 shadow-sm">
                <CardContent className="p-3">
                    <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <Input
                            ref={searchRef}
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Поиск по справке: техника, чат, строевая записка, статус…"
                            className="h-11 rounded-lg pl-9 pr-9"
                            aria-label="Поиск по справке"
                        />
                        {query && (
                            <button
                                type="button"
                                onClick={() => setQuery('')}
                                title="Очистить поиск"
                                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                        {isSearching ? (
                            <span>
                                Найдено разделов:{' '}
                                <b className="text-slate-600">{results.length}</b> · совпадений:{' '}
                                <b className="text-slate-600">{matchedBlocks}</b>
                            </span>
                        ) : (
                            <span className="inline-flex flex-wrap items-center gap-1">
                                Ищет по названиям, текстам и правам доступа. 
                            </span>
                        )}
                        {blockedIds.size > 0 && (
                            <span className="inline-flex items-center gap-1">
                                <Lock className="h-3 w-3" />
                                разделы без доступа помечены значком
                            </span>
                        )}
                    </div>
                </CardContent>
            </Card>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
                {/* Панель справа: разделы + структура активного раздела */}
                <aside className="lg:col-start-2 lg:row-start-1">
                    <div className="lg:sticky lg:top-20">
                        <HelpToc
                            results={results}
                            query={query}
                            activeId={activeId}
                            blockedIds={blockedIds}
                            onNavigate={handleNavigate}
                        />
                    </div>
                </aside>

                {/* Основное содержимое: статьи разделов */}
                <div className="space-y-4 lg:col-start-1 lg:row-start-1">
                    {results.length === 0 ? (
                        <Card className="rounded-2xl border-slate-200 shadow-sm">
                            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                                <Search className="h-10 w-10 text-slate-300" />
                                <p className="text-slate-500">
                                    По запросу «{query}» ничего не найдено. Попробуйте
                                    изменить формулировку или сбросить поиск.
                                </p>
                                <Button
                                    variant="outline"
                                    className="rounded-lg"
                                    onClick={() => setQuery('')}
                                >
                                    Сбросить поиск
                                </Button>
                            </CardContent>
                        </Card>
                    ) : (
                        results.map(({ section, blockIds }) => (
                            <HelpArticle
                                key={section.id}
                                section={section}
                                blocks={
                                    blockIds
                                        ? section.blocks.filter((block) =>
                                              blockIds.includes(block.id)
                                          )
                                        : section.blocks
                                }
                                query={query}
                                available={!blockedIds.has(section.id)}
                            />
                        ))
                    )}

                    {/* Обратная связь */}
                    <Card className="rounded-2xl border-orange-200 bg-gradient-to-br from-orange-50 to-red-50 shadow-sm dark:border-orange-500/30 dark:from-orange-500/15 dark:to-red-500/15">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <MessageCircle className="h-5 w-5 text-orange-500" />
                                Не нашли ответ?
                            </CardTitle>
                            <CardDescription>
                                Напишите разработчику в чат или отправьте описание проблемы или предложения —
                                сообщение уйдёт в личный чат, ответ придёт туда же.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-wrap gap-2">
                            <Button
                                onClick={() => setReportOpen(true)}
                                className="gap-2 rounded-lg bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700"
                            >
                                <Bug className="h-4 w-4" />
                                Сообщить 
                            </Button>
                            {has('chat.use') && (
                                <Button
                                    variant="outline"
                                    className="gap-2 rounded-lg"
                                    onClick={() =>
                                        window.dispatchEvent(new CustomEvent('chat:toggle'))
                                    }
                                >
                                    <MessageCircle className="h-4 w-4" />
                                    Открыть чат
                                </Button>
                            )}
                        </CardContent>
                    </Card>

                </div>
            </div>

            <ReportBugModal open={reportOpen} onOpenChange={setReportOpen} />
        </div>
    );
};

export default HelpPage;
