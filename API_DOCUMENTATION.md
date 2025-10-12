# WhatsApp CRM Bot - API Documentation

## Base URL
```
http://localhost:3000
```

## Authentication
Currently, all endpoints are open. In production, implement JWT authentication for admin access.

---

## Health Check

### Check API Status
```http
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "service": "WhatsApp CRM Bot"
}
```

---

## Conversations

### List All Conversations
```http
GET /api/conversations
```

**Response:**
```json
[
  {
    "id": "uuid",
    "contactId": "uuid",
    "status": "active",
    "assignedAgentId": "uuid",
    "lastMessageAt": "2025-10-12T10:30:00Z",
    "createdAt": "2025-10-12T09:00:00Z",
    "updatedAt": "2025-10-12T10:30:00Z"
  }
]
```

### Get Conversation Messages
```http
GET /api/conversations/:id/messages
```

**Response:**
```json
[
  {
    "id": "uuid",
    "conversationId": "uuid",
    "content": "Hello, I need help",
    "messageType": "text",
    "direction": "inbound",
    "sender": "1234567890",
    "timestamp": "2025-10-12T10:30:00Z"
  }
]
```

### Send Manual Message
```http
POST /api/conversations/:id/messages
Content-Type: application/json

{
  "content": "Thanks for reaching out! How can I help?",
  "sender": "agent_name"
}
```

### Escalate Conversation
```http
POST /api/conversations/:id/escalate
Content-Type: application/json

{
  "reason": "Customer needs technical support",
  "agentId": "uuid"
}
```

### Resolve Conversation
```http
POST /api/conversations/:id/resolve
```

---

## Settings

### Get All Settings
```http
GET /api/settings
GET /api/settings?category=bot_control
```

**Response:**
```json
[
  {
    "id": "uuid",
    "key": "bot_enabled",
    "value": "true",
    "category": "bot_control",
    "description": "Enable/disable the WhatsApp bot globally",
    "isSecret": false,
    "createdAt": "2025-10-12T09:00:00Z",
    "updatedAt": "2025-10-12T10:00:00Z"
  }
]
```

### Update Setting
```http
PUT /api/settings/:key
Content-Type: application/json

{
  "value": "new_value"
}
```

**Example - Set OpenAI Key:**
```http
PUT /api/settings/openai_api_key
Content-Type: application/json

{
  "value": "sk-proj-xxxxx"
}
```

### Toggle Bot On/Off
```http
POST /api/settings/bot/toggle
Content-Type: application/json

{
  "enabled": false
}
```

**Response:**
```json
{
  "success": true,
  "enabled": false
}
```

### WhatsApp Connection Status
```http
GET /api/settings/whatsapp/status
```

**Response:**
```json
{
  "connected": true
}
```

---

## Customer Analytics

### Get Customer Analytics
```http
GET /api/contacts/:id/analytics
```

**Response:**
```json
{
  "id": "uuid",
  "contactId": "uuid",
  "sentimentScore": 0.75,
  "upsellPotential": "high",
  "keywords": {
    "premium": 5,
    "upgrade": 3,
    "features": 4
  },
  "totalAppointments": 3,
  "lastAppointmentAt": "2025-10-10T14:00:00Z",
  "totalMessages": 45,
  "avgResponseTime": 120,
  "createdAt": "2025-10-01T09:00:00Z",
  "updatedAt": "2025-10-12T10:30:00Z"
}
```

### Refresh Analytics
```http
POST /api/contacts/:id/analytics/refresh
```

**Response:** Same as Get Customer Analytics

---

## Conversation Takeover

### Start Takeover
```http
POST /api/conversations/:id/takeover
Content-Type: application/json

{
  "agentId": "uuid",
  "type": "pause_bot",
  "notes": "Customer requested human agent"
}
```

**Takeover Types:**
- `pause_bot` - Bot completely paused, agent takes full control
- `write_between` - Agent can write, bot continues to respond
- `full_control` - Agent owns conversation, bot silent

### End Takeover
```http
POST /api/conversations/:id/takeover/end
```

### Get Takeover Status
```http
GET /api/conversations/:id/takeover/status
```

**Response:**
```json
{
  "takeover": {
    "id": "uuid",
    "conversationId": "uuid",
    "agentId": "uuid",
    "takeoverType": "pause_bot",
    "isActive": true,
    "startedAt": "2025-10-12T10:30:00Z",
    "endedAt": null,
    "notes": "Customer requested human agent"
  }
}
```

---

## Marketing

