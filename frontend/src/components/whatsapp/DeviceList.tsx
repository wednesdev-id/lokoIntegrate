import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  Wifi,
  WifiOff,
  RefreshCw,
  Power,
  PowerOff,
  Plus,
  QrCode,
  X,
  Trash2
} from 'lucide-react';
import { QRCodeCanvas as QRCode } from 'qrcode.react';
import whatsappService from '../../services/whatsapp.service';
import { DeviceStatus as DeviceStatusType } from '../../types/whatsapp';
import useWhatsAppSSE from '../../hooks/useWhatsAppSSE';

interface Device extends DeviceStatusType {
  id: string;
  name?: string;
  connected_at?: string;
}

const DeviceList: React.FC = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [newDeviceName, setNewDeviceName] = useState('');

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

  const fetchDevices = async () => {
    try {
      setLoading(true);
      const response = await whatsappService.getDevices();

      if (response.success && response.data) {
        // Map DeviceStatus to Device by adding required id field
        const mappedDevices: Device[] = response.data.map((device: DeviceStatusType, index: number) => ({
          ...device,
          id: device.device_id || `device-${index}`,
          name: device.phone_number || `Device ${index + 1}`
        }));
        setDevices(mappedDevices);
      } else {
        setDevices([]);
      }
    } catch (error) {
      console.error('Error fetching devices:', error);
      setDevices([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddDevice = async () => {
    try {
      setQrLoading(true);
      setShowAddModal(true);

      // Start connection process for new device
      const connectResponse = await whatsappService.connectDevice();
      if (connectResponse.success) {
        // Get QR code for new device
        const qrResponse = await whatsappService.getQRCode();
        if (qrResponse.success && qrResponse.data) {
          // Use qr_code_string for QRCodeSVG library
          setQrCode(qrResponse.data.qr_code_string || qrResponse.data.qr_code);
        }
      }
    } catch (error) {
      console.error('Error adding device:', error);
    } finally {
      setQrLoading(false);
    }
  };

  const handleDeviceAction = async (deviceId: string, action: 'connect' | 'disconnect' | 'restart') => {
    try {
      setActionLoading(`${action}-${deviceId}`);

      let response;
      switch (action) {
        case 'connect':
          response = await whatsappService.connectDevice();
          break;
        case 'disconnect':
          response = await whatsappService.disconnectDevice();
          break;
        case 'restart':
          response = await whatsappService.restartDevice();
          break;
      }

      if (response?.success) {
        await fetchDevices();
      }
    } catch (error) {
      console.error(`Error ${action} device:`, error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemoveDevice = async (deviceId: string) => {
    if (window.confirm('Apakah Anda yakin ingin menghapus device ini?')) {
      try {
        setActionLoading(`remove-${deviceId}`);
        // First disconnect the device
        await whatsappService.disconnectDevice();
        // Then remove from list
        setDevices(devices.filter(device => device.id !== deviceId));
      } catch (error) {
        console.error('Error removing device:', error);
      } finally {
        setActionLoading(null);
      }
    }
  };

  const closeAddModal = () => {
    setShowAddModal(false);
    setQrCode(null);
    setNewDeviceName('');
  };

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

  // Update devices when SSE data changes
  useEffect(() => {
    if (sseDeviceStatus) {
      setDevices(prevDevices => {
        const updatedDevices = [...prevDevices];
        const deviceIndex = updatedDevices.findIndex(d => d.device_id === sseDeviceStatus.device_id);

        if (deviceIndex >= 0) {
          updatedDevices[deviceIndex] = {
            ...updatedDevices[deviceIndex],
            ...sseDeviceStatus
          };
        } else {
          // Add new device if not exists
          updatedDevices.push({
            id: sseDeviceStatus.device_id || 'new',
            name: sseDeviceStatus.phone_number || 'New Device',
            ...sseDeviceStatus
          });
        }

        return updatedDevices;
      });
      setLoading(false);
    }
  }, [sseDeviceStatus]);

  useEffect(() => {
    if (sseQrCode && showAddModal) {
      setQrCode(sseQrCode);
      setQrLoading(false);
    }
  }, [sseQrCode, showAddModal]);

  useEffect(() => {
    fetchDevices();
    // Real-time updates dihandle oleh hook useWhatsAppSSE
  }, []);

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <h2 className="text-lg font-medium text-gray-900">Device Management</h2>
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
        <div className="flex items-center space-x-2">
          <button
            onClick={refetchSSE}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
            disabled={sseLoading}
          >
            <RefreshCw className={`h-4 w-4 ${sseLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleAddDevice}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4 mr-2" />
            Tambah Device
          </button>
        </div>
      </div>

      {devices.length === 0 ? (
        <div className="text-center py-12">
          <Smartphone className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Belum ada device yang terhubung</h3>
          <p className="text-gray-500 mb-6">
            Tambahkan device WhatsApp pertama Anda untuk mulai mengirim pesan
          </p>
          <button
            onClick={handleAddDevice}
            className="flex items-center px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors mx-auto"
          >
            <Plus className="h-5 w-5 mr-2" />
            Tambah Device Pertama
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {devices.map((device) => (
            <div key={device.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <div className="flex items-center space-x-4">
                <Smartphone className="h-8 w-8 text-gray-400" />
                <div>
                  <h3 className="font-medium text-gray-900">
                    {device.name || device.phone_number || 'Unknown Device'}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {device.phone_number ? `Phone: ${device.phone_number}` : 'No phone number'}
                  </p>
                  <p className="text-xs text-gray-400">Device ID: {device.device_id}</p>
                  {device.last_seen && (
                    <p className="text-xs text-gray-400">
                      Last seen: {new Date(device.last_seen).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <span className={`inline-flex items-center px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(device.status)}`}>
                  {getStatusIcon(device.status)}
                  <span className="ml-2 capitalize">{device.status}</span>
                </span>

                <div className="flex items-center space-x-1">
                  {device.status === 'disconnected' && (
                    <button
                      onClick={() => handleDeviceAction(device.id, 'connect')}
                      disabled={actionLoading === `connect-${device.id}`}
                      className="p-2 text-green-600 hover:text-green-800 hover:bg-green-50 rounded-md transition-colors"
                      title="Connect"
                    >
                      {actionLoading === `connect-${device.id}` ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <Power className="h-4 w-4" />
                      )}
                    </button>
                  )}

                  {device.status === 'connected' && (
                    <button
                      onClick={() => handleDeviceAction(device.id, 'disconnect')}
                      disabled={actionLoading === `disconnect-${device.id}`}
                      className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md transition-colors"
                      title="Disconnect"
                    >
                      {actionLoading === `disconnect-${device.id}` ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <PowerOff className="h-4 w-4" />
                      )}
                    </button>
                  )}

                  <button
                    onClick={() => handleDeviceAction(device.id, 'restart')}
                    disabled={actionLoading === `restart-${device.id}`}
                    className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md transition-colors"
                    title="Restart"
                  >
                    {actionLoading === `restart-${device.id}` ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                  </button>

                  <button
                    onClick={() => handleRemoveDevice(device.id)}
                    disabled={actionLoading === `remove-${device.id}`}
                    className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md transition-colors"
                    title="Remove Device"
                  >
                    {actionLoading === `remove-${device.id}` ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Device Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Tambah Device Baru</h3>
              <button
                onClick={closeAddModal}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nama Device (Opsional)
              </label>
              <input
                type="text"
                value={newDeviceName}
                onChange={(e) => setNewDeviceName(e.target.value)}
                placeholder="Contoh: WhatsApp Bisnis"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {qrLoading ? (
              <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                <div className="text-center">
                  <RefreshCw className="h-8 w-8 text-gray-400 mx-auto mb-2 animate-spin" />
                  <p className="text-gray-500">Generating QR Code...</p>
                </div>
              </div>
            ) : qrCode ? (
              <div className="text-center">
                <div className="inline-block p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
                  <QRCode
                    value={qrCode}
                    size={192}
                    bgColor="#ffffff"
                    fgColor="#000000"
                    level="M"
                    includeMargin={true}
                  />
                </div>
                <div className="mt-4 text-sm text-gray-600">
                  <p className="font-medium mb-2">Cara scan QR Code:</p>
                  <ol className="text-left space-y-1">
                    <li>1. Buka WhatsApp di ponsel Anda</li>
                    <li>2. Tap menu (⋮) atau Settings</li>
                    <li>3. Pilih "Linked Devices"</li>
                    <li>4. Tap "Link a Device" dan scan QR code ini</li>
                  </ol>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                <div className="text-center">
                  <QrCode className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-500">QR Code tidak tersedia</p>
                  <button
                    onClick={handleAddDevice}
                    className="mt-2 text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    Coba lagi
                  </button>
                </div>
              </div>
            )}

            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={closeAddModal}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeviceList;