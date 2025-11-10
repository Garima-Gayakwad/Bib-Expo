# Database Setup

## Fix P1000: Authentication failed

The error means your `DATABASE_URL` in `.env` has wrong credentials. Use the **same username and password** you use in pgAdmin.

### Step 1: Get your connection details from pgAdmin

1. In pgAdmin, **right-click** your server (e.g. "PostgreSQL 18") → **Properties**
2. Open the **Connection** tab
3. Note:
   - **Host name/address** (e.g. `localhost`)
   - **Port** (e.g. `5432`)
   - **Username** (e.g. `postgres`)
   - **Password** (the one you use to connect)

### Step 2: Update `.env`

Edit `.env` and set:

```
DATABASE_URL="postgresql://USERNAME:PASSWORD@HOST:PORT/bibweb"
```

Replace:
- `USERNAME` → your PostgreSQL username (often `postgres`)
- `PASSWORD` → your PostgreSQL password
- `HOST` → usually `localhost`
- `PORT` → usually `5432`

**Examples:**
- Password is `admin123`: `DATABASE_URL="postgresql://postgres:admin123@localhost:5432/bibweb"`
- No password: `DATABASE_URL="postgresql://postgres@localhost:5432/bibweb"`
- Password has `@`: use `%40` instead (e.g. `pass@word` → `pass%40word`)

### Step 3: Run migration

```bash
npm run db:migrate
```

Or to sync schema without migrations:

```bash
npm run db:push
```
