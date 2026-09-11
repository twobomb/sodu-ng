import { Wrench } from 'lucide-react';

const MaintenancePage = () => (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 via-white to-slate-200 p-4">
        <div className="max-w-md text-center">
            <div className="h-24 w-24 mx-auto rounded-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-lg mb-6">
                <Wrench className="h-12 w-12 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-slate-800 mb-3">
                Техническое обслуживание
            </h1>
            <p className="text-slate-500 mb-8">
                Система временно недоступна. Приносим извинения за неудобства.
                Попробуйте зайти позже.
            </p>
            <p className="text-xs text-slate-400">© 2026 СОДУ — Все права защищены</p>
        </div>
    </div>
);

export default MaintenancePage;