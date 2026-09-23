import { Link } from 'react-router-dom';
import { Info, Lightbulb, TriangleAlert, CircleCheck, ExternalLink, Lock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { HELP_ACCENTS } from '../../lib/helpContent';
import HelpMarked from './HelpMarked';

// Оформление врезок-подсказок
const NOTE_TONES = {
    info: {
        Icon: Info,
        wrapper:
            'border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-100',
        icon: 'text-sky-500',
    },
    tip: {
        Icon: Lightbulb,
        wrapper:
            'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100',
        icon: 'text-amber-500',
    },
    warn: {
        Icon: TriangleAlert,
        wrapper:
            'border-orange-200 bg-orange-50 text-orange-900 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-100',
        icon: 'text-orange-500',
    },
    success: {
        Icon: CircleCheck,
        wrapper:
            'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100',
        icon: 'text-emerald-500',
    },
};

// Тело блока статьи — в зависимости от его типа
const BlockBody = ({ block, query, bulletClass }) => {
    switch (block.type) {
        case 'steps':
            return (
                <ol className="space-y-2">
                    {block.items.map((item, index) => (
                        <li key={index} className="flex gap-3 text-sm text-slate-600">
                            <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-600 dark:bg-white/10 dark:text-slate-200">
                                {index + 1}
                            </span>
                            <span className="leading-relaxed">
                                <HelpMarked text={item} query={query} />
                            </span>
                        </li>
                    ))}
                </ol>
            );

        case 'fields':
            return (
                <dl className="divide-y divide-slate-100 rounded-lg border border-slate-200 dark:divide-white/10 dark:border-white/10">
                    {block.items.map((item, index) => (
                        <div
                            key={index}
                            className="grid gap-1 px-3 py-2 sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-3"
                        >
                            <dt className="text-sm font-medium text-slate-700">
                                <HelpMarked text={item.name} query={query} />
                            </dt>
                            <dd className="text-sm leading-relaxed text-slate-500">
                                <HelpMarked text={item.description} query={query} />
                            </dd>
                        </div>
                    ))}
                </dl>
            );

        case 'note': {
            const tone = NOTE_TONES[block.tone] || NOTE_TONES.info;
            const { Icon } = tone;
            return (
                <div className={`flex gap-2.5 rounded-lg border px-3 py-2.5 ${tone.wrapper}`}>
                    <Icon className={`mt-0.5 h-4 w-4 flex-shrink-0 ${tone.icon}`} />
                    <p className="text-sm leading-relaxed">
                        <HelpMarked text={block.text} query={query} />
                    </p>
                </div>
            );
        }

        case 'list':
            return (
                <ul className="space-y-1.5">
                    {block.items.map((item, index) => (
                        <li key={index} className="flex gap-2.5 text-sm text-slate-600">
                            <span
                                className={`mt-[7px] h-1.5 w-1.5 flex-shrink-0 rounded-full ${bulletClass}`}
                            />
                            <span className="leading-relaxed">
                                <HelpMarked text={item} query={query} />
                            </span>
                        </li>
                    ))}
                </ul>
            );

        default:
            return (
                <p className="text-sm leading-relaxed text-slate-600">
                    <HelpMarked text={block.text} query={query} />
                </p>
            );
    }
};

/**
 * Статья одного раздела справки.
 * `blocks` — какие блоки показывать (при поиске — только совпавшие).
 */
const HelpArticle = ({ section, blocks, query = '', available = true }) => {
    const accent = HELP_ACCENTS[section.accent] || HELP_ACCENTS.slate;
    const Icon = section.icon;

    return (
        <section id={`help-${section.id}`} data-help-section={section.id} className="scroll-mt-28">
            <Card className={`rounded-2xl border bg-white shadow-sm ${accent.ring}`}>
                <div className="flex items-start gap-3 border-b border-slate-100 px-5 py-4">
                    <div
                        className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-white shadow-sm ${accent.iconBg}`}
                    >
                        <Icon className="h-5 w-5" />
                    </div>

                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-lg font-bold text-slate-800">
                                <HelpMarked text={section.title} query={query} />
                            </h2>
                            {!available && (
                                <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500 dark:border-white/15 dark:bg-white/10 dark:text-slate-300">
                                    <Lock className="h-3 w-3" />
                                    нет доступа
                                </span>
                            )}
                        </div>
                        <p className="mt-1 text-sm text-slate-500">
                            <HelpMarked text={section.summary} query={query} />
                        </p>
                    </div>

                    {available && section.route && (
                        <Link to={section.route} className="hidden flex-shrink-0 sm:block">
                            <Button
                                variant="outline"
                                size="sm"
                                className="rounded-lg gap-1.5"
                                title="Перейти в раздел"
                            >
                                Перейти
                                <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                        </Link>
                    )}
                </div>

                <CardContent className="space-y-5 px-5 py-5">
                    {blocks.map((block) => (
                        <div
                            key={block.id}
                            id={`help-${section.id}-${block.id}`}
                            className="scroll-mt-28 space-y-2"
                        >
                            {block.title && (
                                <h3 className={`text-sm font-semibold ${accent.title}`}>
                                    <HelpMarked text={block.title} query={query} />
                                </h3>
                            )}
                            <BlockBody block={block} query={query} bulletClass={accent.bullet} />
                        </div>
                    ))}

                    {available && section.route && (
                        <Link
                            to={section.route}
                            className="inline-flex items-center gap-1.5 text-sm font-medium text-orange-600 hover:text-orange-700 hover:underline sm:hidden"
                        >
                            Перейти в раздел
                            <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                    )}
                </CardContent>
            </Card>
        </section>
    );
};

export default HelpArticle;
