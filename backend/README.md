# Instagram Media Downloader API

A production-ready, secure, and scalable Node.js backend for resolving public Instagram media URLs.

## Project Structure

```text
backend/
├── server.js                     # Application entry point
├── package.json                  # Dependencies & scripts
├── config/
│   └── app.js                    # Centralized environment variables
├── routes/
│   └── download.js               # API route definitions
├── controllers/
│   └── downloadController.js     # Request/Response handling
├── services/
│   └── instagramService.js       # Abstracted media retrieval logic
├── middleware/
│   ├── errorHandler.js           # Global error formatting
│   ├── validateUrl.js            # Input validation & regex checks
│   └── rateLimiter.js            # DDoS protection (express-rate-limit)
└── utils/
    ├── response.js               # Standardized JSON formats
    └── logger.js                 # Custom console logging
```

## Installation

1. Navigate to the `backend` directory.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create an environment variables file:
   ```bash
   cp .env.example .env
   ```
4. Adjust `.env` as needed (e.g., configuring `CORS_ORIGIN`).

## Running the Server

**Development Mode** (auto-restarts on file changes):
```bash
npm run dev
```

**Production Mode**:
```bash
npm start
```

## API Documentation

### Get Media Details

Resolves a public Instagram URL into downloadable assets.

*   **URL:** `/api/download`
*   **Method:** `POST`
*   **Content-Type:** `application/json`

#### Request Body
```json
{
  "url": "https://www.instagram.com/reel/Cxg12345678/"
}
```

#### Success Response
*   **Code:** 200 OK
*   **Content:**
```json
{
  "success": true,
  "title": "Example Instagram Content",
  "type": "reel",
  "thumbnail": "https://example.com/assets/mock-thumbnail.jpg",
  "duration": "0:15",
  "quality": "HD",
  "downloadUrl": "https://example.com/downloads/mock-video.mp4",
  "author": "Public User",
  "username": "public_user",
  "timestamp": "2023-10-25T10:00:00.000Z",
  "filesize": "4.2 MB"
}
```
