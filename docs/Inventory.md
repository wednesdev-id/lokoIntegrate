# Product Requirements Document

# Product Name

WhatsApp Commerce Auto Reply Engine

# Background

Many businesses use WhatsApp as their primary sales channel. However, most transactions are handled manually, which causes slow responses, inconsistent order handling, and inventory mistakes.

This system transforms WhatsApp into a **chat-based commerce platform** where customers can browse products, order multiple items, purchase digital products or services, and confirm payments directly in chat.

The platform integrates with a WhatsApp gateway (such as WhatsMeow) and includes an admin dashboard for managing inventory, services, orders, and payments.

The system must support **multiple products per order** and **multiple product types** including physical goods, digital goods, and services.

---

# Objectives

1. Automate product and service inquiries via WhatsApp.
2. Allow customers to browse multiple products.
3. Support multi-product cart ordering.
4. Support physical products, digital products, and services.
5. Allow payment confirmation through WhatsApp.
6. Automatically update inventory after payment confirmation.
7. Provide admin dashboard for managing products, services, orders, and payments.

---

# Supported Product Types

The system must support three primary product categories.

## Physical Products

Examples:

Coffee beans
Clothing
Food
Merchandise

Requirements:

Inventory stock tracking
Shipping address required
Inventory reduced after successful payment

---

## Digital Products

Examples:

E-books
Software licenses
Design templates
Online courses

Requirements:

No inventory tracking required (optional)
No shipping address required
Digital file or download link delivered after payment

---

## Services

Examples:

Consultation
Coaching
Design services
Website development packages

Requirements:

No inventory
Schedule or service description provided
Order creates a service request

---

# User Roles

## Admin

Business owner or staff managing the commerce system.

Responsibilities:

Manage products
Manage services
Verify payments
Monitor orders
Manage inventory

## Customer

Customer who interacts with the business through WhatsApp.

Capabilities:

Browse products
Order multiple items
Send payment proof
Receive digital goods

---

# Admin Dashboard Menu Structure

The admin dashboard contains two main modules.

Inventory
Sales

---

# Module: Inventory

Handles product management and order management.

Submenus:

Products
Orders

---

# Submenu: Products

Purpose:

Manage all products and services available for sale.

Admin Capabilities:

Add product
Edit product
Delete product
Upload product images
Manage stock
Set price
Set product type

---

# Product Fields

id
name
description
price
product_type (physical | digital | service)
image_url
stock
sku
status
created_at
updated_at

---

# Product Logic

If product_type = physical

System tracks stock
Shipping address required

If product_type = digital

No shipping address required
System sends download link after payment

If product_type = service

Order becomes service request
No stock reduction

---

# Submenu: Orders

Purpose:

Track all customer orders created through WhatsApp conversations.

Orders must support **multiple products per order**.

---

# Order Structure

Order

id
phone_number
customer_name
subtotal
payment_status
order_status
shipping_address
created_at

Order Items

id
order_id
product_id
product_name
quantity
price
subtotal

---

# Order Status

Pending Payment
Waiting Verification
Paid
Processing
Completed
Cancelled

---

# Order Flow

Customer browses product menu.

Customer selects product.

Product added to cart.

Customer can add additional products.

Customer confirms order.

System generates order record.

Order status becomes:

Pending Payment

---

# Module: Sales

Handles payment methods and payment verification.

Submenu:

Payments

---

# Submenu: Payments

Purpose:

Manage payment methods used by customers.

Admin can upload payment media including:

Bank Transfer
QRIS
E-Wallet

---

# Payment Fields

id
payment_name
payment_type
payment_account_name
payment_number
payment_image_url
status
created_at

---

# Payment Display in WhatsApp

Example:

Payment Instructions

Transfer to:

Bank BCA
Account Name: Toko Nusantara
Account Number: 123456789

Or scan QRIS below

[QRIS IMAGE]

After payment please send proof of transfer.

---

# Payment Confirmation via WhatsApp

Customer sends transfer proof image through WhatsApp.

