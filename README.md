# Tenant Backend

Node.js/Express backend for the Haven Tenant Management System.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables:
   - Copy `.env.example` to `.env`
   - Fill in your MongoDB Atlas credentials:
     ```
     DB_USERNAME=your_mongodb_username
     DB_PASSWORD=your_mongodb_password
     DB_CLUSTER=your_cluster.mongodb.net
     DB_NAME=haven
     PORT=5000
     ```

3. MongoDB Atlas Setup:
   - Create a free cluster at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
   - Create a database user with read/write permissions
   - Whitelist your IP address (or use 0.0.0.0/0 for development)
   - Get your connection string from the "Connect" button

4. Start the development server:
```bash
npm run dev
```

The server will run on http://localhost:5000

## API Endpoints

### Tenants
- `GET /api/tenants` - Get all tenants (supports `?search=query` parameter)
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
- `GET /api/stats` - Get dashboard statistics including:
  - Total tenants
  - Paid/unpaid counts for current month
  - Payment completion percentage
  - Pending problems count

## Database

MongoDB Atlas is used for data storage. The connection string is configured in the `.env` file.
