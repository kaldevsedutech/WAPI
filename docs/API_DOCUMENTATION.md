# 🔌 WAPIMI REST API Documentation

This document outlines the complete REST API endpoints, request parameters, response structures, and authentication requirements for **WAPIMI**.

---

## 🔒 Authentication
All protected endpoints require a Bearer token header:
```http
Authorization: Bearer <your_session_token>
Content-Type: application/json
```

---

## 📡 API Endpoint Reference

### 1. Authentication Endpoints
- **`POST /api/auth/login`**: Authenticate user and receive session token.
  - Body: `{ "email": "user@domain.com", "password": "yourpassword" }`
  - Response: `{ "message": "Login successful", "user": {...}, "token": "token_xxx" }`

- **`POST /api/auth/send-whatsapp-otp`**: Dispatch a 6-digit verification OTP code via WhatsApp.
  - Body: `{ "phone": "+919876543210" }`
  - Response: `{ "message": "Verification OTP code dispatched...", "phone": "+919876543210", "otpCode": "482910" }`

- **`POST /api/auth/verify-whatsapp-otp`**: Validate 6-digit OTP code.
  - Body: `{ "phone": "+919876543210", "otp": "482910" }`
  - Response: `{ "message": "WhatsApp number verified successfully!", "verified": true }`

---

### 2. WhatsApp Session Endpoints
- **`GET /api/whatsapp/session`**: Check active Baileys WhatsApp socket connection state.
  - Response: `{ "session": { "sessionStatus": "connected", "allowedWhatsapp": "+919876543210" } }`

- **`POST /api/whatsapp/qr`**: Request a new QR pairing stream.
  - Response: `{ "message": "QR request initialized", "qr": "data:image/png;base64,..." }`

---

### 3. Bulk Campaign Endpoints
- **`GET /api/campaigns`**: List all broadcast campaigns for authenticated user.
  - Response: `{ "campaigns": [...] }`

- **`POST /api/campaigns`**: Create and trigger a new bulk WhatsApp broadcast.
  - Body: `{ "title": "Summer Sale", "contactGroupId": "grp_123", "templateText": "Hello {name}!", "delaySeconds": 5 }`
  - Response: `{ "message": "Campaign created and sending started.", "campaign": {...} }`

- **`POST /api/campaigns/:id/pause`**: Pause an in-progress campaign.
- **`POST /api/campaigns/:id/resume`**: Resume a paused campaign.
- **`POST /api/campaigns/:id/stop`**: Cancel a campaign.

---

### 4. Automated Message Schedule & Alarm Endpoints
- **`GET /api/birthday/config`**: Fetch current message schedule alarm configuration.
  - Response: `{ "config": { "enabled": true, "templateText": "...", "runHour": "09" } }`

- **`POST /api/birthday/config`**: Update message schedule alarm configuration.
  - Body: `{ "enabled": true, "templateText": "Happy Birthday {customer}!", "runHour": "09" }`

- **`POST /api/birthday/trigger`**: Force an immediate execution of the message schedule alarm sweep.

---

### 5. Billing & Subscription Endpoints (Razorpay)
- **`GET /api/billing/plans`**: List available subscription plan tiers and pricing cycles.
- **`POST /api/billing/subscribe`**: Generate Razorpay Order ID for subscription.
  - Body: `{ "planId": "basic", "cycle": "monthly" }`
  - Response: `{ "orderId": "order_xxx", "amount": 100, "currency": "INR" }`

- **`POST /api/billing/verify-payment`**: Validate Razorpay HMAC signature token & activate plan.
  - Body: `{ "razorpay_order_id": "order_xxx", "razorpay_payment_id": "pay_xxx", "razorpay_signature": "sig_xxx", "planId": "basic", "cycle": "monthly" }`
  - Response: `{ "message": "Payment verified & subscription activated!", "active": true }`
