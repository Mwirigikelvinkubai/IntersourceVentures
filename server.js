/**
 * INTERSOURCE VENTURES LIMITED
 * M-Pesa Daraja STK Push – Express Backend
 * ─────────────────────────────────────────
 * Endpoints:
 *   POST /api/mpesa/stkpush   → initiates payment prompt on customer phone
 *   POST /api/mpesa/callback  → receives confirmation from Safaricom
 *   GET  /api/mpesa/status/:checkoutRequestId → polls payment status
 *   GET  /api/health          → server health check
 */

require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const path = require("path");

const app = express();
app.use(express.json());
app.use(cors()); // allow requests from the HTML frontend

// ── Serve the website HTML as the root ──────────────────────
app.use(express.static(path.join(__dirname, "public")));

// ── In-memory payment store (replace with a DB in production) ──
const payments = {};

// ── Daraja base URLs ─────────────────────────────────────────
const DARAJA_BASE =
  process.env.MPESA_ENV === "production"
    ? "https://api.safaricom.co.ke"
    : "https://sandbox.safaricom.co.ke";

// ─────────────────────────────────────────────────────────────
//  HELPER: Get OAuth access token from Safaricom
// ─────────────────────────────────────────────────────────────
async function getAccessToken() {
  const credentials = Buffer.from(
    `${process.env.CONSUMER_KEY}:${process.env.CONSUMER_SECRET}`
  ).toString("base64");

  const response = await axios.get(
    `${DARAJA_BASE}/oauth/v1/generate?grant_type=client_credentials`,
    {
      headers: {
        Authorization: `Basic ${credentials}`,
      },
    }
  );
  return response.data.access_token;
}

// ─────────────────────────────────────────────────────────────
//  HELPER: Generate Daraja password and timestamp
// ─────────────────────────────────────────────────────────────
function getDarajaPassword() {
  const timestamp = new Date()
    .toISOString()
    .replace(/[-T:.Z]/g, "")
    .slice(0, 14);
  const rawPassword = `${process.env.SHORTCODE}${process.env.PASSKEY}${timestamp}`;
  const password = Buffer.from(rawPassword).toString("base64");
  return { password, timestamp };
}

// ─────────────────────────────────────────────────────────────
//  HELPER: Format phone to 254XXXXXXXXX
// ─────────────────────────────────────────────────────────────
function formatPhone(phone) {
  const cleaned = String(phone).replace(/\s+/g, "").replace(/^\+/, "");
  if (cleaned.startsWith("0")) return "254" + cleaned.slice(1);
  if (cleaned.startsWith("254")) return cleaned;
  return "254" + cleaned;
}

