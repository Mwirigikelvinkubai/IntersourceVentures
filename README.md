# Intersource Ventures – M-Pesa Daraja Setup Guide

## What you have

```
intersource-server/
├── server.js          ← Express backend (Daraja API logic)
├── .env               ← Your credentials (NEVER share this file)
├── package.json       ← Node.js dependencies
├── README.md          ← This file
└── public/
    └── index.html     ← The full website (served by the server)
```

---

## PART 1 – Install & run locally (sandbox testing)

### Step 1 – Install Node.js
If you don't have Node.js installed:
1. Go to https://nodejs.org
2. Download and install the **LTS** version
3. Verify: open Terminal and run `node -v` — you should see a version number

### Step 2 – Install dependencies
Open Terminal, navigate to this folder, and run:
```bash
cd intersource-server
npm install
```

### Step 3 – Install ngrok (so Safaricom can reach your localhost)
Safaricom's servers need to send payment confirmations to your computer.
ngrok creates a public tunnel to your localhost.

1. Go to https://ngrok.com and create a free account
2. Download ngrok for your OS
3. Copy your authtoken from the ngrok dashboard
4. Run: `ngrok config add-authtoken YOUR_TOKEN_HERE`

### Step 4 – Start ngrok tunnel
In a **new Terminal window** (keep it open):
```bash
ngrok http 3000
```
You will see output like:
```
Forwarding   https://abc123.ngrok-free.app → http://localhost:3000
```
Copy that `https://abc123.ngrok-free.app` URL.

### Step 5 – Update your .env with the ngrok URL
Open `.env` and update this line:
```
CALLBACK_URL=https://abc123.ngrok-free.app/api/mpesa/callback
```
Replace `abc123.ngrok-free.app` with your actual ngrok URL.
⚠️  ngrok gives you a new URL every time you restart it. Update .env each time.

### Step 6 – Start the server
```bash
npm run dev
```
You should see:
```
╔══════════════════════════════════════════════╗
║   Intersource Ventures – Server started      ║
╠══════════════════════════════════════════════╣
║  URL   : http://localhost:3000               ║
║  Mode  : sandbox                             ║
║  Paybill: 174379                             ║
╚══════════════════════════════════════════════╝
```

### Step 7 – Open the website
Go to: http://localhost:3000

---

## PART 2 – Testing with sandbox

### Test phone numbers (use these, NOT real numbers)
The Safaricom sandbox has test numbers you can use:
- **254708374149** (will succeed)
- **254700000000** (will fail — for testing error flow)

### How to test the full flow:
1. Add products to cart
2. Click "Pay with M-Pesa"
3. Enter: `0708374149`
4. Click "Send payment prompt"
5. Watch the server Terminal — you will see the callback arrive
6. The website will show "Payment received!" automatically

### Check server health:
Open: http://localhost:3000/api/health

---

## PART 3 – Create your Daraja account & go LIVE

### Step 1 – Register on the Daraja portal
1. Go to https://developer.safaricom.co.ke
2. Click "Sign Up" and create an account
3. Verify your email

### Step 2 – Create an app
1. Log in → click "My Apps" → "Add New App"
2. Name it: "Intersource Ventures"
3. Tick: **Lipa Na M-Pesa** (this enables STK Push)
4. Click Create App

### Step 3 – Get your credentials
On your app page you will see:
- **Consumer Key** — copy this
- **Consumer Secret** — copy this

### Step 4 – Get your Live Passkey
1. On the portal, go to **My Apps** → your app → **Go Live**
2. Follow the steps (they may ask for business documents)
3. Once approved, go to **Lipa na M-Pesa** → your shortcode settings
4. You will find your **Passkey** there

### Step 5 – Update .env for production
```env
MPESA_ENV=production

CONSUMER_KEY=your_live_consumer_key
CONSUMER_SECRET=your_live_consumer_secret

SHORTCODE=400200
PASSKEY=your_live_passkey

CALLBACK_URL=https://your-live-domain.com/api/mpesa/callback
```

### Step 6 – Deploy to a live server
For production you need a server with a real domain (not ngrok).
Recommended options:
- **Railway** (railway.app) — free tier, simple deploy
- **Render** (render.com) — free tier, good for Node.js
- **DigitalOcean** — KES ~600/month, full control

---

## PART 4 – Production improvements (optional)

Replace the in-memory payment store with a real database:
```bash
npm install better-sqlite3
# or
npm install mongoose  # for MongoDB
```

Add order email notifications:
```bash
npm install nodemailer
```

---

## Quick reference

| What | Value |
|------|-------|
| Website | http://localhost:3000 |
| STK Push endpoint | POST http://localhost:3000/api/mpesa/stkpush |
| Callback endpoint | POST http://localhost:3000/api/mpesa/callback |
| Status polling | GET http://localhost:3000/api/mpesa/status/:id |
| Health check | GET http://localhost:3000/api/health |
| Sandbox Paybill | 174379 |
| Live Paybill | 400200 |
| Live Account | 37996 |
| Support | intersourceventureslimited@gmail.com |
| Phone | +254 710 658 549 |

---

## Need help?
Contact: intersourceventureslimited@gmail.com
Daraja docs: https://developer.safaricom.co.ke/docs
