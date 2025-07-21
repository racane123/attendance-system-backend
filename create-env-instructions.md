# Create .env file in backend directory

Create a file named `.env` in the `backend` directory with the following content:

```
DATABASE_URL=postgresql://postgres.lpdzazyqxblojtwemzfv:Vbeyq9c9C68tOgOs@aws-0-us-east-2.pooler.supabase.com:5432/postgres
JWT_SECRET=your-super-secret-jwt-key-here
PORT=5001
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
```

After creating this file:

1. Restart the backend server
2. Test the API endpoints
3. The frontend should work properly

The .env file is required for the backend to connect to Supabase database. 