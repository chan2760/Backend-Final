# Backend-Final

Next.js backend API for the library borrow system.

## Source Code
Main backend code is under:
- `src/app/api`
- `src/lib`

## Environment Variables
Create `.env.local` from `.env.example` and set real values.

Required variables:
- `MONGODB_URI`
- `MONGODB_DB`
- `MONGODB_USER_COLLECTION`
- `MONGODB_BOOK_COLLECTION`
- `MONGODB_BORROW_COLLECTION`
- `ADMIN_SETUP_PASS`
- `JWT_SECRET`
- `CORS_ORIGIN` (your deployed frontend URL)

## Local Development
1. Install dependencies:
   ```bash
   npm install
   ```
2. Create local env file:
   ```bash
   cp .env.example .env.local
   ```
3. Start dev server:
   ```bash
   npm run dev
   ```

API runs on `http://localhost:3000` by default.

## Build and Start
```bash
npm run build
npm run start
```

## Deploy (Render/Railway/Fly/Any Node Host)
- Build command: `npm install && npm run build`
- Start command: `npm run start`
- Set all environment variables from `.env.example`

## Deploy (Docker)
```bash
docker build -t backend-final .
docker run -d -p 3000:3000 --name backend-final backend-final
```

## Post-Deploy Setup
Optional index setup endpoint:
```bash
GET /admin/initial?pass=<ADMIN_SETUP_PASS>
```
