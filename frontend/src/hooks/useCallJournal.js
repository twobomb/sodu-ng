import { useMutation } from '@tanstack/react-query';
import { exportCallJournal } from '../api/callJournal';

export const useExportCallJournal = () =>
    useMutation({ mutationFn: exportCallJournal });