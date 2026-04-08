import { useEffect, useRef, useState, useCallback } from 'react';
import { DeviceStatus } from '../types/whatsapp';

interface SSEData {
  type?: string;
  status?: string;
  is_connected?: boolean;
  is_logged_in?: boolean;
  message?: string;
  timestamp?: string;
  qr_code?: string;
  qr_code_string?: string;
  device_id?: string;
  phone_number?: string;
  last_seen?: string;
}

interface UseWhatsAppSSEReturn {
  deviceStatus: DeviceStatus | null;
  qrCode: string | null;
  isConnected: boolean;
  error: string | null;
  isLoading: boolean;
  connect: () => void;
  disconnect: () => void;
  refetch: () => Promise<void>;
}

interface UseWhatsAppSSEOptions {
  enabled?: boolean;
  autoConnect?: boolean;
  retryOnError?: boolean;
  maxRetries?: number;
}

const useWhatsAppSSE = (
  options: UseWhatsAppSSEOptions = {}
): UseWhatsAppSSEReturn => {
  const {
    enabled = true,
    autoConnect = true,
    retryOnError = true,
    maxRetries = 5
  } = options;

  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const eventSourceRef = useRef<EventSource | null>(null);
  const retryTimeoutRef = useRef<number | null>(null);
  const retryCountRef = useRef(0);
  const isConnectingRef = useRef(false);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    setIsConnected(false);
    setIsLoading(false);
    isConnectingRef.current = false;
  }, []);

  // Disconnect function
  const disconnect = useCallback(() => {
    cleanup();
    setError(null);
    retryCountRef.current = 0;
  }, [cleanup]);

  // Connect function
  const connect = useCallback(() => {
    if (isConnectingRef.current || eventSourceRef.current) {
      return; // Already connecting or connected
    }

    isConnectingRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      console.log(`SSE connection attempt ${retryCountRef.current + 1}/${maxRetries}`);

      // Use relative URL to work with Vite proxy and avoid CORS issues
      const eventSource = new EventSource('/whatsapp/ws');
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        console.log('SSE connection opened successfully');
        setIsConnected(true);
        setIsLoading(false);
        setError(null);
        retryCountRef.current = 0; // Reset retry count on successful connection
        isConnectingRef.current = false;
      };

      eventSource.onmessage = (event) => {
        try {
          const data: SSEData = JSON.parse(event.data);

          // Skip heartbeat messages but log them for debugging
          if (data.type === 'heartbeat') {
            console.log('SSE heartbeat received');
            return;
          }

          console.log('SSE data received:', data);

          // Map backend status to frontend status
          let mappedStatus: 'connected' | 'connecting' | 'disconnected' = 'disconnected';
          if (data.is_connected && data.is_logged_in) {
            mappedStatus = 'connected';
          } else if (data.is_connected && !data.is_logged_in) {
            mappedStatus = 'connecting';
          } else {
            mappedStatus = 'disconnected';
          }

          // Update device status
          const newDeviceStatus: DeviceStatus = {
            device_id: data.device_id || 'default',
            phone_number: data.phone_number || '',
            status: mappedStatus,
            last_seen: data.timestamp || new Date().toISOString(),
          };
          setDeviceStatus(newDeviceStatus);

          // Update QR code - prioritize qr_code_string for QRCodeSVG library
          if (data.qr_code_string || data.qr_code) {
            setQrCode(data.qr_code_string || data.qr_code || null);
          } else if (mappedStatus === 'connected') {
            // Clear QR code when connected
            setQrCode(null);
          }

        } catch (parseError) {
          console.error('Error parsing SSE data:', parseError);
        }
      };

      eventSource.onerror = (event) => {
        console.error('SSE error:', event);
        setIsConnected(false);
        setIsLoading(false);
        isConnectingRef.current = false;

        // Close the current connection
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
          eventSourceRef.current = null;
        }

        // Only retry if we haven't exceeded max retries and retry is enabled
        if (retryCountRef.current < maxRetries && retryOnError && enabled) {
          retryCountRef.current++;
          const retryDelay = Math.min(1000 * Math.pow(2, retryCountRef.current), 30000); // Exponential backoff, max 30s

          setError(`Connection lost. Retrying in ${retryDelay / 1000}s... (${retryCountRef.current}/${maxRetries})`);

          retryTimeoutRef.current = setTimeout(() => {
            if (enabled) {
              connect();
            }
          }, retryDelay);
        } else {
          setError('Connection failed after maximum retries. Please refresh the page.');
        }
      };

    } catch (connectionError) {
      console.error('Error creating SSE connection:', connectionError);
      setError('Failed to establish connection');
      setIsConnected(false);
      setIsLoading(false);
      isConnectingRef.current = false;
    }
  }, [maxRetries, retryOnError, enabled]);

  // Refetch function - manually trigger a reconnection
  const refetch = useCallback(async () => {
    disconnect();
    // Small delay to ensure cleanup is complete
    await new Promise(resolve => setTimeout(resolve, 100));
    connect();
  }, [disconnect, connect]);

  // Auto-connect effect
  useEffect(() => {
    if (enabled && autoConnect) {
      connect();
    }

    // Cleanup on unmount or when disabled
    return () => {
      if (!enabled) {
        cleanup();
      }
    };
  }, [enabled, autoConnect, connect, cleanup]);

  // Handle page visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && enabled && !eventSourceRef.current) {
        // Reconnect when page becomes visible and not connected
        connect();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, connect]);

  return {
    deviceStatus,
    qrCode,
    isConnected,
    error,
    isLoading,
    connect,
    disconnect,
    refetch,
  };
};

export default useWhatsAppSSE;