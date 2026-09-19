import { useState } from 'react';
import {
    HelpCircle,
    Bug,
    BookOpen,
    MessageCircle,
    FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import ReportBugModal from '../components/ReportBugModal';

const HelpPage = () => {
    const [reportOpen, setReportOpen] = useState(false);

    return (
        <div className="space-y-4 max-w-4xl">
            <div>
                <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <HelpCircle className="h-6 w-6 text-orange-500" />
                    Справка
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                    Информация о системе и обратная связь с разработчиком
                </p>
            </div>

            {/* Карточка "Сообщить об ошибке" — главная фича */}
            <Card className="rounded-2xl border-orange-200 dark:border-orange-500/30 bg-gradient-to-br from-orange-50 dark:from-orange-500/15 to-red-50 dark:to-red-500/15 shadow-sm">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <Bug className="h-5 w-5 text-orange-600" />
                        Нашли ошибку?
                    </CardTitle>
                    <CardDescription>
                        Опишите проблему — сообщение уйдёт разработчику в личный чат.
                        Там же он сможет вам ответить.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Button
                        onClick={() => setReportOpen(true)}
                        className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 rounded-lg gap-2"
                    >
                        <Bug className="h-4 w-4" />
                        Сообщить об ошибке
                    </Button>
                </CardContent>
            </Card>

            {/* Заглушки для будущей документации */}
            <div className="grid md:grid-cols-2 gap-4">
                <Card className="rounded-2xl border-slate-200 shadow-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <BookOpen className="h-4 w-4 text-slate-500" />
                            Руководство пользователя
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-slate-400">
                            Раздел в разработке. Здесь будет описание работы с системой.
                        </p>
                    </CardContent>
                </Card>

                <Card className="rounded-2xl border-slate-200 shadow-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <FileText className="h-4 w-4 text-slate-500" />
                            Часто задаваемые вопросы
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-slate-400">
                            Раздел в разработке. Здесь будут ответы на типичные вопросы.
                        </p>
                    </CardContent>
                </Card>

                <Card className="rounded-2xl border-slate-200 shadow-sm md:col-span-2">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <MessageCircle className="h-4 w-4 text-slate-500" />
                            Связь с разработчиком
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-slate-400">
                            Если у вас есть вопрос по работе системы — напишите в чат
                            разработчику. Он доступен через кнопку «Чат» в шапке.
                        </p>
                    </CardContent>
                </Card>
            </div>

            <ReportBugModal open={reportOpen} onOpenChange={setReportOpen} />
        </div>
    );
};

export default HelpPage;