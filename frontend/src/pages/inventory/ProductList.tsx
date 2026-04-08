import React, { useState, useEffect } from 'react';
import { Package, Plus, Search, Edit, Trash2, MoreVertical, X, ImageIcon, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { api } from '@/services/api';
import { Product, CreateProductRequest } from '@/types/commerce';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/common/ToastProvider';

const ProductList: React.FC = () => {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const { addToast } = useToast();

    // Form State
    const [formData, setFormData] = useState<CreateProductRequest>({
        name: '',
        description: '',
        product_type: 'physical',
        sku: '',
        price: 0,
        cost_price: 0,
        stock: 0,
        min_stock: 0,
        weight: 0,
        image_url: '',
        images: []
    });

    const handleImageUpload = async (files: FileList | File[]) => {
        setIsUploading(true);
        const uploadedUrls: string[] = [];
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (!file.type.startsWith('image/')) {
                addToast('Warning', `${file.name} is not an image`, 'warning');
                continue;
            }
            const data = new FormData();
            data.append('file', file);
            try {
                const res = await api.post('/inventory/products/upload', data, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                if (res.data.url) uploadedUrls.push(res.data.url);
            } catch (error) {
                console.error('File upload failed', error);
                addToast('Error', `Failed to upload ${file.name}`, 'error');
            }
        }
        if (uploadedUrls.length > 0) {
            setFormData(prev => ({
                ...prev,
                images: [...(prev.images || []), ...uploadedUrls],
                image_url: prev.image_url || uploadedUrls[0]
            }));
        }
        setIsUploading(false);
    };

    const removeImage = (index: number) => {
        setFormData(prev => {
            const newImages = [...(prev.images || [])];
            newImages.splice(index, 1);
            return { ...prev, images: newImages, image_url: newImages.length > 0 ? newImages[0] : '' };
        });
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        if (e.clipboardData.files.length > 0) {
            e.preventDefault();
            handleImageUpload(e.clipboardData.files);
        }
    };

    const fetchProducts = async () => {
        try {
            setLoading(true);
            const response = await api.get('/inventory/products');
            setProducts(response.data.data || []);
        } catch (error) {
            console.error('Failed to fetch products:', error);
            addToast('Error', 'Failed to load products', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProducts();
    }, []);

    const handleCreate = async () => {
        try {
            await api.post('/inventory/products', formData);
            addToast('Success', 'Product created successfully', 'success');
            setIsCreateOpen(false);
            resetForm();
            fetchProducts();
        } catch (error) {
            console.error('Failed to create product:', error);
            addToast('Error', 'Failed to create product', 'error');
        }
    };

    const handleUpdate = async () => {
        if (!selectedProduct) return;
        try {
            await api.put(`/inventory/products/${selectedProduct.id}`, formData);
            addToast('Success', 'Product updated successfully', 'success');
            setIsEditOpen(false);
            setSelectedProduct(null);
            resetForm();
            fetchProducts();
        } catch (error) {
            console.error('Failed to update product:', error);
            addToast('Error', 'Failed to update product', 'error');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this product?')) return;
        try {
            await api.delete(`/inventory/products/${id}`);
            addToast('Success', 'Product deleted successfully', 'success');
            fetchProducts();
        } catch (error) {
            console.error('Failed to delete product:', error);
            addToast('Error', 'Failed to delete product', 'error');
        }
    };

    const openEdit = (product: Product) => {
        setSelectedProduct(product);
        setFormData({
            name: product.name,
            description: product.description,
            product_type: product.product_type,
            sku: product.sku,
            price: product.price,
            cost_price: product.cost_price || 0,
            stock: product.stock,
            min_stock: product.min_stock,
            weight: product.weight,
            image_url: product.image_url || '',
            images: product.images || (product.image_url ? [product.image_url] : [])
        });
        setIsEditOpen(true);
    };

    const resetForm = () => {
        setFormData({
            name: '',
            description: '',
            product_type: 'physical',
            sku: '',
            price: 0,
            cost_price: 0,
            stock: 0,
            min_stock: 0,
            weight: 0,
            image_url: '',
            images: []
        });
    };

    const filteredProducts = products.filter(p => 
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(amount);
    };

    const imageUploaderContent = (
        <div className="space-y-3" onPaste={handlePaste}>
            <Label>Product Images</Label>
            <div 
                className="border-2 border-dashed border-border rounded-lg p-6 flex flex-col items-center justify-center bg-muted/20 hover:bg-muted/50 transition-colors cursor-pointer"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); handleImageUpload(e.dataTransfer.files); }}
                onClick={() => document.getElementById('image-upload-input')?.click()}
            >
                <input 
                    id="image-upload-input" 
                    type="file" 
                    multiple 
                    accept="image/*" 
                    className="hidden" 
                    onChange={(e) => e.target.files && handleImageUpload(e.target.files)} 
                />
                {isUploading ? (
                    <div className="flex flex-col items-center gap-2">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <span className="text-sm font-medium">Uploading images...</span>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-2 text-center">
                        <div className="p-3 bg-background rounded-full shadow-sm">
                            <ImageIcon className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <div>
                            <p className="text-sm font-medium">Click to upload or drag & drop</p>
                            <p className="text-xs text-muted-foreground">PNG, JPG, GIF up to 5MB. You can also paste directly.</p>
                        </div>
                    </div>
                )}
            </div>
            
            {/* Image Grid */}
            {(formData.images && formData.images.length > 0) && (
                <div className="grid grid-cols-4 sm:grid-cols-5 gap-3 mt-4">
                    {formData.images.map((url, idx) => (
                        <div key={idx} className="relative aspect-square rounded-md overflow-hidden border group">
                            <img src={url} alt={`Product ${idx}`} className="w-full h-full object-cover bg-muted" />
                            <button 
                                type="button"
                                onClick={(e) => { e.stopPropagation(); removeImage(idx); }}
                                className="absolute top-1 right-1 p-1 bg-red-500/90 hover:bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <X className="h-3 w-3" />
                            </button>
                            {idx === 0 && (
                                <div className="absolute bottom-0 left-0 right-0 bg-primary/80 text-[10px] text-primary-foreground text-center py-0.5 font-medium">
                                    Primary
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div className="flex items-center gap-3">
                    <Package className="h-10 w-10 text-primary" />
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Products</h1>
                        <p className="text-muted-foreground">Manage your product inventory here.</p>
                    </div>
                </div>
                <Button onClick={() => { resetForm(); setIsCreateOpen(true); }}>
                    <Plus className="mr-2 h-4 w-4" /> Add Product
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle>Product List</CardTitle>
                            <CardDescription>View and manage all your products.</CardDescription>
                        </div>
                        <div className="relative w-64">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search products..."
                                className="pl-8"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Product</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>SKU</TableHead>
                                    <TableHead>Price</TableHead>
                                    <TableHead>Stock</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center py-10">Loading...</TableCell>
                                    </TableRow>
                                ) : filteredProducts.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">No products found.</TableCell>
                                    </TableRow>
                                ) : (
                                    filteredProducts.map((product) => (
                                        <TableRow key={product.id}>
                                            <TableCell className="font-medium">
                                                <div className="flex flex-col">
                                                    <span>{product.name}</span>
                                                    <span className="text-xs text-muted-foreground truncate max-w-[200px]">{product.description}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="capitalize">{product.product_type}</Badge>
                                            </TableCell>
                                            <TableCell>{product.sku}</TableCell>
                                            <TableCell>{formatCurrency(product.price)}</TableCell>
                                            <TableCell>
                                                <span className={product.stock <= product.min_stock ? "text-red-500 font-bold" : ""}>
                                                    {product.stock}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={product.status === 'active' ? 'default' : 'secondary'}>
                                                    {product.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" className="h-8 w-8 p-0">
                                                            <MoreVertical className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                        <DropdownMenuItem onClick={() => openEdit(product)}>
                                                            <Edit className="mr-2 h-4 w-4" /> Edit
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(product.id)}>
                                                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* Create Dialog */}
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                        <DialogTitle>Add New Product</DialogTitle>
                        <DialogDescription>Create a new product to add to your inventory.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Product Name</Label>
                                <Input id="name" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} placeholder="e.g. Premium Coffee" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="sku">SKU</Label>
                                <Input id="sku" value={formData.sku} onChange={(e) => setFormData({...formData, sku: e.target.value})} placeholder="e.g. COFFEE-001" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="description">Description</Label>
                            <Textarea id="description" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} placeholder="Product details..." />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="type">Type</Label>
                                <Select value={formData.product_type} onValueChange={(val: any) => setFormData({...formData, product_type: val})}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="physical">Physical</SelectItem>
                                        <SelectItem value="digital">Digital</SelectItem>
                                        <SelectItem value="service">Service</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="stock">Stock</Label>
                                <Input id="stock" type="number" value={formData.stock} onChange={(e) => setFormData({...formData, stock: Number(e.target.value)})} disabled={formData.product_type === 'service'} />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="cost_price">Cost Price (Modal) IDR</Label>
                                <Input id="cost_price" type="number" value={formData.cost_price || 0} onChange={(e) => setFormData({...formData, cost_price: Number(e.target.value)})} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="price">Selling Price (Jual) IDR</Label>
                                <Input id="price" type="number" value={formData.price} onChange={(e) => setFormData({...formData, price: Number(e.target.value)})} />
                            </div>
                        </div>
                         {formData.product_type === 'physical' && (
                             <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="weight">Weight (grams)</Label>
                                    <Input id="weight" type="number" value={formData.weight} onChange={(e) => setFormData({...formData, weight: Number(e.target.value)})} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="min_stock">Min Stock Alert</Label>
                                    <Input id="min_stock" type="number" value={formData.min_stock} onChange={(e) => setFormData({...formData, min_stock: Number(e.target.value)})} />
                                </div>
                             </div>
                        )}
                        {imageUploaderContent}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                        <Button onClick={handleCreate}>Create Product</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Dialog */}
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                        <DialogTitle>Edit Product</DialogTitle>
                        <DialogDescription>Update product details.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="edit-name">Product Name</Label>
                                <Input id="edit-name" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="edit-sku">SKU</Label>
                                <Input id="edit-sku" value={formData.sku} onChange={(e) => setFormData({...formData, sku: e.target.value})} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-description">Description</Label>
                            <Textarea id="edit-description" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="edit-type">Type</Label>
                                <Select value={formData.product_type} onValueChange={(val: any) => setFormData({...formData, product_type: val})}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="physical">Physical</SelectItem>
                                        <SelectItem value="digital">Digital</SelectItem>
                                        <SelectItem value="service">Service</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="edit-stock">Stock</Label>
                                <Input id="edit-stock" type="number" value={formData.stock} onChange={(e) => setFormData({...formData, stock: Number(e.target.value)})} disabled={formData.product_type === 'service'} />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="edit-cost_price">Cost Price (Modal) IDR</Label>
                                <Input id="edit-cost_price" type="number" value={formData.cost_price || 0} onChange={(e) => setFormData({...formData, cost_price: Number(e.target.value)})} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="edit-price">Selling Price (Jual) IDR</Label>
                                <Input id="edit-price" type="number" value={formData.price} onChange={(e) => setFormData({...formData, price: Number(e.target.value)})} />
                            </div>
                        </div>
                        {formData.product_type === 'physical' && (
                             <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="edit-weight">Weight (grams)</Label>
                                    <Input id="edit-weight" type="number" value={formData.weight} onChange={(e) => setFormData({...formData, weight: Number(e.target.value)})} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="edit-min_stock">Min Stock Alert</Label>
                                    <Input id="edit-min_stock" type="number" value={formData.min_stock} onChange={(e) => setFormData({...formData, min_stock: Number(e.target.value)})} />
                                </div>
                             </div>
                        )}
                        {imageUploaderContent}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
                        <Button onClick={handleUpdate}>Save Changes</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default ProductList;
