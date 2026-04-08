import { useState, useEffect, useCallback, useRef } from 'react';

interface UseMediaRetryProps {
    url: string | undefined;
    maxRetries?: number;
}

interface UseMediaRetryReturn {
    mediaUrl: string | undefined;
    isLoading: boolean;
    hasError: boolean;
    retryCount: number;
    canRetry: boolean;
    handleRetry: () => void;
    handleLoad: () => void;
    handleError: () => void;
}

/**
 * Custom hook for handling media loading with automatic retry logic
 * Features:
 * - Automatic retry with exponential backoff (0s, 1s, 2s, 4s)
 * - Manual retry option after max retries
 * - Loading and error states
 * - Cache-busting on retry
 */
export const useMediaRetry = ({
    url,
    maxRetries = 3
}: UseMediaRetryProps): UseMediaRetryReturn => {
    const [mediaUrl, setMediaUrl] = useState<string | undefined>(url);
    const [isLoading, setIsLoading] = useState(!!url);
    const [hasError, setHasError] = useState(false);
    const [retryCount, setRetryCount] = useState(0);
    const retryTimeoutRef = useRef<number>();

    // Update URL when prop changes
    useEffect(() => {
        if (url !== mediaUrl && url) {
            setMediaUrl(url);
            setIsLoading(true);
            setHasError(false);
            setRetryCount(0);
        }
    }, [url]);

    // Auto-retry with exponential backoff
    const scheduleRetry = useCallback(() => {
        if (retryCount >= maxRetries) {
            setIsLoading(false);
            setHasError(true);
            return;
        }

        // Exponential backoff: 0s, 1s, 2s, 4s
        const delay = retryCount === 0 ? 0 : Math.pow(2, retryCount - 1) * 1000;

        console.log(`📸 Scheduling retry ${retryCount + 1}/${maxRetries} after ${delay}ms`);

        retryTimeoutRef.current = setTimeout(() => {
            console.log(`🔄 Retry attempt ${retryCount + 1}/${maxRetries}`);
            setRetryCount(prev => prev + 1);
            setIsLoading(true);
            setHasError(false);

            // Force URL reload with cache-busting timestamp
            const separator = url?.includes('?') ? '&' : '?';
            setMediaUrl(`${url}${separator}retry=${Date.now()}`);
        }, delay);
    }, [url, retryCount, maxRetries]);

    const handleError = useCallback(() => {
        console.log(`❌ Media load failed (attempt ${retryCount + 1})`);
        setIsLoading(false);
        setHasError(true);
        scheduleRetry();
    }, [scheduleRetry, retryCount]);

    const handleLoad = useCallback(() => {
        console.log(`✅ Media loaded successfully${retryCount > 0 ? ` (after ${retryCount} retries)` : ''}`);
        setIsLoading(false);
        setHasError(false);

        // Clear any pending retry
        if (retryTimeoutRef.current) {
            clearTimeout(retryTimeoutRef.current);
        }
    }, [retryCount]);

    const handleRetry = useCallback(() => {
        console.log('🔄 Manual retry triggered');
        setRetryCount(0);
        setIsLoading(true);
        setHasError(false);

        // Clear any pending retry
        if (retryTimeoutRef.current) {
            clearTimeout(retryTimeoutRef.current);
        }

        // Force reload with new timestamp
        const separator = url?.includes('?') ? '&' : '?';
        setMediaUrl(`${url}${separator}retry=${Date.now()}`);
    }, [url]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (retryTimeoutRef.current) {
                clearTimeout(retryTimeoutRef.current);
            }
        };
    }, []);

    return {
        mediaUrl,
        isLoading,
        hasError,
        retryCount,
        canRetry: retryCount >= maxRetries && hasError,
        handleRetry,
        handleLoad,
        handleError
    };
};
