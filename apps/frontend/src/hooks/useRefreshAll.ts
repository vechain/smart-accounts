import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

export const useRefreshAll = () => {
    const queryClient = useQueryClient();

    const refreshData = useCallback(async () => {
        queryClient.cancelQueries(); // Cancel ongoing queries
        await queryClient.refetchQueries(); // Refetch all queries
    }, [queryClient]);

    return refreshData;
};
