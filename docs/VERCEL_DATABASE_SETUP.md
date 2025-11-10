# Vercel & database setup

## Default admin login (after seed)

If you ran `npx prisma db seed`, the Super Admin was created with:

- **Phone:** `9987688443` (or the value of `ADMIN_PHONE` in your env when you ran seed)
- **Password:** `admin123` (or the value of `ADMIN_PASSWORD` in your env when you ran seed)

Use these on the **Admin Login** page. If you get "Invalid credentials", double-check the phone number (must match the `phone` column in the `Volunteer` table in Supabase) and that you’re using the correct password.

---

## "Can't reach database server" when running `npx prisma db seed`

If you see:

```
Can't reach database server at db.xxxxx.supabase.co
```

your `.env` is using Supabase's **direct** connection URL (`db.xxx.supabase.co`, port 5432). That host is often unreachable from your local machine.

**Fix:** Use the **Transaction pooler** URL in `.env` for `DATABASE_URL`:

1. Supabase Dashboard → **Settings** → **Database**.
2. Under **Connection string**, open **URI**.
3. Choose the **Transaction** (pooler) tab — host like `aws-0-[region].pooler.supabase.com`, **port 6543**.
4. Copy that URI, replace `[YOUR-PASSWORD]` with your database password, set as `DATABASE_URL` in `.env`.
5. Run again: `npx prisma db seed`.

Use the same pooler URL in Vercel (see below).

---

# Fix "Database temporarily unavailable" (503) on Vercel

The 503 error means your app on Vercel cannot connect to the database. Fix it by setting **`DATABASE_URL`** correctly in Vercel.

---

## If you use **Supabase**

### 1. Get the connection string

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project.
2. Go to **Settings** → **Database**.
3. Under **Connection string**, choose **URI**.
4. **Important:** Use the **Transaction** (pooler) connection string, not the **Session** (direct) one.
   - It uses **port 6543** (pooler), not 5432 (direct).
   - Direct connections (5432) can hit connection limits on Vercel serverless.
5. Copy the URI and replace `[YOUR-PASSWORD]` with your database password.
   - Example format:
     ```
     postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
     ```

### 2. Optional: Vercel + Supabase workaround

If you still get connection errors, add this query parameter to the end of the URI:

```
?pgbouncer=true
```

So the full URL looks like:

```
postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true
```

### 3. Add it to Vercel

1. Open [Vercel Dashboard](https://vercel.com) → your project.
2. Go to **Settings** → **Environment Variables**.
3. Add:
   - **Name:** `DATABASE_URL`
   - **Value:** the full connection string (with password, no `[YOUR-PASSWORD]`).
   - **Environment:** Production (and Preview if you want).
4. Save.

### 4. Redeploy

- Go to **Deployments** → open the **⋯** on the latest deployment → **Redeploy**.
- Or push a new commit so Vercel deploys again.

After redeploy, try logging in again.

---

## If you use another **PostgreSQL** host

1. Get the PostgreSQL connection URI from your provider (e.g. Neon, Railway, Render).
2. For **serverless** (Vercel), prefer a **pooled** or **serverless** connection string if the provider offers one.
3. Add it in Vercel as **`DATABASE_URL`** (Settings → Environment Variables).
4. Redeploy.

---

## Checklist

- [ ] `DATABASE_URL` is set in Vercel (Settings → Environment Variables).
- [ ] For Supabase: you use the **Transaction pooler** URL (port **6543**), not the direct URL (5432).
- [ ] The password in the URL is correct and has no special characters that break the URI (if it has `@`, `#`, etc., they must be [percent-encoded](https://en.wikipedia.org/wiki/Percent-encoding)).
- [ ] You redeployed **after** adding or changing `DATABASE_URL`.

---

## Still 503?

1. In Vercel, open **Logs** (or **Functions**) and try to log in again. Look for a line like `Login DB error:` or `Login error:` — the message after that is the real failure.
2. Check Supabase **Settings → Database** for any **Restrictions** or **Paused project**.
3. Confirm the database is running and that migrations have been applied (e.g. run `npx prisma migrate deploy` locally with the same `DATABASE_URL` to be sure).
