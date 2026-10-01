import { useMutation } from '@tanstack/react-query';
import { exportDailyStatement } from '../api/dailyStatement';

export const useExportDailyStatement = () =>
    useMutation({ mutationFn: exportDailyStatement });
