# 🏛️ WAPIMI Multi-Cloud Architecture & Flowcharts

This document describes the enterprise multi-cloud architecture for WAPIMI, utilizing **$1,362 in Cloud Credits** across GCP, Azure, AWS, DigitalOcean, Heroku, and MongoDB Atlas.

---

## 🗺️ System Flowchart Diagram

```mermaid
flowchart TD
    User([📱 User Client / Browser]) -->|HTTPS| CustomDomain[🌐 Purchased Custom Domain]
    CustomDomain -->|Global CDN| AzureEdge[🟦 Azure Static Web Apps - Frontend React UI]
    
    AzureEdge -->|REST & Webhooks| GCP[🟢 Google Cloud Run - Auto-Scaling API]
    AzureEdge -->|Payment Checkout| Razorpay[💳 Razorpay Gateway]
    
    GCP -->|Async Jobs| AWS_Redis[🟧 AWS ElastiCache - Redis BullMQ Queues]
    GCP -->|Media & PDFs| GCS[🟢 Google Cloud Storage]
    GCP -->|Failover Route| DO[🌊 DigitalOcean App Platform]
    
    AWS_Redis -->|SMS Fallback| AWS_SNS[🟧 AWS SNS SMS Engine]
    
    GCP -->|Cron Alarms| Heroku[🟣 Heroku Dynos - 24/7 Alarm Worker]
    GCP -->|NoSQL Persistence| MongoDB[(🍃 MongoDB Atlas Cluster)]
    
    GCP -->|Error Telemetry| Sentry[🚨 Sentry Error Tracking]
    GCP -->|Encrypted Keys| Doppler[🔐 Doppler Secrets Manager]
```

---

## 🔄 Sequence Flowchart: Bulk Broadcast Execution

```mermaid
sequenceDiagram
    autonumber
    actor User as Business User
    participant Frontend as React Dashboard
    participant API as GCP Cloud Run API
    participant Queue as AWS Redis Queue
    participant Worker as Baileys Socket Worker
    participant WhatsApp as WhatsApp Web API
    participant DB as MongoDB Atlas

    User->>Frontend: Upload CSV & Trigger Campaign
    Frontend->>API: POST /api/campaigns (Title, Template, Group)
    API->>DB: Save Campaign Status ('sending')
    API->>Queue: Enqueue Bulk Messages (Micro-batches)
    API-->>Frontend: 200 OK (Campaign ID)
    
    loop Micro-Batch Processing
        Queue->>Worker: Dequeue 50 Messages
        Worker->>WhatsApp: Send Message via Socket
        WhatsApp-->>Worker: Delivery Receipt
        Worker->>DB: Update Message Status ('delivered')
    end
    
    Worker->>DB: Update Campaign Status ('completed')
    Worker-->>Frontend: Realtime Socket.IO Update (100% Progress)
```

---

## 🔐 Sequence Flowchart: WhatsApp 6-Digit OTP Verification

```mermaid
sequenceDiagram
    autonumber
    actor User as New User
    participant App as WAPIMI App
    participant API as Node.js Express API
    participant WA as Baileys Socket
    participant SNS as AWS SNS (SMS Fallback)
    participant DB as MongoDB Atlas

    User->>App: Enter Mobile Phone Number (+919876543210)
    App->>API: POST /api/auth/send-whatsapp-otp
    API->>API: Generate 6-Digit OTP (e.g. 482910) & Expiry (5m)
    API->>DB: Save OTP Hash & Expiry
    
    alt WhatsApp Socket Active
        API->>WA: Send OTP Code via WhatsApp
    else WhatsApp Socket Offline
        API->>SNS: Dispatch Fallback SMS OTP via AWS SNS
    end
    
    API-->>App: OTP Sent Successfully
    User->>App: Enter 6-Digit OTP Code
    App->>API: POST /api/auth/verify-whatsapp-otp
    API->>DB: Validate Code & Set isWhatsappVerified = true
    API-->>App: 200 OK (Verified!)
```

---

## 📊 Cloud Resource Allocation ($1,362 Credits)

| Cloud Provider | Available Credits | Primary Service | Role in WAPIMI System |
| :--- | :--- | :--- | :--- |
| **Google Cloud (GCP)** | **$300** | Cloud Run & GCS | Serverless API auto-scaling (0 -> 1000 instances) + Media Storage |
| **Microsoft Azure** | **$200** | Static Web Apps | Frontend React CDN Edge + Application Insights Monitoring |
| **AWS** | **$200** | ElastiCache & SNS | Redis BullMQ Campaign Queues + SMS OTP Fallback |
| **DigitalOcean** | **$200** | App Platform | Secondary High-Availability API Failover Node |
| **Heroku** | **$312** | Worker Dynos | 24/7 Background Message Schedule & Alarm Execution |
| **MongoDB Atlas** | **$150** | Production Database | Managed NoSQL Mongoose Database Cluster |
