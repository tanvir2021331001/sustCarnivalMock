const express = require("express");
const app = express();

app.use(express.json());

app.get("/health", (req, res) => {
  res.json({
    status: "ok"
  });
});

app.post("/sort-ticket", (req, res) => {
  const {
    ticket_id,
    message = ""
  } = req.body;

  const text = message.toLowerCase();

  let case_type = "other";
  let severity = "low";
  let department = "customer_support";
  let confidence = 0.6;

 
  if (
    text.includes("wrong number") ||
    text.includes("wrong recipient") ||
    text.includes("sent") && text.includes("wrong")
  ) {
    case_type = "wrong_transfer";
    severity = "high";
    department = "dispute_resolution";
    confidence = 0.9;
  }


  else if (
    text.includes("payment failed") ||
    text.includes("balance deducted") ||
    text.includes("transaction failed")
  ) {
    case_type = "payment_failed";
    severity = "high";
    department = "payments_ops";
    confidence = 0.9;
  }


  else if (
    text.includes("refund") ||
    text.includes("money back")
  ) {
    case_type = "refund_request";
    severity = "low";
    department = "customer_support";
    confidence = 0.85;
  }


  else if (
    text.includes("otp") ||
    text.includes("pin") ||
    text.includes("password") ||
    text.includes("scam") ||
    text.includes("called asking")
  ) {
    case_type = "phishing_or_social_engineering";
    severity = "critical";
    department = "fraud_risk";
    confidence = 0.98;
  }

  const human_review_required =
    severity === "critical" ||
    case_type === "phishing_or_social_engineering";

  const agent_summary =
    message.length > 120
      ? message.slice(0, 120) + "..."
      : message;

  res.json({
    ticket_id,
    case_type,
    severity,
    department,
    agent_summary,
    human_review_required,
    confidence
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});