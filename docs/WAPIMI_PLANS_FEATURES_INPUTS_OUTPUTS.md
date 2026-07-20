# 📋 WAPIMI — PLAN-WISE FEATURES, INPUT FIELDS & OUTPUTS SPECIFICATION

This master specification details:
1. **Plan-Wise Feature Matrix**: What features are included in each subscription plan tier.
2. **Feature Inventory**: Explanation of what every feature is and what it does.
3. **Comprehensive Input/Output Dictionary**: A complete field-by-field breakdown of all input controls and expected outputs across the platform.

---

## 📑 TABLE OF CONTENTS
1. [PLAN-WISE FEATURE COMPARISON MATRIX](#1-plan-wise-feature-comparison-matrix)
2. [FEATURE INVENTORY & DESCRIPTION](#2-feature-inventory--description)
3. [COMPLETE INPUT FIELDS & OUTPUTS DICTIONARY](#3-complete-input-fields--outputs-dictionary)

---

## 1. PLAN-WISE FEATURE COMPARISON MATRIX

WAPIMI offers 3 subscription tiers with flexible **Daily**, **Weekly**, **Monthly**, and **Annual** billing cycles via **Razorpay**:

| Feature / Capability | Basic Growth Plan | Premium Automation Suite | Business Broadcast Unlimited |
| :--- | :--- | :--- | :--- |
| **Pricing (Daily / Weekly / Monthly / Annual)** | **$5 / $30 / $100 / $1,000** | **$15 / $90 / $300 / $3,000** | **$25 / $150 / $500 / $5,000** |
| **Daily Message Limit** | **1,000 messages / day** | **10,000 messages / day** | **Unlimited Messages** |
| **WhatsApp Device Pairing** | 1 Device Connection | 3 Device Connections | Multi-Number Connection |
| **Bulk Broadcast Campaigns** | Included | Included | Included (Unlimited) |
| **CSV Contact Import** | Included (Max 5,000 contacts) | Included (Max 50,000 contacts) | Included (Unlimited Contacts) |
| **Message Scheduling Alarm** | **Included** | **Included** | **Included** |
| **Rule-Based Auto Replies** | Included (Exact Match) | Included (Exact & Contains) | Included (Saved Responses) |
| **WhatsApp 6-Digit OTP Verification** | Included | Included | Included (Priority Verification) |
| **2-Way Shared Inbox** | Included | Included | Included |
| **Analytics & Reporting** | Basic Outbound Metrics | Advanced Engagement Charts | Enterprise Audit & Exports |
| **PDF & CSV Export** | Included | Included | Included |
| **Razorpay Instant Checkout** | Included | Included | Included |

---

## 2. FEATURE INVENTORY & DESCRIPTION

### Feature 1: WhatsApp Device Pairing & Link
- **What it is**: Pairs a user's mobile WhatsApp account with WAPIMI using Baileys multi-device WebSockets.
- **What it does**: Establishes a secure connection to send and receive messages directly through the user's phone session.

### Feature 2: Bulk Broadcast Campaign Engine
- **What it is**: Mass WhatsApp messaging engine with dynamic CSV tag substitution.
- **What it does**: Sends thousands of personalized messages (`Hello {name}! Your offer in {city} is ready`) with customizable anti-ban delay throttling.

### Feature 3: Automated Message Schedule & Alarm Clock
- **What it is**: Background cron alarm clock running automated daily message sweeps.
- **What it does**: Automatically checks contact date fields (e.g. birthdays/renewals) every morning at your chosen `runHour` (e.g. `09:00 AM`) and dispatches greetings.

### Feature 4: WhatsApp 6-Digit OTP Verification
- **What it is**: Security mechanism to verify customer WhatsApp numbers via 6-digit OTP codes.
- **What it does**: Dispatches a 6-digit code to the user's WhatsApp app and validates it to mark the account as `isWhatsappVerified`.

### Feature 5: Rule-Based Auto Replies
- **What it is**: Keyword-based automated message responder.
- **What it does**: Listens for incoming WhatsApp messages and instantly replies if keywords match rules (`exact` or `contains`).

### Feature 6: 2-Way Shared Inbox & Live Chat
- **What it is**: Live customer conversation dashboard.
- **What it does**: Displays incoming messages in real-time and allows team members to reply manually.

### Feature 7: Contact Groups & CSV List Importer
- **What it is**: Audience list management tool.
- **What it does**: Parses uploaded CSV files, extracts headers as replaceable template variables (`{name}`, `{city}`, `{custom}`), and stores target contact lists.

### Feature 8: Campaign Reports & Exporter
- **What it is**: Performance tracking and reporting dashboard.
- **What it does**: Displays campaign delivery metrics (Sent, Failed, Pending) and exports reports to CSV or PDF.

### Feature 9: Razorpay Billing & Subscription Manager
- **What it is**: Subscription management and checkout engine.
- **What it does**: Generates Razorpay Order IDs, launches checkout modals, verifies HMAC signatures, and activates plan tiers.

---

## 3. COMPLETE INPUT FIELDS & OUTPUTS DICTIONARY

---

### Module 1: WhatsApp Link & Scanner (`id: "scanner"`)

#### Inputs:
| Field Name | Control Type | Format / Validation | Purpose |
| :--- | :--- | :--- | :--- |
| `Scanned Phone Number` | Text Input | E.164 string (e.g., `+919876543210`) | Validate scanned device against user's `allowedWhatsapp` number rule. |
| `Request QR Code` | Button Click | N/A | Trigger Baileys WebSocket stream to generate new pairing QR code. |
| `Simulate Scan` | Button Click | N/A | Test pairing completion in local development environment. |

#### Outputs:
| Output Name | Visual UI / Server Response | Effect / Mutation |
| :--- | :--- | :--- |
| `Connection State Badge` | Green `Active`, Red `Disconnected`, or `Scan Required` badge. | Updates `sessionStatus` state. |
| `QR Canvas Stream` | Visual QR image code streamed from Baileys socket. | Displays scan code to user. |
| `Session Metadata` | Displays connected phone, push name, last active time. | Writes session to DB (`sessions`). |

---

### Module 2: Bulk Broadcast Campaign Engine (`id: "campaign_create"`)

#### Inputs:
| Field Name | Control Type | Format / Validation | Purpose |
| :--- | :--- | :--- | :--- |
| `Campaign Title` | Text Input | Non-empty string (e.g. *Diwali Sale*) | Identify the campaign in reports and logs. |
| `Target Contact Group` | Dropdown Select | Valid Group ID from list | Choose recipient audience group. |
| `Message Template` | Text Area | Supports `{name}`, `{city}`, `{custom}` tags | Template text for broadcast message. |
| `Sending Delay` | Number Slider | Integer (1 to 30 seconds) | Anti-ban throttler interval between messages. |
| `Scheduled Time` | Datetime Picker | ISO string / future timestamp | Schedule campaign for future dispatch. |
| `CSV Quick Import` | File Upload | `.csv` file format | Upload recipient rows directly. |

#### Outputs:
| Output Name | Visual UI / Server Response | Effect / Mutation |
| :--- | :--- | :--- |
| `Realtime Progress Bar` | Animated percentage bar (0% to 100%). | Reflects live broadcast status. |
| `Metrics Counters` | Cards showing Total, Sent, Failed, Pending counts. | Updates `CampaignDoc` counters in DB. |
| `Activity Log Feed` | Live scrollable log list. | Creates log entries in `activity_logs`. |
| `Outbound Messages` | Direct WhatsApp messages sent to recipients. | Writes messages to `messages` DB. |

---

### Module 3: Automated Message Schedule & Alarm (`id: "birthday"`)

#### Inputs:
| Field Name | Control Type | Format / Validation | Purpose |
| :--- | :--- | :--- | :--- |
| `Automation Status` | Toggle Switch | Boolean (`true` / `false`) | Enable or disable automated daily morning sweep. |
| `Automated Execution Hour` | Dropdown Select | `06`, `07`, `08`, `09`, `10`, `11`, `12` | Hour of day when alarm cron sweep executes. |
| `Dynamic Template` | Text Area | Supports `{name}`, `{city}` tags | Greeting message text dispatched on dates. |
| `Registry Search Filter` | Text Input | String search query | Filter registry table by name, phone, or date. |
| `Run Sweep Now` | Button Click | N/A | Manually force an immediate alarm sweep. |

#### Outputs:
| Output Name | Visual UI / Server Response | Effect / Mutation |
| :--- | :--- | :--- |
| `Sweep Status Notice` | Success banner showing matched contacts count. | Updates `lastCheckedDate` in DB. |
| `Birthday Registry Table` | Table listing contacts with registered date fields. | Displays contacts from imported groups. |
| `Automated Messages` | WhatsApp messages sent to matching contacts. | Creates records in `messages` collection. |

---

### Module 4: WhatsApp 6-Digit OTP Verification

#### Inputs:
| Field Name | Control Type | Format / Validation | Purpose |
| :--- | :--- | :--- | :--- |
| `Mobile Phone Number` | Text Input | E.164 format (e.g. `+919876543210`) | Target WhatsApp number to verify. |
| `6-Digit OTP Code` | Text Input | 6 numeric digits (e.g. `482910`) | Verification code sent to user. |
| `Send OTP Button` | Button Click | N/A | Trigger OTP generation and dispatch. |
| `Verify OTP Button` | Button Click | N/A | Validate 6-digit OTP code. |

#### Outputs:
| Output Name | Visual UI / Server Response | Effect / Mutation |
| :--- | :--- | :--- |
| `OTP WhatsApp Message` | WhatsApp message sent containing 6-digit code. | Writes OTP message to `messages` DB. |
| `Verification Badge` | Green `Verified` checkmark next to phone number. | Sets `isWhatsappVerified = true` in DB. |

---

### Module 5: Rule-Based Auto Replies (`id: "auto_reply"`)

#### Inputs:
| Field Name | Control Type | Format / Validation | Purpose |
| :--- | :--- | :--- | :--- |
| `Trigger Keyword` | Text Input | Non-empty string (e.g., *PRICE*) | Keyword string to match incoming messages. |
| `Match Type` | Dropdown Select | `exact` or `contains` | Rule matching logic. |
| `Reply Text` | Text Area | Multi-line template text | Response text sent automatically. |
| `Active Toggle` | Checkbox | Boolean (`true` / `false`) | Rule activation state. |

#### Outputs:
| Output Name | Visual UI / Server Response | Effect / Mutation |
| :--- | :--- | :--- |
| `Rules List Table` | Table displaying active keyword rules. | Writes rule to `auto_reply_rules` DB. |
| `Automated Outbound Reply` | Instant reply message sent to incoming sender. | Saves outbound record to `messages` DB. |

---

### Module 6: Billing & Plans (`id: "billing"`)

#### Inputs:
| Field Name | Control Type | Format / Validation | Purpose |
| :--- | :--- | :--- | :--- |
| `Plan Selection` | Radio Button | `basic`, `premium`, `business` | Choose desired subscription tier. |
| `Billing Cycle` | Tab Toggle | `daily`, `weekly`, `monthly`, `annual` | Select payment cycle interval. |
| `Promo Code Input` | Text Input | Case-insensitive string | Enter discount promo code. |
| `Apply Code Button` | Button Click | N/A | Calculate discount on checkout amount. |
| `Pay Now Button` | Button Click | N/A | Launch Razorpay checkout overlay. |

#### Outputs:
| Output Name | Visual UI / Server Response | Effect / Mutation |
| :--- | :--- | :--- |
| `Razorpay Checkout Modal` | Official Razorpay payment popup UI. | Opens secure payment interface. |
| `Payment Verification` | Order success notification & invoice. | Updates user plan in `users` DB & writes to `transactions`. |
