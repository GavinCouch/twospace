import { useMutation } from "@tanstack/react-query";
import { ApiError } from "./api";
import { refreshAccount, refreshSpace } from "./queries";
export function useSpaceMutation<T>(
  userId: string,
  action: (input: T) => Promise<unknown>,
) {
  return useMutation({
    mutationFn: action,
    onSettled: async (_data, error) => {
      if (error instanceof ApiError && [401, 403].includes(error.status))
        await refreshAccount();
      await refreshSpace(userId);
    },
  });
}