// ─────────────────────────────────────────────────────────────
//  POST /api/mpesa/stkpush
//  Body: { phone: "0710658549", amount: 1400, orderId: "IV-123456" }
// ─────────────────────────────────────────────────────────────
app.post("/api/mpesa/stkpush", async (req, res) => {
  const { phone, amount, orderId } = req.body;

  if (!phone || !amount) {
    return res.status(400).json({ success: false, message: "Phone and amount are required." });
  }

  const formattedPhone = formatPhone(phone);
  if (!/^2547\d{8}$|^2541\d{8}$/.test(formattedPhone)) {
    return res.status(400).json({ success: false, message: "Invalid Kenyan phone number." });
  }

  if (amount < 1) {
    return res.status(400).json({ success: false, message: "Amount must be at least KES 1." });
  }

  try {
    const accessToken = await getAccessToken();
    const { password, timestamp } = getDarajaPassword();

    const payload = {
      BusinessShortCode: process.env.SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: Math.ceil(amount), // Daraja requires integer
      PartyA: formattedPhone,
      PartyB: process.env.SHORTCODE,
      PhoneNumber: formattedPhone,
      CallBackURL: process.env.CALLBACK_URL,
      AccountReference: process.env.ACCOUNT_REF,
      TransactionDesc: `${process.env.TRANSACTION_DESC} ${orderId || ""}`.trim(),
    };

    const response = await axios.post(
      `${DARAJA_BASE}/mpesa/stkpush/v1/processrequest`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    const { CheckoutRequestID, ResponseCode, ResponseDescription } = response.data;

    if (ResponseCode === "0") {
      // Store pending payment
      payments[CheckoutRequestID] = {
        status: "pending",
        phone: formattedPhone,
        amount,
        orderId: orderId || null,
        createdAt: new Date().toISOString(),
      };

      console.log(`[STK PUSH] Initiated → ${formattedPhone} KES ${amount} | ${CheckoutRequestID}`);

      return res.json({
        success: true,
        checkoutRequestId: CheckoutRequestID,
        message: "Payment prompt sent to phone.",
      });
    } else {
      console.error("[STK PUSH] Failed:", ResponseDescription);
      return res.status(500).json({ success: false, message: ResponseDescription });
    }
  } catch (err) {
    const errMsg = err.response?.data?.errorMessage || err.message || "Unknown error";
    console.error("[STK PUSH] Error:", errMsg);
    return res.status(500).json({ success: false, message: errMsg });
  }
});

// ─────────────────────────────────────────────────────────────
//  POST /api/mpesa/callback
//  Safaricom calls this URL after the customer pays or cancels
// ─────────────────────────────────────────────────────────────
app.post("/api/mpesa/callback", (req, res) => {
  const body = req.body?.Body?.stkCallback;

  if (!body) {
    console.warn("[CALLBACK] Received unexpected payload:", req.body);
    return res.json({ ResultCode: 0, ResultDesc: "Accepted" });
  }

  const { CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = body;

  console.log(`[CALLBACK] ${CheckoutRequestID} | ResultCode: ${ResultCode} | ${ResultDesc}`);

  if (ResultCode === 0) {
    // Payment successful – extract metadata
    const meta = {};
    (CallbackMetadata?.Item || []).forEach((item) => {
      meta[item.Name] = item.Value;
    });

    payments[CheckoutRequestID] = {
      status: "success",
      mpesaReceiptNumber: meta.MpesaReceiptNumber || null,
      amount: meta.Amount || null,
      phone: meta.PhoneNumber || null,
      transactionDate: meta.TransactionDate || null,
    };

    console.log(`[CALLBACK] PAID ✓ Receipt: ${meta.MpesaReceiptNumber} | KES ${meta.Amount}`);
  } else {
    // Payment cancelled or failed
    if (payments[CheckoutRequestID]) {
      payments[CheckoutRequestID].status = "failed";
      payments[CheckoutRequestID].reason = ResultDesc;
    } else {
      payments[CheckoutRequestID] = { status: "failed", reason: ResultDesc };
    }
    console.log(`[CALLBACK] FAILED ✗ ${ResultDesc}`);
  }

  // Always respond 200 to Safaricom
  return res.json({ ResultCode: 0, ResultDesc: "Accepted" });
});

// ─────────────────────────────────────────────────────────────
//  GET /api/mpesa/status/:checkoutRequestId
//  Frontend polls this every 3 seconds to check payment result
// ─────────────────────────────────────────────────────────────
app.get("/api/mpesa/status/:checkoutRequestId", (req, res) => {
  const { checkoutRequestId } = req.params;
  const payment = payments[checkoutRequestId];

  if (!payment) {
    return res.json({ status: "pending" }); // not yet received from Safaricom
  }

  return res.json(payment);
});

// ─────────────────────────────────────────────────────────────
//  GET /api/health
// ─────────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    environment: process.env.MPESA_ENV,
    shortcode: process.env.SHORTCODE,
    timestamp: new Date().toISOString(),
  });
});

// ─────────────────────────────────────────────────────────────
//  START SERVER
// ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n╔══════════════════════════════════════════════╗`);
  console.log(`║   Intersource Ventures – Server started      ║`);
  console.log(`╠══════════════════════════════════════════════╣`);
  console.log(`║  URL   : http://localhost:${PORT}               ║`);
  console.log(`║  Mode  : ${(process.env.MPESA_ENV || "sandbox").padEnd(35)}║`);
  console.log(`║  Paybill: ${(process.env.SHORTCODE || "").padEnd(34)}║`);
  console.log(`╚══════════════════════════════════════════════╝\n`);
  console.log(`  ⚠  REMEMBER: Update CALLBACK_URL in .env with your ngrok URL`);
  console.log(`  Run: npx ngrok http ${PORT}\n`);
});
