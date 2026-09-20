import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    getLineNotesByDepartment,
    getLineNote,
    getLineNotesStatus,
    createLineNote,
    updateLineNote,
    copyLineNote,
} from '../api/lineNotes';

export const useLineNotesByDepartment = (departmentId) =>
    useQuery({
        queryKey: ['line-notes', departmentId],
        queryFn: () =>
            getLineNotesByDepartment(departmentId).then((r) => r.data),
        enabled: !!departmentId,
        staleTime: 10 * 1000,
    });

export const useLineNote = (departmentId, date) =>
    useQuery({
        queryKey: ['line-note', departmentId, date],
        queryFn: () => getLineNote(departmentId, date).then((r) => r.data),
        enabled: !!departmentId && !!date,
        staleTime: 5000,
    });

export const useLineNotesStatus = (date) =>
    useQuery({
        queryKey: ['line-notes-status', date],
        queryFn: () => getLineNotesStatus(date).then((r) => r.data),
        enabled: !!date,
        staleTime: 10 * 1000,
    });

export const useCreateLineNote = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: createLineNote,
        onSuccess: () => {
            qc.invalidateQueries({ predicate: (q) => q.queryKey[0] === 'line-notes' });
            qc.invalidateQueries({ predicate: (q) => q.queryKey[0] === 'line-note' });
            qc.invalidateQueries({ predicate: (q) => q.queryKey[0] === 'line-notes-status' });
        },
    });
};

export const useUpdateLineNote = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }) => updateLineNote(id, data),
        onSuccess: () => {
            qc.invalidateQueries({ predicate: (q) => q.queryKey[0] === 'line-notes' });
            qc.invalidateQueries({ predicate: (q) => q.queryKey[0] === 'line-note' });
            qc.invalidateQueries({ predicate: (q) => q.queryKey[0] === 'line-notes-status' });
        },
    });
};

export const useCopyLineNote = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: copyLineNote,
        onSuccess: () => {
            qc.invalidateQueries({ predicate: (q) => q.queryKey[0] === 'line-notes' });
            qc.invalidateQueries({ predicate: (q) => q.queryKey[0] === 'line-note' });
            qc.invalidateQueries({ predicate: (q) => q.queryKey[0] === 'line-notes-status' });
        },
    });
};