### Filter Contacts
```http
POST /api/marketing/filter
Content-Type: application/json

{
  "lastInteractionDays": 30,
  "appointmentStatus": "no_appointment",
  "sentimentScore": {
    "min": 0.5,
    "max": 1
  },
  "upsellPotential": ["high", "medium"]
}
```

**Filter Options:**
- `lastInteractionDays` (number) - Customers inactive for X days
- `appointmentStatus` (string) - `upcoming`, `past_x_days`, `no_appointment`
- `pastDaysCount` (number) - Used with `past_x_days`
- `sentimentScore` (object) - `{ min: -1, max: 1 }`
- `upsellPotential` (array) - `["low", "medium", "high"]`

**Response:**
```json
{
  "contacts": [...],
  "count": 42
}
```

### Create Campaign
```http
POST /api/marketing/campaigns
Content-Type: application/json

{
  "name": "Re-engagement Campaign",
  "messageTemplate": "Hi {{name}}, we haven't heard from you in a while...",
  "filterCriteria": {
    "lastInteractionDays": 30,
    "appointmentStatus": "no_appointment"
  },
  "scheduledAt": "2025-10-15T09:00:00Z",
  "createdBy": "agent_uuid"
}
```

### List Campaigns
```http
GET /api/marketing/campaigns
```

**Response:**
```json
[
  {
    "id": "uuid",
    "name": "Re-engagement Campaign",
    "messageTemplate": "Hi {{name}}...",
    "filterCriteria": {...},
    "scheduledAt": "2025-10-15T09:00:00Z",
    "status": "scheduled",
    "totalRecipients": 42,
    "totalSent": 0,
    "createdBy": "uuid",
    "createdAt": "2025-10-12T10:00:00Z"
  }
]
```

---

## Prompts

### List Prompts
```http
GET /api/prompts
```

**Response:**
```json
[
  {
    "id": "uuid",
    "name": "Default Customer Service Bot",
    "systemPrompt": "You are a helpful...",
    "businessContext": "Company info...",
    "temperature": 0.7,
    "model": "gpt-4o",
    "isActive": true,
    "createdAt": "2025-10-12T09:00:00Z",
    "updatedAt": "2025-10-12T10:00:00Z"
  }
]
```

### Create Prompt
```http
POST /api/prompts
Content-Type: application/json

{
  "name": "Sales Bot",
  "systemPrompt": "You are a sales assistant...",
  "businessContext": "Our products are...",
  "temperature": 0.8,
  "model": "gpt-4o"
}
```

### Activate Prompt
```http
PUT /api/prompts/:id/activate
```

---

## Bookings

### List Bookings
```http
GET /api/bookings
```

**Response:**
```json
[
  {
    "id": "uuid",
    "conversationId": "uuid",
    "contactId": "uuid",
    "calendarEventId": "google_event_id",
    "title": "Sales Consultation",
    "startTime": "2025-10-15T14:00:00Z",
    "endTime": "2025-10-15T15:00:00Z",
    "status": "confirmed",
    "metadata": {},
    "createdAt": "2025-10-12T10:00:00Z"
  }
]
```

### Cancel Booking
```http
POST /api/bookings/:id/cancel
```

---

## WhatsApp QR Code

### Get QR Code
```http
GET /api/whatsapp/qr
```

**Response:**
```json
{
  "message": "QR code endpoint - to be implemented"
}
```

---

## Error Responses

All endpoints return errors in this format:

```json
{
  "error": "Error message description"
}
```

**Common HTTP Status Codes:**
- `200` - Success
- `400` - Bad Request
- `404` - Not Found
- `500` - Internal Server Error

---

## Setting Keys Reference

### Bot Control
- `bot_enabled` - `true`/`false`
- `reply_mode` - `voice`, `voice-on-voice`, `text`
- `whatsapp_connected` - `true`/`false`

### Integrations
- `openai_api_key` - `sk-proj-xxxxx`
- `calendar_provider` - `google`, `outlook`, `caldav`
- `calendar_ical_url` - iCal URL or API endpoint
- `deepgram_api_key` - Optional voice transcription
- `elevenlabs_api_key` - Optional text-to-speech
- `elevenlabs_voice_id` - Voice ID for TTS

---

## Webhooks (Future)

Planned webhook endpoints for real-time events:
- Message received
- Conversation escalated
- Booking created/cancelled
- Campaign sent

---

## Rate Limiting (Future)

Not currently implemented. Production should include:
- Rate limiting per IP
- API key authentication
- Request throttling
