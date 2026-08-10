import { useState, useCallback, useRef } from 'react';

/**
 * ponytail: useOptimisticMutation provides a lightweight optimistic update queue 
 * without introducing a heavy dependency like react-query.
 * Ceiling: Assumes simple single-resource updates. Upgrade to react-query if 
 * cross-query cache invalidation becomes complex.
 */
export function useOptimisticMutation<TData, TVariables>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options: {
    onMutate: (variables: TVariables) => void | Promise<void>;
    onError: (error: Error, variables: TVariables, rollback: () => void) => void;
    onSuccess?: (data: TData, variables: TVariables) => void;
  }
) {
  const [isPending, setIsPending] = useState(false);
  const rollbackFnRef = useRef<() => void>(() => {});

  const mutate = useCallback(async (variables: TVariables, rollbackFn: () => void) => {
    setIsPending(true);
    rollbackFnRef.current = rollbackFn;
    
    // 1. Optimistic Update (Tier 1)
    await options.onMutate(variables);
    
    try {
      // 2. DB Request
      const result = await mutationFn(variables);
      if (options.onSuccess) {
        options.onSuccess(result, variables);
      }
    } catch (e) {
      // 3. Rollback (Tier 2)
      rollbackFnRef.current();
      options.onError(e instanceof Error ? e : new Error('Unknown error'), variables, rollbackFnRef.current);
    } finally {
      setIsPending(false);
    }
  }, [mutationFn, options]);

  return { mutate, isPending };
}
