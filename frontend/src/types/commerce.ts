// Inventory Types

export interface Product {
    id: string;
    name: string;
    description: string;
    product_type: 'physical' | 'digital' | 'service';
    sku: string;
    price: number;
    cost_price: number;
    currency: string;
    image_url?: string;
    images?: string[];
    status: 'active' | 'inactive' | 'archived';
    is_active: boolean;
    stock: number;
    min_stock: number;
    weight: number;
    created_at: string;
    updated_at: string;
    digital_assets?: ProductDigitalAsset[];
}

export interface ProductDigitalAsset {
    id: string;
    product_id: string;
    file_url: string;
    download_url: string;
    license_key?: string;
    access_type: string;
    created_at: string;
}

export interface CreateProductRequest {
    name: string;
    description?: string;
    product_type: 'physical' | 'digital' | 'service';
    sku?: string;
    price: number;
    stock: number;
    image_url?: string;
    images?: string[];
    cost_price?: number;
    min_stock?: number;
    weight?: number;
}

export interface UpdateProductRequest extends Partial<CreateProductRequest> {
    status?: 'active' | 'inactive' | 'archived';
}

// Order Types

export interface Order {
    id: string;
    order_code: string;
    user_id: string;
    phone_number: string;
    customer_name: string;
    customer_note?: string;
    subtotal: number;
    discount_amount: number;
    tax_amount: number;
    total_amount: number;
    payment_status: 'unpaid' | 'paid' | 'failed' | 'refunded';
    order_status: 'pending_payment' | 'waiting_verification' | 'paid' | 'processing' | 'completed' | 'cancelled';
    shipping_name?: string;
    shipping_phone?: string;
    shipping_address?: string;
    shipping_city?: string;
    shipping_province?: string;
    shipping_postal_code?: string;
    created_at: string;
    updated_at: string;
    items?: OrderItem[];
    payment_proofs?: PaymentProof[];
}

export interface OrderItem {
    id: string;
    order_id: string;
    product_id: string;
    product_name: string;
    product_type: string;
    sku: string;
    price: number;
    quantity: number;
    subtotal: number;
}

// Sales Types

export interface PaymentMethod {
    id: string;
    payment_name: string;
    payment_type: 'bank_transfer' | 'qris' | 'e-wallet';
    provider?: string;
    account_name?: string;
    account_number?: string;
    payment_image_url?: string;
    instructions?: string;
    status: 'active' | 'inactive';
    created_at: string;
    updated_at: string;
}

export interface CreatePaymentMethodRequest {
    payment_name: string;
    payment_type: 'bank_transfer' | 'qris' | 'e-wallet';
    provider?: string;
    account_name?: string;
    account_number?: string;
    payment_image_url?: string;
    instructions?: string;
    status?: 'active' | 'inactive';
}

export interface PaymentProof {
    id: string;
    order_id: string;
    phone_number: string;
    media_url: string;
    notes?: string;
    verification_status: 'pending' | 'verified' | 'rejected';
    verified_at?: string;
    created_at: string;
}
