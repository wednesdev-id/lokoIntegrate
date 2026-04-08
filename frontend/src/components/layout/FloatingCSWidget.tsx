import React, { useState, useEffect } from 'react';
import { X, Phone } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CsNumber {
  id: number;
  name: string;
  number: string;
  is_active: boolean;
}

// WhatsApp Logo SVG Component
const WhatsAppLogo: React.FC<{ className?: string }> = ({ className }) => (
    <svg
        viewBox="0 0 32 32"
        fill="currentColor"
        className={className}
    >
        <path d="M16,2A13,13,0,0,0,4.69,21.5L2,30l8.65-2.56A12.95,12.95,0,1,0,16,2M16,25.67a10.62,10.62,0,0,1-5.07-1.3l-3.62,1.07,1.07-3.52A10.65,10.65,0,1,1,16,25.67Z"/>
        <path d="M21.75,18.65c-.26-.13-1.53-.75-1.77-.83s-.41-.13-.58.13-.67.83-.82,1-.3.22-.56.09a7,7,0,0,1-3.36-2.93c-.46-.79-.05-.86.22-1.14a6.49,6.49,0,0,0,.58-.83.53.53,0,0,0,0-.5c-.07-.13-.58-1.4-.8-1.91-.21-.5-.43-.43-.58-.44s-.33,0-.51,0a1,1,0,0,0-.72.33,3,3,0,0,0-.94,2.25,5.24,5.24,0,0,0,1.09,2.78,12,12,0,0,0,4.59,4.06c1.67.65,2.32.7,3.13.59a2.64,2.64,0,0,0,1.76-1.24,2.19,2.19,0,0,0,.15-1.24C22.38,19,22,18.78,21.75,18.65Z"/>
    </svg>
);

export const FloatingCSWidget: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [numbers, setNumbers] = useState<CsNumber[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchNumbers = async () => {
            try {
                const axios = await import('axios').then(m => m.default);
                const resp = await axios.get('/api/public/cs-numbers');
                if (resp.data.success) {
                    setNumbers(resp.data.data || []);
                }
            } catch (e) {
                console.error("Fetch CS Numbers public failed", e);
            } finally {
                setLoading(false);
            }
        };
        fetchNumbers();
    }, []);

    if (loading || numbers.length === 0) return null;

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
            {/* Popover List */}
            {isOpen && (
                <div className="bg-white rounded-xl shadow-2xl border border-gray-100 w-64 mb-4 overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-200">
                    <div className="bg-[#25D366] p-4 text-white flex items-center gap-3">
                        <WhatsAppLogo className="h-8 w-8" />
                        <div>
                            <h3 className="font-semibold">Customer Support</h3>
                            <p className="text-xs text-green-100">Chat dengan tim kami</p>
                        </div>
                    </div>
                    <div className="p-2 space-y-1 max-h-60 overflow-y-auto">
                        {numbers.map(n => (
                            <a
                                key={n.id}
                                href={`https://wa.me/${n.number}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors group"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="bg-[#25D366]/10 p-2 rounded-full text-[#25D366] group-hover:bg-[#25D366] group-hover:text-white transition-colors">
                                        <Phone className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-gray-800">{n.name}</p>
                                        <p className="text-xs text-gray-500">Online</p>
                                    </div>
                                </div>
                            </a>
                        ))}
                    </div>
                </div>
            )}

            {/* Float Button - WhatsApp Logo */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "flex items-center justify-center w-16 h-16 rounded-full shadow-lg transition-all transform hover:scale-110 duration-200 focus:outline-none",
                    isOpen
                        ? "bg-gray-100 hover:bg-gray-200 rotate-90"
                        : "bg-[#25D366] hover:bg-[#20bd5a] shadow-[0_4px_20px_rgba(37,211,102,0.4)]"
                )}
            >
                {isOpen ? (
                    <X className="h-6 w-6 text-gray-600" />
                ) : (
                    <WhatsAppLogo className="h-9 w-9 text-white" />
                )}
            </button>
        </div>
    );
};

export default FloatingCSWidget;
