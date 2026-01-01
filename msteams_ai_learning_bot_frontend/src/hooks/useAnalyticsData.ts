import { useEffect, useRef, useState, type DependencyList } from "react";

type AsyncState<T> = {
  data: T | null;
  error: string | null;
  loading: boolean;
};

export function useAnalyticsData<T>(fetcher: () => Promise<T>, deps: DependencyList = []) {
  const [state, setState] = useState<AsyncState<T>>({ data: null, error: null, loading: true });
  const fetcherRef = useRef(fetcher);

  // Always keep a reference to the latest fetcher so callers can pass inline functions
  fetcherRef.current = fetcher;

  useEffect(() => {
    let active = true;
    setState({ data: null, error: null, loading: true });

    const run = async () => {
      try {
        const data = await fetcherRef.current();
        if (active) {
          setState({ data, error: null, loading: false });
        }
      } catch (error) {
        console.error("Failed to load analytics", error);
        if (active) {
          setState({ data: null, error: error instanceof Error ? error.message : String(error), loading: false });
        }
      }
    };

    run();

    return () => {
      active = false;
    };
  }, deps);

  return state;
}
