# Tenant Backend

Node.js/Express backend for the Haven Tenant Management System.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Environment variables are already configured in `.env`:
- MongoDB connection details
- Server port (5000)

3. Start the development server:
```bash
npm run dev
```

The server will run on http://localhost:5000

## API Endpoints

### Tenants
- `GET /api/tenants` - Get all tenants
- `POST /api/tenants` - Create a new tenant

### Payments
- `GET /api/payments` - Get all payments
- `POST /api/payments` - Create a new payment

### Problems
- `GET /api/problems` - Get all problems
- `POST /api/problems` - Create a new problem

### Problem Fixes
- `GET /api/problem-fixes` - Get all problem fixes
- `POST /api/problem-fixes` - Create a new problem fix

### Dashboard
- `GET /api/stats` - Get dashboard statistics

## Database

MongoDB Atlas is used for data storage. The connection string is configured in the `.env` file.
