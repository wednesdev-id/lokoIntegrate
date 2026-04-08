import React, { useState } from 'react';
import { Send, Phone, MessageSquare, Image, FileText, Loader2, AlertCircle } from 'lucide-react';
import { useSession } from '@/contexts/SessionContext';
import SessionBadge from './SessionBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import axios from 'axios';

interface SendMessageFormData {
  phone_number: string;
  message: string;
  message_type: 'text' | 'image' | 'document';
  media_url?: string;
}

const SendMessage: React.FC = () => {
  const { activeSession } = useSession();

  const [formData, setFormData] = useState<SendMessageFormData>({
    phone_number: '',
    message: '',
    message_type: 'text',
  });

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Validation
  const validatePhoneNumber = (phone: string): boolean => {
    const phoneRegex = /^\\+[1-9]\\d{1,14}$/;
    return phoneRegex.test(phone);
  };

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));

    if (success) setSuccess(null);
    if (error) setError(null);
  };

  // Handle submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check active session
    if (!activeSession) {
      setError('Please select a WhatsApp session first');
      return;
    }

    if (activeSession.status !== 'connected') {
      setError('Selected session is not connected. Please connect the session first.');
      return;
    }

    // Validation
    if (!formData.phone_number.trim()) {
      setError('Phone number is required');
      return;
    }

    if (!validatePhoneNumber(formData.phone_number)) {
      setError('Please enter a valid phone number (e.g., +628123456789)');
      return;
    }

    if (!formData.message.trim()) {
      setError('Message is required');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      // Send message using active session
      const response = await axios.post(
        `/api/whatsapp/v1/sessions/${activeSession.session_id}/send-message`,
        {
          phone_number: formData.phone_number,
          message: formData.message,
          message_type: formData.message_type,
          media_url: formData.media_url
        }
      );

      if (response.data.success) {
        setSuccess(`Message sent successfully to ${formData.phone_number} via ${activeSession.session_name}`);

        // Reset form
        setFormData({
          phone_number: '',
          message: '',
          message_type: 'text',
        });
      } else {
        setError(response.data.message || 'Failed to send message');
      }

    } catch (err: any) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Failed to send message');
    } finally {
      setLoading(false);
    }
  };

  const messageTypeIcons = {
    text: MessageSquare,
    image: Image,
    document: FileText,
  };

  const MessageTypeIcon = messageTypeIcons[formData.message_type] || MessageSquare;

  // No active session state
  if (!activeSession) {
    return (
      <Card className="backdrop-blur-xl bg-white/70 border-white/50">
        <CardContent className="p-12">
          <div className="text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No WhatsApp Session Selected</h3>
            <p className="text-sm text-gray-600 mb-4">
              Please select a WhatsApp session from the dropdown above to start sending messages
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Session not connected state
  if (activeSession.status !== 'connected') {
    return (
      <Card className="backdrop-blur-xl bg-white/70 border-white/50">
        <CardContent className="p-12">
          <div className="text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-yellow-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Session Not Connected</h3>
            <p className="text-sm text-gray-600 mb-4">
              The selected session "{activeSession.session_name}" is not connected.
              {activeSession.status === 'qr_ready' && ' Please scan the QR code to connect.'}
              {activeSession.status === 'connecting' && ' Connection is in progress...'}
              {activeSession.status === 'disconnected' && ' Please reconnect this session.'}
            </p>
            <SessionBadge session={activeSession} size="md" showPhone={false} />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="backdrop-blur-xl bg-white/70 border-white/50 shadow-xl">
      <CardHeader className="border-b border-white/50 bg-gradient-to-r from-blue-500/10 to-indigo-500/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Send className="h-5 w-5 text-blue-600" />
            <div>
              <CardTitle>Send Message</CardTitle>
              <CardDescription>Send WhatsApp messages using the active session</CardDescription>
            </div>
          </div>
          <SessionBadge session={activeSession} size="sm" showPhone={true} />
        </div>
      </CardHeader>

      <CardContent className="p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Phone Number */}
          <div>
            <label htmlFor="phone_number" className="block text-sm font-medium text-gray-700 mb-2">
              Recipient Phone Number
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="tel"
                id="phone_number"
                name="phone_number"
                value={formData.phone_number}
                onChange={handleInputChange}
                className="pl-10 backdrop-blur-sm bg-white/60"
                placeholder="+628123456789"
                required
              />
            </div>
            <p className="mt-1.5 text-xs text-gray-500">
              Include country code (e.g., +62 for Indonesia)
            </p>
          </div>

          {/* Message Type */}
          <div>
            <label htmlFor="message_type" className="block text-sm font-medium text-gray-700 mb-2">
              Message Type
            </label>
            <div className="relative">
              <MessageTypeIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <select
                id="message_type"
                name="message_type"
                value={formData.message_type}
                onChange={handleInputChange}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 backdrop-blur-sm bg-white/60"
              >
                <option value="text">Text Message</option>
                <option value="image">Image</option>
                <option value="document">Document</option>
              </select>
            </div>
          </div>

          {/* Media URL (if not text) */}
          {formData.message_type !== 'text' && (
            <div>
              <label htmlFor="media_url" className="block text-sm font-medium text-gray-700 mb-2">
                Media URL
              </label>
              <Input
                type="url"
                id="media_url"
                name="media_url"
                value={formData.media_url || ''}
                onChange={handleInputChange}
                className="backdrop-blur-sm bg-white/60"
                placeholder="https://example.com/image.jpg"
              />
            </div>
          )}

          {/* Message */}
          <div>
            <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
              {formData.message_type === 'text' ? 'Message' : 'Caption'}
            </label>
            <textarea
              id="message"
              name="message"
              value={formData.message}
              onChange={handleInputChange}
              rows={5}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 backdrop-blur-sm bg-white/60"
              placeholder={formData.message_type === 'text' ? 'Type your message here...' : 'Optional caption for media...'}
              required={formData.message_type === 'text'}
            />
            <p className="mt-1.5 text-xs text-gray-500">
              {formData.message.length}/1000 characters
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <Alert variant="destructive" className="backdrop-blur-sm bg-red-50/80">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Success Message */}
          {success && (
            <Alert className="backdrop-blur-sm bg-green-50/80 border-green-200">
              <AlertDescription className="text-green-700">{success}</AlertDescription>
            </Alert>
          )}

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 shadow-lg"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send Message
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default SendMessage;