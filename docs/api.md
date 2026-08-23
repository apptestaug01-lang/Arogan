# API Documentation

## Base URL
`/api`

## Authentication Endpoints

### POST /api/auth/signup
Register a new user.

**Request Body:**
```json
{
  "fullName": "John Doe",
  "email": "john@example.com",
  "mobile": "9876543210",
  "countryCode": "+91",
  "password": "Str0ng!Pass",
  "confirmPassword": "Str0ng!Pass",
  "role": "BORROWER"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Account created successfully",
  "data": {
    "user": {
      "id": "clx...",
      "fullName": "John Doe",
      "email": "john@example.com",
      "mobile": "9876543210",
      "countryCode": "+91",
      "role": "BORROWER",
      "emailVerified": false,
      "isActive": true
    }
  }
}
```

### POST /api/auth/login/password
Login with email/mobile and password.

**Request Body:**
```json
{
  "identifier": "john@example.com",
  "password": "Str0ng!Pass"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "accessToken": "...",
    "refreshToken": "..."
  }
}
```

### POST /api/auth/login/otp/request
Request an OTP for login.

**Request Body:**
```json
{
  "identifier": "john@example.com",
  "channel": "email"
}
```

### POST /api/auth/login/otp/verify
Verify OTP and complete login.

**Request Body:**
```json
{
  "identifier": "john@example.com",
  "code": "123456"
}
```

### POST /api/auth/refresh
Refresh access token using refresh token.

### POST /api/auth/logout
Logout (requires authentication).

### GET /api/auth/me
Get current user profile (requires authentication).

### GET /health
Health check endpoint.
