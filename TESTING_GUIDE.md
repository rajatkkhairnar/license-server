# MicroLab Pro — Licensing System Testing Guide

> **Goal:** Validate the entire licensing system locally before deploying to Railway.  
> Follow these steps in order. Each section builds on the previous one.

---

## Table of Contents

1. [Prerequisites & Local Setup](#1-prerequisites--local-setup)
2. [Test 1: License Server API](#2-test-1-license-server-api)
3. [Test 2: Sign-Up Portal (Customer Flow)](#3-test-2-sign-up-portal-customer-flow)
4. [Test 3: Admin Portal](#4-test-3-admin-portal)
5. [Test 4: Electron App Integration](#5-test-4-electron-app-integration)
6. [Test 5: Soft-Lock Enforcement](#6-test-5-soft-lock-enforcement)
7. [Test 6: Full End-to-End Flow](#7-test-6-full-end-to-end-flow)
8. [Cleanup](#8-cleanup)

---

## 1. Prerequisites & Local Setup

### 1.1 Create PostgreSQL on Railway (Cloud DB)

We use Railway's PostgreSQL so the same database works for both testing and deployment.

**Step-by-step:**

1. Go to [railway.app](https://railway.app) and sign in (GitHub login is easiest)
2. Click **New Project** → **Provision PostgreSQL**
3. Wait ~10 seconds for the database to spin up
4. Click on the PostgreSQL service → go to the **Variables** tab
5. Find `DATABASE_URL` — click the copy icon

It looks like this:
```
postgresql://postgres:RANDOM_PASSWORD@HOSTNAME.railway.app:PORT/railway
```

> **💡 Tip:** Keep the Railway tab open. You'll come back to it for deployment later, and the data you create during testing will already be there.

### 1.2 Configure Environment Variables

Navigate to `license-server/` and create a `.env` file:

```powershell
cd c:\Users\tech9\Desktop\MicroLab_Portfolio\license-server
copy .env.example .env
```

Edit `.env` with your values:

```env
# Database — paste the Railway PostgreSQL URL you copied above
DATABASE_URL=postgresql://postgres:XXXXX@HOSTNAME.railway.app:PORT/railway

# Security — use any random strings for local testing
# (Keep these — you'll reuse them in Railway env vars during deployment)
SIGNING_SECRET=local-test-signing-secret-must-be-at-least-64-characters-long-here!!
API_KEY=local-test-api-key-32chars1234

# Admin credentials — whatever you want for local testing
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123

# Server
PORT=3000

# Email — for OTP testing, use your Gmail + App Password
# To get an App Password: Google Account → Security → 2-Step Verification → App Passwords
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-actual-email@gmail.com
SMTP_PASS=your-gmail-app-password
```

> **⚠️ Email Config:** If you don't have Gmail App Password set up, the OTP send will fail, but you can still test other parts. Check the server console for the OTP code — it gets logged even if the email fails to send.

### 1.3 Install Dependencies & Push Database Schema

```powershell
# Install server dependencies
cd c:\Users\tech9\Desktop\MicroLab_Portfolio\license-server
npm install

# Push Prisma schema to your Railway PostgreSQL (creates all tables remotely)
npm run db:push

# Generate Prisma client
npm run db:generate
```

You should see: `Your database is now in sync with your Prisma schema.`

> **✅ Verify:** You can run `npm run db:studio` to open Prisma Studio in your browser — it'll show the empty tables (Customer, License, Activation, OtpToken) connected to your Railway database.

### 1.4 Start the License Server

```powershell
npm run dev
```

You should see:

```
═══════════════════════════════════════════════════════
  🔬 MicroLab Pro License Server
  📡 Running on port 3000
  🕐 Started at ...
═══════════════════════════════════════════════════════
```

**Keep this terminal open** throughout all tests.

### 1.5 Start the Portal Dev Server (separate terminal)

```powershell
cd c:\Users\tech9\Desktop\MicroLab_Portfolio\license-server\portal
npm run dev
```

This starts the React portal at `http://localhost:5174`.

---

## 2. Test 1: License Server API

Test the raw API endpoints using `curl` in PowerShell (or use Postman/Thunder Client).

### 2.1 Health Check

```powershell
curl http://localhost:3000/admin/health
```

- [✔️] ✅ Returns `{"status":"healthy","uptime":...,"timestamp":"..."}`

> If this fails, your database connection is wrong. Check `DATABASE_URL` in `.env`.

### 2.2 Admin Login

```powershell
curl -X POST http://localhost:3000/admin/login `
  -H "Content-Type: application/json" `
  -d '{"username":"admin","password":"admin123"}'
```

- [ ] ✅ Returns `{"success":true,"token":"eyJ..."}`

**Save the token** — you'll need it for admin API calls below. Copy it to a variable:

```powershell
$TOKEN = "paste-your-token-here"
```

### 2.3 Dashboard Stats (empty DB)

```powershell
curl http://localhost:3000/admin/dashboard-stats `
  -H "Authorization: Bearer $TOKEN"
```

- [ ] ✅ Returns all zeros: `{"totalLicenses":0,"activeLicenses":0,...}`

### 2.4 Create License via Admin API

```powershell
curl -X POST http://localhost:3000/admin/licenses `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer $TOKEN" `
  -d '{"customerName":"Test Lab","customerEmail":"test@example.com","plan":"trial","durationDays":14,"maxActivations":1,"numRoles":2}'
```

- [ ] ✅ Returns `{"success":true,"licenseKey":"MLAB-XXXX-XXXX-XXXX",...}`
- [ ] ✅ Note the license key — you'll use it later

### 2.5 List Licenses

```powershell
curl "http://localhost:3000/admin/licenses" `
  -H "Authorization: Bearer $TOKEN"
```

- [ ] ✅ Returns the license you just created

### 2.6 License Activation (simulate Electron app)

```powershell
curl -X POST http://localhost:3000/api/license/activate `
  -H "Content-Type: application/json" `
  -H "X-API-Key: local-test-api-key-32chars1234" `
  -d '{"licenseKey":"MLAB-XXXX-XXXX-XXXX","machineId":"test-machine-001","machineLabel":"Test PC"}'
```

> Replace `MLAB-XXXX-XXXX-XXXX` with the actual key from step 2.4.

- [ ] ✅ Returns `{"success":true,"token":"eyJ...","plan":"trial","expiresAt":"...","numRoles":2}`

### 2.7 License Validation

```powershell
curl -X POST http://localhost:3000/api/license/validate `
  -H "Content-Type: application/json" `
  -H "X-API-Key: local-test-api-key-32chars1234" `
  -d '{"licenseKey":"MLAB-XXXX-XXXX-XXXX","machineId":"test-machine-001"}'
```

- [ ] ✅ Returns `{"valid":true,...}`

### 2.8 Second Activation Should Fail (maxActivations = 1)

```powershell
curl -X POST http://localhost:3000/api/license/activate `
  -H "Content-Type: application/json" `
  -H "X-API-Key: local-test-api-key-32chars1234" `
  -d '{"licenseKey":"MLAB-XXXX-XXXX-XXXX","machineId":"different-machine-999","machineLabel":"Other PC"}'
```

- [ ] ✅ Returns `400` with `"error":"Maximum activations reached..."` or similar

### 2.9 License Deactivation

```powershell
curl -X POST http://localhost:3000/api/license/deactivate `
  -H "Content-Type: application/json" `
  -H "X-API-Key: local-test-api-key-32chars1234" `
  -d '{"licenseKey":"MLAB-XXXX-XXXX-XXXX","machineId":"test-machine-001"}'
```

- [ ] ✅ Returns `{"success":true}`

### 2.10 API Key Auth Should Block Unauthorized Requests

```powershell
curl -X POST http://localhost:3000/api/license/activate `
  -H "Content-Type: application/json" `
  -d '{"licenseKey":"MLAB-XXXX-XXXX-XXXX","machineId":"test"}'
```

> Note: no `X-API-Key` header.

- [ ] ✅ Returns `401` or `403` — access denied

---

## 3. Test 2: Sign-Up Portal (Customer Flow)

Open `http://localhost:5174/signup` in your browser.

### 3.1 Page Loads

- [ ] ✅ Dark themed sign-up form appears with animated background
- [ ] ✅ Header shows "MicroLab Pro" with microscope icon
- [ ] ✅ Step indicator shows 2 dots (first active)

### 3.2 Form Validation

Try submitting with empty fields:
- [✔️] ✅ Shows "Lab name is required"

Try invalid email:
- [✔️] ✅ Shows "Please enter a valid email address"

Try password less than 8 chars:
- [✔️] ✅ Shows "Password must be at least 8 characters"

Try mismatched passwords:
- [✔️] ✅ Shows "Passwords do not match"

### 3.3 Password Strength Meter

Type in the password field:
- [✔️] ✅ `abc` → shows "Weak" (red bar)
- [✔️] ✅ `Abcdef12` → shows "Medium" (yellow bars)
- [✔️] ✅ `Abcdef1!` → shows "Strong" (green bars)

### 3.4 Submit Valid Form (OTP Request)

Fill all fields correctly:
- Lab Name: `Test Lab`
- Owner Name: `Dr. Test`
- Phone: `9876543210`
- Email: **use your real email** (to receive OTP)
- Password: `TestPass1!`
- Confirm Password: `TestPass1!`
- Roles: 2

Click **Continue →**

- [ ] ✅ Moves to Step 2 (OTP screen)
- [ ] ✅ Shows "We've sent a 6-digit code to te•••••@..."
- [ ] ✅ Check server console — OTP code should be logged
- [ ] ✅ Check your email — OTP should arrive (if SMTP is configured)
- [ ] ✅ 60-second resend countdown is visible

### 3.5 OTP Input UX

- [ ] ✅ 6 individual digit boxes appear
- [ ] ✅ Auto-focuses on first box
- [ ] ✅ Typing a digit auto-advances to next box
- [ ] ✅ Backspace on empty box goes back to previous
- [ ] ✅ Pasting a 6-digit code fills all boxes
- [ ] ✅ Filled boxes turn green border

### 3.6 OTP Verification

Enter the correct OTP (from email or server console):

- [ ] ✅ Click "Verify & Get License Key"
- [ ] ✅ Redirects to `/signup/success`
- [ ] ✅ Shows green checkmark animation
- [ ] ✅ Shows license key in large monospace text (e.g., `MLAB-XXXX-XXXX-XXXX`)
- [ ] ✅ Shows trial expiry date (14 days from now)
- [ ] ✅ Click the key box → copies to clipboard

### 3.7 Wrong OTP

Go back and try with wrong OTP (`000000`):
- [ ] ✅ Shows error "Verification failed"

### 3.8 Duplicate Email

Try signing up again with the same email:
- [ ] ✅ Shows error about email already being registered

---

## 4. Test 3: Admin Portal

Open `http://localhost:5174/admin/login` in your browser.

### 4.1 Admin Login

- [ ] ✅ Shows login form with purple/indigo theme
- [ ] ✅ Title: "Admin Portal — MicroLab Pro License Management"

Enter wrong credentials:
- [ ] ✅ Shows "Invalid admin credentials"

Enter correct credentials (`admin` / `admin123`):
- [ ] ✅ Redirects to dashboard

### 4.2 Dashboard Page

- [ ] ✅ Shows 4 KPI cards: Total Licenses, Active, Suspended, Customers
- [ ] ✅ Numbers reflect data from your earlier API tests
- [ ] ✅ Plan Distribution section shows bars
- [ ] ✅ Recent Activations feed shows entries
- [ ] ✅ Refresh button (top-right) reloads data

### 4.3 Licenses Page

Click **Licenses** in the sidebar:

- [ ] ✅ Table shows all licenses
- [ ] ✅ Each row shows: key, customer, plan pill, status badge, expiry, activations count
- [ ] ✅ Copy button next to key works
- [ ] ✅ Search bar filters by key/name/email (type to test)
- [ ] ✅ Plan dropdown filters (select "trial")
- [ ] ✅ Status dropdown filters

### 4.4 Create New License

Click **New License** button:

- [ ] ✅ Modal opens with form fields
- [ ] ✅ Fill: Name="Manual Key Test", Email="manual@test.com", Plan=monthly, Duration=30, Devices=1, Roles=2
- [ ] ✅ Click "Create License"
- [ ] ✅ Alert shows the new key
- [ ] ✅ License appears in the table

### 4.5 Edit License

Click the ✏️ edit icon on any license:

- [ ] ✅ Edit modal opens with current values
- [ ] ✅ Change status to "suspended"
- [ ] ✅ Change expiry date to a future date
- [ ] ✅ Click "Save Changes"
- [ ] ✅ Table updates with new status badge

### 4.6 View License Details

Click the 👁️ eye icon on any license:

- [ ] ✅ Detail modal opens
- [ ] ✅ Shows: key, customer, lab, plan, status, expiry, roles
- [ ] ✅ Shows activations section with machine IDs

### 4.7 Revoke an Activation (if any exist)

In the detail modal:
- [ ] ✅ Click the revoke button on an activation
- [ ] ✅ Confirm dialog appears
- [ ] ✅ After revoke: activation shows "Revoked" badge
- [ ] ✅ Activation count decrements

### 4.8 Delete License

Click the 🗑️ trash icon on a license with **0 activations**:
- [ ] ✅ Confirm dialog appears
- [ ] ✅ License is removed from table

Try deleting a license that has activations:
- [ ] ✅ Shows error: "Cannot delete — has X activation(s)"

### 4.9 Sign Out

Click **Sign Out** in sidebar:
- [ ] ✅ Redirected to login page
- [ ] ✅ Trying to visit `/admin/dashboard` directly redirects to login

---

## 5. Test 4: Electron App Integration

### 5.1 Setup

Before running the Electron app, make sure:

1. The license server is running (`npm run dev` in `license-server/`)
2. You have a valid license key (from sign-up or admin create)
3. The `.env` values in `license.cjs` match your server:

Check `electron/license.cjs` lines 34-36:

```js
const LICENSE_SERVER_URL = process.env.LICENSE_SERVER_URL || 'http://localhost:3000';
const API_KEY = process.env.LICENSE_API_KEY || 'dev-api-key-change-in-production';
const SIGNING_SECRET = process.env.LICENSE_SIGNING_SECRET || 'dev-signing-secret...';
```

**Important:** The `API_KEY` default in `license.cjs` must match the `API_KEY` in your `.env` file. If they don't match, activation will fail with a 401 error.

**Option A: Set env vars before running Electron:**

```powershell
$env:LICENSE_API_KEY = "local-test-api-key-32chars1234"
$env:LICENSE_SIGNING_SECRET = "local-test-signing-secret-must-be-at-least-64-characters-long-here!!"
$env:LICENSE_SERVER_URL = "http://localhost:3000"
```

**Option B: Temporarily edit the defaults in `license.cjs`** for local testing.

### 5.2 First Launch (No License)

```powershell
cd c:\Users\tech9\Desktop\MicroLab_Portfolio\MicroLab-Pro
npm run dev
```

- [ ] ✅ License activation window appears (not the main app)
- [ ] ✅ Shows input field for license key
- [ ] ✅ Shows "Activate" button

### 5.3 Activate with Valid Key

Paste a valid license key and click Activate:

- [ ] ✅ Success message appears
- [ ] ✅ License window closes
- [ ] ✅ Main app window opens with login screen
- [ ] ✅ `license.json` file is created in the project root (dev mode)

### 5.4 Activate with Invalid Key

Delete `license.json`, restart the app, and try:

Enter `MLAB-AAAA-BBBB-CCCC` (invalid key):
- [ ] ✅ Error message: "License key not found" or similar

### 5.5 Verify License Persists

Close the app and reopen:
- [ ] ✅ Skips the license window
- [ ] ✅ Goes directly to the main app (license is valid)

### 5.6 License Info in Settings

Log in as admin (owner), go to Settings → License tab:

- [ ] ✅ Shows the license key in monospace
- [ ] ✅ Shows plan type
- [ ] ✅ Shows expiry date
- [ ] ✅ Shows "Active" status badge (green)
- [ ] ✅ Copy button works

### 5.7 Deactivate from Settings

Click **Deactivate** → Click **Yes, Deactivate**:

- [ ] ✅ Alert confirms deactivation
- [ ] ✅ `license.json` is deleted
- [ ] ✅ App reloads/restarts showing the license activation window

---

## 6. Test 5: Soft-Lock Enforcement

### 6.1 Setup: Create an Expired License

From the admin portal (or curl), create or edit a license to expire **in the past**:

```powershell
# First create a license via admin portal and note its ID
# Then patch it to expire yesterday:

$YESTERDAY = (Get-Date).AddDays(-1).ToString("yyyy-MM-dd")

curl -X PATCH "http://localhost:3000/admin/licenses/LICENSE_ID_HERE" `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer $TOKEN" `
  -d "{`"expiresAt`":`"$YESTERDAY`"}"
```

Activate this expired license in the Electron app.

### 6.2 Login Page Behavior

- [ ] ✅ Login page shows an expiry notification dialog/overlay
- [ ] ✅ Message says subscription has expired
- [ ] ✅ Dialog can be dismissed (one-time per session)
- [ ] ✅ User can still log in

### 6.3 Soft-Lock: Lab Operations

Go to the Lab Operations page:

- [ ] ✅ "Book New Test" button is **disabled** (grayed out)
- [ ] ✅ Hovering shows tooltip like "License expired"
- [ ] ✅ Existing data is still **viewable** (read-only access works)
- [ ] ✅ "Enter Results" button is **disabled**

### 6.4 Soft-Lock: Patient Directory

Go to Patient Directory:

- [ ] ✅ "Add Patient" button is **disabled**
- [ ] ✅ "Edit" buttons are **disabled**
- [ ] ✅ "Delete" buttons are **disabled**
- [ ] ✅ Patient list is still viewable

### 6.5 Soft-Lock: Inventory

Go to Inventory:

- [ ] ✅ "New Item" button is **disabled**
- [ ] ✅ Stock update actions are **disabled**
- [ ] ✅ Edit/delete buttons are **disabled**
- [ ] ✅ Inventory list is still viewable

### 6.6 Renewal (Un-expire via Portal)

Go to admin portal → edit the license → change expiry to 30 days from now:

Then restart the Electron app (or wait for the next validation cycle):

- [ ] ✅ All buttons become enabled again
- [ ] ✅ Expiry dialog no longer appears
- [ ] ✅ Settings → License shows "Active" again

---

## 7. Test 6: Full End-to-End Flow

This is the **golden path** — how a real customer would use the system:

### Step 1: Customer Signs Up

1. Open `http://localhost:5174/signup`
2. Fill form → get OTP email → verify → get license key
3. **Write down the key**: `MLAB-____-____-____`

- [ ] ✅ Completed

### Step 2: Customer Activates Desktop App

1. Start MicroLab Pro Electron app
2. Paste the license key from Step 1
3. Click Activate

- [ ] ✅ App opens to login screen

### Step 3: Customer Uses the App

1. Log in as admin
2. Add a patient, book a test, check inventory

- [ ] ✅ All write operations work

### Step 4: Vendor Sees the Customer in Portal

1. Open admin portal → Dashboard
2. Check that totals updated
3. Go to Licenses → see the new key
4. Click the eye icon → see the activation

- [ ] ✅ Customer visible in portal

### Step 5: Trial Expires (Vendor Simulates)

1. In admin portal → Edit license → set expiry to yesterday
2. Restart Electron app

- [ ] ✅ Expiry dialog appears
- [ ] ✅ Write operations are disabled

### Step 6: Customer Pays → Vendor Extends

1. In admin portal → Edit license → set expiry to 1 year from now
2. Uncheck "Trial License"
3. Save changes
4. Restart Electron app

- [ ] ✅ App works normally again
- [ ] ✅ Settings → License shows updated expiry

### Step 7: Customer Moves to New PC (Deactivation)

1. Settings → License → Deactivate
2. App restarts showing license window
3. Re-activate with the same key

- [ ] ✅ Activation succeeds on same machine (slot freed)

---

## 8. Cleanup

After testing, clean up local resources:

```powershell
# Delete the local license file (if testing Electron)
del c:\Users\tech9\Desktop\MicroLab_Portfolio\MicroLab-Pro\license.json

# (Optional) Drop the test database
# In psql: DROP DATABASE microlab_licenses;

# Stop both servers (Ctrl+C in both terminals)
```

---

## Quick Troubleshooting

| Problem | Fix |
|---------|-----|
| `P1001: Can't reach database` | Check `DATABASE_URL` in `.env`. Is PostgreSQL running? |
| `401 Unauthorized` on license activate | `API_KEY` in `.env` doesn't match `license.cjs` default |
| OTP email not received | Check `SMTP_*` in `.env`. Look at server console for logged OTP |
| Portal page is blank | Run `npm run build:portal` and make sure `portal/dist/` exists |
| Admin portal 404 | Are you using `localhost:5174` (Vite dev) or `localhost:3000` (Express)? Use 5174 for dev |
| License activation fails with "server unreachable" | Is the license server running on port 3000? |
| Prisma errors | Run `npm run db:push` then `npm run db:generate` |
| `machineId` mismatch | Don't manually edit `license.json` |

---

> **✅ Once all checkboxes are green, you're ready for Phase 7: Railway Deployment.**
