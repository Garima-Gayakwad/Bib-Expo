
# Bib-Expo (bibweb)
### *A High-Performance Event Management System for Bib & Kit Collection*

Bib-Expo is a sophisticated management platform designed to streamline participant registration, bib distribution, and kit collection for large-scale athletic events. Built with a modern full-stack architecture, it provides real-time tracking, role-based access control, and comprehensive logging for organizers and volunteers.

---

## ✨ Key Features

- **🛡️ Advanced Role-Based Access Control (RBAC):** Hierarchical access for `ADMIN`, `SUPER_ORGANIZER`, `ORGANIZER`, and `VOLUNTEER` roles.
- **📋 Participant Lifecycle Management:** Complete tracking of collection status (`Pending`, `Collected`, `Collected_By_Behalf`).
- **👕 Smart Inventory Tracking:** Manage T-shirt sizes, goodies, and bib distribution with automated timestamping.
- **🚀 Bulk & Team Operations:** Support for bulk team collection and specialized logging for group registrations.
- **📱 On-Spot & Digital Integration:** Support for on-spot QR code registration and Excel-based participant imports.
- **🔍 Audit Trails & Logging:** Detailed logs for kit collection, bulk actions, and administrative reverts to ensure data integrity.
- **📧 Automated Notifications:** Integrated email service for participant verification and status updates.

---

## 🛠 Tech Stack

### **Frontend & Framework**
- **Next.js 15 (Canary/Latest):** High-performance React framework.
- **React 19:** Utilizing the latest concurrent rendering features.
- **Tailwind CSS 4:** Utility-first CSS with the latest `@tailwindcss/postcss`.
- **Lucide React:** Beautiful, consistent iconography.

### **Backend & Database**
- **Prisma ORM:** Type-safe database client and migrations.
- **PostgreSQL:** Robust relational database for mission-critical data.
- **Supabase:** Integrated for backend-as-a-service capabilities.

### **Utilities**
- **Zod:** Schema-based validation for API safety.
- **Papaparse & XLSX:** Advanced Excel/CSV processing for participant data.
- **Jose & Jsonwebtoken:** Secure JWT-based authentication.

---

## 🚀 Getting Started

### **Prerequisites**
- **Node.js:** Latest LTS version.
- **PostgreSQL:** Local installation or cloud instance (e.g., Supabase/Neon).

### **Installation**
1. **Clone the repository:**
   ```bash
   git clone <your-repo-url>
   cd Bib-Expo
   ```
2. **Install dependencies:**
   ```bash
   npm install
   ```

### **Environment Setup**
Create a `.env` file in the root directory and configure your database URL. Note that if your password contains special characters like `@`, you must URL-encode them (e.g., `@` becomes `%40`).

```env
DATABASE_URL="postgresql://USERNAME:PASSWORD@HOST:PORT/bibweb"
```

### **Database Configuration**
Initialize your database schema and seed initial data:

```bash
# Generate Prisma client
npm run db:generate

# Run migrations to setup tables
npm run db:migrate

# Seed initial admin and event data
npm run db:seed
```

---

## 🗃 Database Architecture


The system utilizes a relational schema optimized for high-concurrency event environments:
- **`ExpoEvent`**: The core entity managing specific race dates and T-shirt inventory.
- **`Participant`**: Tracks bib numbers, personal details, and specific collection metrics (`bibCollected`, `tshirtCollected`, `goodiesCollected`).
- **`Volunteer`**: Dedicated table for staff management with unique counter assignments.
- **Logs**: Specialized tables (`KitCollectionLog`, `BulkTeamCollectionLog`) ensure every item handed out is auditable.

---

## 📜 Available Scripts

| Script | Description |
| :--- | :--- |
| `npm run dev` | Starts the development server with hot-reloading. |
| `npm run build` | Generates the Prisma client and builds the production application. |
| `npm run start` | Runs the compiled production server. |
| `npm run lint` | Performs static code analysis using ESLint. |
| `npm run db:push` | Syncs schema changes directly to the DB without creating migrations. |
| `npm run db:reset`| Resets the database and reapplies all migrations. |

---

## 🔧 Troubleshooting

### **Authentication Issues (Error P1000)**
If you encounter a `P1000` error, verify your `DATABASE_URL` credentials match your pgAdmin settings exactly:
1. **Host:** Usually `localhost`.
2. **Port:** Usually `5432`.
3. **User:** Usually `postgres`.
4. **Password:** Ensure it matches your PostgreSQL instance.

---

## 📄 License
This project is private and intended for internal use only.

***

*Created with ❤️ for seamless race day experiences.*
