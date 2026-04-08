import React, { useState, useEffect } from "react";
import { QrCode, RefreshCw, Download, Clock, Smartphone } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import whatsappService from "../../services/whatsapp.service";
import { QRCodeResponse } from "../../types/whatsapp";

const QRCodeDisplay: React.FC = () => {
  const [qrData, setQrData] = useState<QRCodeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [useImageFallback, setUseImageFallback] = useState(false);

  const fetchQRCode = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log("Fetching QR code...");

      const response = await whatsappService.getQRCode();
      console.log("QR Code response:", response);

      if (response.success && response.data) {
        setQrData(response.data);
        // Calculate time left until expiration (default 2 minutes)
        setTimeLeft(120);
        setUseImageFallback(false);
        console.log("QR Code data set:", response.data);
      } else {
        console.warn("No QR code data in response");
        // Try to use image fallback
        setUseImageFallback(true);
        setTimeLeft(120);
      }
    } catch (error) {
      console.error("Error fetching QR code:", error);
      setError("Failed to fetch QR code. Please try again.");
      setUseImageFallback(true);
    } finally {
      setLoading(false);
    }
  };

  const downloadQRCode = () => {
    if (useImageFallback) {
      // Download the image from qr-image endpoint
      const link = document.createElement("a");
      link.href = "/api/whatsapp/v1/device/qr-image";
      link.download = `whatsapp-qr-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    if (!qrData?.qr_code) return;

    // Find the canvas element and convert to blob for download
    const canvas = document.querySelector("canvas");
    if (canvas) {
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = `whatsapp-qr-${qrData.device_id || Date.now()}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        }
      });
    }
  };

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  useEffect(() => {
    // Initial fetch
    fetchQRCode();

    // Set up polling to check for QR code updates
    const interval = setInterval(() => {
      if (!qrData || timeLeft === 0) {
        fetchQRCode();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Countdown timer
    if (timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            // QR code expired, fetch new one
            fetchQRCode();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [timeLeft]);

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-medium text-gray-900 flex items-center">
          <Smartphone className="h-5 w-5 mr-2 text-green-600" />
          WhatsApp Connection
        </h2>
        <div className="flex space-x-2">
          {(qrData || useImageFallback) && (
            <button
              onClick={downloadQRCode}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              title="Download QR Code"
            >
              <Download className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={fetchQRCode}
            disabled={loading}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
            title="Refresh QR Code"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <div className="text-center">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <RefreshCw className="h-8 w-8 text-gray-400 animate-spin mb-4" />
            <p className="text-gray-500">Generating QR Code...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12">
            <QrCode className="h-12 w-12 text-red-400 mb-4" />
            <p className="text-red-500 mb-4">{error}</p>
            <button
              onClick={fetchQRCode}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : qrData ? (
          <div className="space-y-4">
            <div className="flex justify-center">
              <div className="p-4 bg-white border-2 border-gray-200 rounded-lg shadow-sm">
                {qrData.qr_code && qrData.qr_code.includes("data:image") ? (
                  // Use base64 image if available
                  <img
                    src={qrData.qr_code}
                    alt="WhatsApp QR Code"
                    className="w-64 h-64"
                  />
                ) : qrData.qr_code_string ? (
                  // Use QR code library with string
                  <QRCodeCanvas
                    value={qrData.qr_code_string}
                    size={256}
                    bgColor="#ffffff"
                    fgColor="#000000"
                    level="M"
                    includeMargin={true}
                  />
                ) : (
                  // Fallback to image endpoint
                  <img
                    src="/api/whatsapp/v1/device/qr-image"
                    alt="WhatsApp QR Code"
                    className="w-64 h-64"
                    onError={() => {
                      console.error("Failed to load QR image");
                      setUseImageFallback(true);
                    }}
                  />
                )}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-gray-600">
                Scan this QR code with your WhatsApp mobile app
              </p>
              {qrData.device_id && (
                <p className="text-xs text-gray-500">
                  Device ID: {qrData.device_id}
                </p>
              )}

              {timeLeft > 0 && (
                <div className="flex items-center justify-center space-x-2 text-sm">
                  <Clock className="h-4 w-4 text-orange-500" />
                  <span className="text-orange-600">
                    Expires in: {formatTime(timeLeft)}
                  </span>
                </div>
              )}

              {timeLeft === 0 && (
                <div className="text-red-600 text-sm">
                  QR Code expired. Click refresh to generate a new one.
                </div>
              )}
            </div>

            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="text-sm font-medium text-blue-900 mb-2">
                How to connect:
              </h3>
              <ol className="text-xs text-blue-800 space-y-1">
                <li>1. Open WhatsApp on your phone</li>
                <li>2. Go to Settings → Linked Devices</li>
                <li>3. Tap "Link a Device"</li>
                <li>4. Scan this QR code</li>
              </ol>
            </div>
          </div>
        ) : useImageFallback ? (
          <div className="space-y-4">
            <div className="flex justify-center">
              <div className="p-4 bg-white border-2 border-gray-200 rounded-lg shadow-sm">
                <img
                  src="/api/whatsapp/v1/device/qr-image"
                  alt="WhatsApp QR Code"
                  className="w-64 h-64"
                  onError={() => {
                    console.error("Failed to load QR image");
                    setError("Failed to load QR code. Please refresh.");
                  }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-gray-600">
                Scan this QR code with your WhatsApp mobile app
              </p>

              {timeLeft > 0 && (
                <div className="flex items-center justify-center space-x-2 text-sm">
                  <Clock className="h-4 w-4 text-orange-500" />
                  <span className="text-orange-600">
                    Expires in: {formatTime(timeLeft)}
                  </span>
                </div>
              )}
            </div>

            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="text-sm font-medium text-blue-900 mb-2">
                How to connect:
              </h3>
              <ol className="text-xs text-blue-800 space-y-1">
                <li>1. Open WhatsApp on your phone</li>
                <li>2. Go to Settings → Linked Devices</li>
                <li>3. Tap "Link a Device"</li>
                <li>4. Scan this QR code</li>
              </ol>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12">
            <QrCode className="h-12 w-12 text-gray-300 mb-4" />
            <p className="text-gray-500 mb-4">No QR code available</p>
            <button
              onClick={fetchQRCode}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Generate QR Code
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default QRCodeDisplay;