System actions:

1. Receive media message
2. Store image in media storage
3. Link proof to order
4. Change order status to "Waiting Verification"

Admin verifies payment from dashboard.

When admin confirms payment:

Order status becomes "Paid".

---

# Automatic Inventory Update

After payment confirmation:

For each order item:

If product_type = physical

Stock reduced by quantity ordered.

Example

Stock = 10

Customer orders = 3

Stock becomes = 7

System must prevent negative inventory.

If stock reaches 0

Product automatically marked "Out of Stock".

---

# Digital Product Delivery

If product_type = digital

After payment confirmation:

System sends WhatsApp message containing:

Download link
License key
Or digital file

---

# Service Order Handling

If product_type = service

Order becomes service request.

Admin receives notification.

Admin can contact customer manually to schedule service.

---

# WhatsApp Conversation Flow

Customer opens WhatsApp chat.

Bot sends welcome message.

Example:

Hello 👋

Welcome to our store.

Type MENU to see products.

---

Customer sends:

MENU

Bot shows product list.

Customer selects product.

Product added to cart.

Bot asks:

Add another product?

YES / CHECKOUT

Customer continues adding items or checks out.

Customer enters quantity.

Customer sends shipping address (if physical product).

System generates order.

Bot sends payment instructions.

Customer sends payment proof.

Admin verifies payment.

System updates stock and order status.

---

# System Components

WhatsApp Gateway (WhatsMeow)

Message Listener

Conversation Engine

Cart Service

Inventory Service

Order Service

Payment Service

Media Storage

Admin Dashboard

Database

---

# Database Tables

Below are the required entities and fields for the system ERD. Only field definitions are specified so they can be adapted to your existing backend structure (GoFiber).

---

## products

id
name
description
product_type
sku
price
currency
image_url
status
is_active
stock
min_stock
weight
created_at
updated_at

---

## product_digital_assets

id
product_id
file_url
download_url
license_key
access_type
created_at
updated_at

Purpose:
Store digital files or download links for digital products.

---

## orders

id
order_code
phone_number
customer_name
customer_note
subtotal
discount_amount
tax_amount
total_amount
payment_status
order_status
shipping_name
shipping_phone
shipping_address
shipping_city
shipping_province
shipping_postal_code
created_at
updated_at

---

## order_items

id
order_id
product_id
product_name
product_type
sku
price
quantity
subtotal
created_at
updated_at

---

## payments

id
payment_name
payment_type
provider
account_name
account_number
payment_image_url
instructions
status
created_at
updated_at

---

## payment_proofs

id
order_id
phone_number
media_url
notes
verification_status
verified_by
verified_at
created_at

---

## inventory_movements

id
product_id
movement_type
quantity
reference_type
reference_id
notes
created_at

movement_type values:

stock_in
stock_out
adjustment
sale

Purpose:
Track stock changes for auditing and reconciliation.

---

## sessions

id
session_code
phone_number
conversation_state
cart_data
last_message
last_interaction_at
created_at
updated_at

Notes:

session_code is a unique identifier for the WhatsApp session instance. It is useful when multiple WhatsApp accounts or gateway instances are connected to the same system.

Purpose:
Track WhatsApp conversation state for chatbot automation and associate messages with the correct WhatsApp gateway session.

---

## carts

id
phone_number
status
created_at
updated_at

---

## cart_items

id
cart_id
product_id
product_name
product_type
price
quantity
subtotal
created_at
updated_at

---

## media_storage

id
media_type
file_url
mime_type
file_size
uploaded_by
created_at

Purpose:
Store uploaded media such as product images, payment proof, or QR codes.

---

# Non Functional Requirements

Performance

Message processing < 2 seconds

Scalability

Support thousands of concurrent chats

Reliability

No message or order loss

Security

Admin authentication required

Media uploads validated

---

# Future Enhancements

AI conversation assistant

Automatic payment verification (OCR)

Shipping API integration

Analytics dashboard

Multi-store SaaS architecture

Subscription-based merchants
