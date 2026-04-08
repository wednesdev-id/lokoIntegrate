import React, { useState, useEffect } from 'react';
import { Smartphone, Wifi, WifiOff, RefreshCw, Power, PowerOff, QrCode } from 'lucide-react';
import { QRCodeCanvas as QRCode } from 'qrcode.react';
import whatsappService from '../../services/whatsapp.service';
import { DeviceStatus as DeviceStatusType } from '../../types/whatsapp';
import useWhatsAppSSE from '../../hooks/useWhatsAppSSE';

const DeviceStatus: React.FC = () => {
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatusType | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);

  // Use SSE for real-time updates
  const {
    deviceStatus: sseDeviceStatus,
    qrCode: sseQrCode,
    isConnected: sseConnected,
    error: sseError,
    isLoading: sseLoading,
    refetch: refetchSSE
  } = useWhatsAppSSE({
    enabled: false,  // DISABLED - manual refresh only
    autoConnect: false,
    retryOnError: false,
    maxRetries: 0
  });

  const fetchDeviceStatus = async () => {
    try {
      setLoading(true);
      const response = await whatsappService.getDeviceStatus();
      if (response.success && response.data) {
        setDeviceStatus(response.data);

        // Jika device disconnected, coba ambil QR code
        if (response.data.status === 'disconnected' || response.data.status === 'connecting') {
          await fetchQRCode();
        } else {
          setQrCode(null);
        }
      }
    } catch (error) {
      console.error('Error fetching device status:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchQRCode = async () => {
    try {
      setQrLoading(true);
      const response = await whatsappService.getQRCode();
      if (response.success && response.data) {
        setQrCode(response.data.qr_code);
      }
    } catch (error) {
      console.error('Error fetching QR code:', error);
      setQrCode(null);
    } finally {
      setQrLoading(false);
    }
  };

  const handleConnect = async () => {
    try {
      setActionLoading('connect');
      const response = await whatsappService.connectDevice();
      if (response.success) {
        await fetchDeviceStatus();
      }
    } catch (error) {
      console.error('Error connecting device:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDisconnect = async () => {
    try {
      setActionLoading('disconnect');
      const response = await whatsappService.disconnectDevice();
      if (response.success) {
        await fetchDeviceStatus();
      }
    } catch (error) {
      console.error('Error disconnecting device:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRestart = async () => {
    try {
      setActionLoading('restart');
      const response = await whatsappService.restartDevice();
      if (response.success) {
        await fetchDeviceStatus();
      }
    } catch (error) {
      console.error('Error restarting device:', error);
    } finally {
      setActionLoading(null);
    }
  };

  // Update local state when SSE data changes
  useEffect(() => {
    if (sseDeviceStatus) {
      setDeviceStatus(sseDeviceStatus);
      setLoading(false);
    }
  }, [sseDeviceStatus]);

  useEffect(() => {
    if (sseQrCode) {
      setQrCode(sseQrCode);
      setQrLoading(false);
    }
  }, [sseQrCode]);

  useEffect(() => {
    // Initial fetch is handled by useWhatsAppSSE hook
    // Real-time updates are handled by SSE connection
  }, []);

  // Auto-refresh QR code untuk device yang disconnected
  useEffect(() => {
    let qrRefreshInterval: number;

    if (deviceStatus && (deviceStatus.status === 'disconnected' || deviceStatus.status === 'connecting')) {
      // Refresh QR code setiap 30 detik jika device disconnected
      qrRefreshInterval = setInterval(() => {
        if (!qrLoading) {
          fetchQRCode();
        }
      }, 30000);
    }

    return () => {
      if (qrRefreshInterval) {
        clearInterval(qrRefreshInterval);
      }
    };
  }, [deviceStatus?.status, qrLoading]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return 'text-green-700 bg-green-100';
      case 'connecting':
        return 'text-yellow-700 bg-yellow-100';
      case 'disconnected':
        return 'text-red-700 bg-red-100';
      default:
        return 'text-gray-700 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <Wifi className="h-4 w-4" />;
      case 'connecting':
        return <RefreshCw className="h-4 w-4 animate-spin" />;
      case 'disconnected':
        return <WifiOff className="h-4 w-4" />;
      default:
        return <Smartphone className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-20 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <h2 className="text-lg font-medium text-gray-900">Device Status</h2>
          {/* SSE Connection Indicator */}
          <div className="flex items-center space-x-1">
            <div className={`w-2 h-2 rounded-full ${sseConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-xs text-gray-500">
              {sseConnected ? 'Live' : 'Offline'}
            </span>
          </div>
          {sseError && (
            <span className="text-xs text-red-500" title={sseError}>
              Connection Error
            </span>
          )}
        </div>
        <button
          onClick={refetchSSE}
          className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
          disabled={sseLoading}
        >
          <RefreshCw className={`h-4 w-4 ${sseLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {deviceStatus ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
            <div className="flex items-center space-x-3">
              <Smartphone className="h-8 w-8 text-gray-400" />
              <div>
                <h3 className="font-medium text-gray-900">
                  {deviceStatus.phone_number || 'No Phone Number'}
                </h3>
                <p className="text-sm text-gray-500">Device ID: {deviceStatus.device_id}</p>
                {deviceStatus.last_seen && (
                  <p className="text-xs text-gray-400">
                    Last seen: {new Date(deviceStatus.last_seen).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(deviceStatus.status)}`}>
                {getStatusIcon(deviceStatus.status)}
                <span className="ml-1 capitalize">{deviceStatus.status}</span>
              </span>
            </div>
          </div>

          <div className="flex space-x-2">
            {deviceStatus.status === 'disconnected' && (
              <button
                onClick={handleConnect}
                disabled={actionLoading === 'connect'}
                className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {actionLoading === 'connect' ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Power className="h-4 w-4 mr-2" />
                )}
                Connect
              </button>
            )}

            {deviceStatus.status === 'connected' && (
              <button
                onClick={handleDisconnect}
                disabled={actionLoading === 'disconnect'}
                className="flex items-center px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {actionLoading === 'disconnect' ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <PowerOff className="h-4 w-4 mr-2" />
                )}
                Disconnect
              </button>
            )}

            <button
              onClick={handleRestart}
              disabled={actionLoading === 'restart'}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {actionLoading === 'restart' ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Restart
            </button>
          </div>

          {/* QR Code Section */}
          {(deviceStatus.status === 'disconnected' || deviceStatus.status === 'connecting') && (
            <div className="mt-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <QrCode className="h-5 w-5 text-gray-600" />
                  <h3 className="font-medium text-gray-900">Scan QR Code</h3>
                </div>
                <button
                  onClick={fetchQRCode}
                  disabled={qrLoading}
                  className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <RefreshCw className={`h-4 w-4 ${qrLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {qrLoading ? (
                <div className="flex items-center justify-center h-64 bg-white rounded-lg border-2 border-dashed border-gray-300">
                  <div className="text-center">
                    <RefreshCw className="h-8 w-8 text-gray-400 mx-auto mb-2 animate-spin" />
                    <p className="text-gray-500">Generating QR Code...</p>
                  </div>
                </div>
              ) : qrCode ? (
                <div className="text-center">
                  <div className="inline-block p-4 bg-white rounded-lg shadow-sm border">
                    <QRCode
                      value={qrCode}
                      size={256}
                      bgColor="#ffffff"
                      fgColor="#000000"
                      level="M"
                      includeMargin={true}
                    />
                  </div>
                  <div className="mt-4 text-sm text-gray-600">
                    <p className="font-medium">Cara scan QR Code:</p>
                    <ol className="mt-2 text-left space-y-1 max-w-md mx-auto">
                      <li>1. Buka WhatsApp di ponsel Anda</li>
                      <li>2. Tap menu (⋮) atau Settings</li>
                      <li>3. Pilih "Linked Devices" atau "WhatsApp Web"</li>
                      <li>4. Tap "Link a Device" dan scan QR code ini</li>
                    </ol>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-64 bg-white rounded-lg border-2 border-dashed border-gray-300">
                  <div className="text-center">
                    <QrCode className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-500">QR Code tidak tersedia</p>
                    <button
                      onClick={fetchQRCode}
                      className="mt-2 text-blue-600 hover:text-blue-800 transition-colors"
                    >
                      Coba lagi
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-8">
          <Smartphone className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No device information available</p>
          <button
            onClick={fetchDeviceStatus}
            className="mt-2 text-blue-600 hover:text-blue-800 transition-colors"
          >
            Refresh
          </button>
        </div>
      )}
    </div>
  );
};

export default DeviceStatus;