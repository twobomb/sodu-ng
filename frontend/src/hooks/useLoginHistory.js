import { useQuery } from '@tanstack/react-query';
import { getLoginHistory } from '../api/loginHistory';

export const useLoginHistory = (params) =>
    useQuery({
        queryKey: ['loginHistory', params],
        queryFn: () => getLoginHistory(params).then((r) => r.data),
        refetchOnWindowFocus: false,
    });