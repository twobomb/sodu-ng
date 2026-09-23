import { splitByQuery } from '../../lib/helpContent';

/**
 * Подсвечивает в тексте совпадения с поисковым запросом справки.
 * Используется и в статьях разделов, и в панели «Содержание».
 */
const HelpMarked = ({ text, query }) => (
    <>
        {splitByQuery(text, query).map((part, index) =>
            part.match ? (
                <mark
                    key={index}
                    className="rounded bg-amber-200/80 px-0.5 text-slate-900 dark:bg-amber-400/30 dark:text-amber-50"
                >
                    {part.text}
                </mark>
            ) : (
                <span key={index}>{part.text}</span>
            )
        )}
    </>
);

export default HelpMarked;
