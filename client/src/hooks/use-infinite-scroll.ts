import { useCallback, useEffect, useRef, useState } from "react";

interface UseInfiniteScrollOptions {
  threshold?: number;
  debounceMs?: number;
  postsPerPage?: number;
}

interface UseInfiniteScrollReturn {
  isLoading: boolean;
  hasMore: boolean;
  loadMore: () => void;
  reset: () => void;
  sentinelRef: (node: HTMLElement | null) => void;
  currentPage: number;
  loadedPostsCount: number;
  setLoadedPostsCount: (count: number) => void;
  setHasMore: (hasMore: boolean) => void;
  setIsLoading: (loading: boolean) => void;
}

export function useInfiniteScroll({
  threshold = 0.1,
  debounceMs = 300,
  postsPerPage = 20,
}: UseInfiniteScrollOptions = {}): UseInfiniteScrollReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [loadedPostsCount, setLoadedPostsCount] = useState(0);

  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useRef<HTMLElement | null>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastLoadTimeRef = useRef<number>(0);

  const reset = useCallback(() => {
    setCurrentPage(0);
    setHasMore(true);
    setLoadedPostsCount(0);
    setIsLoading(false);
  }, []);

  const loadMore = useCallback(() => {
    const now = Date.now();
    const timeSinceLastLoad = now - lastLoadTimeRef.current;

    // Debounce: only load if enough time has passed since last load
    if (timeSinceLastLoad < debounceMs) {
      return;
    }

    // Enhanced debouncing: only load if we have enough posts to justify loading more
    // This implements the "3-4 posts" debouncing strategy
    const expectedPostsForCurrentPage = postsPerPage * (currentPage + 1);
    const postsNeededForNextLoad = Math.max(3, Math.min(4, postsPerPage * 0.2)); // 3-4 posts or 20% of page size

    if (
      loadedPostsCount <
      expectedPostsForCurrentPage - postsNeededForNextLoad
    ) {
      return;
    }

    lastLoadTimeRef.current = now;
    setCurrentPage((prev) => prev + 1);
  }, [currentPage, loadedPostsCount, postsPerPage, debounceMs]);

  const sentinelRefCallback = useCallback(
    (node: HTMLElement | null) => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }

      if (node) {
        sentinelRef.current = node;
        observerRef.current = new IntersectionObserver(
          (entries) => {
            const [entry] = entries;
            if (entry.isIntersecting && hasMore && !isLoading) {
              // Clear any existing debounce timeout
              if (debounceTimeoutRef.current) {
                clearTimeout(debounceTimeoutRef.current);
              }

              // Enhanced debouncing: only trigger if we're close to the end of current posts
              const postsNeededForNextLoad = Math.max(
                3,
                Math.min(4, postsPerPage * 0.2)
              );
              const shouldTriggerLoad =
                loadedPostsCount >=
                postsPerPage * currentPage - postsNeededForNextLoad;

              if (shouldTriggerLoad) {
                // Set a debounce timeout with reduced delay for better UX
                debounceTimeoutRef.current = setTimeout(() => {
                  loadMore();
                }, Math.max(100, debounceMs * 0.5)); // Reduced debounce for smoother experience
              }
            }
          },
          {
            threshold,
            rootMargin: "200px", // Start loading 200px before the sentinel comes into view for smoother experience
          }
        );
        observerRef.current.observe(node);
      }
    },
    [hasMore, isLoading, loadMore, threshold, debounceMs]
  );

  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  return {
    isLoading,
    hasMore,
    loadMore,
    reset,
    sentinelRef: sentinelRefCallback,
    currentPage,
    loadedPostsCount,
    setLoadedPostsCount,
    setHasMore,
    setIsLoading,
  };
}
