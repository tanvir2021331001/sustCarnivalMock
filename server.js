require("dotenv").config();

const express = require("express");
const { GoogleGenAI } = require("@google/genai");

const app = express();
app.use(express.json());

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
  });
});

app.post("/sort-ticket", async (req, res) => {
  const { ticket_id, message = "" } = req.body;

  try {
    if (!ticket_id || !message) {
      return res.status(400).json({
        error: "ticket_id and message are required",
      });
    }

    const text = message.toLowerCase().trim();


    let case_type = null;
    let severity = null;
    let department = null;
    let confidence = null;

    if (
      text.includes("wrong number") ||
      text.includes("wrong recipient") ||
      (text.includes("sent") && text.includes("wrong"))
    ) {
      case_type = "wrong_transfer";
      severity = "high";
      department = "dispute_resolution";
      confidence = 0.95;
    } else if (
      text.includes("payment failed") ||
      text.includes("transaction failed") ||
      text.includes("balance deducted")
    ) {
      case_type = "payment_failed";
      severity = "high";
      department = "payments_ops";
      confidence = 0.95;
    } else if (
      text.includes("refund") ||
      text.includes("money back")
    ) {
      case_type = "refund_request";
      severity = "low";
      department = "customer_support";
      confidence = 0.90;
    } else if (
      text.includes("otp") ||
      text.includes("pin") ||
      text.includes("password") ||
      text.includes("scam") ||
      text.includes("called asking")
    ) {
      case_type = "phishing_or_social_engineering";
      severity = "critical";
      department = "fraud_risk";
      confidence = 0.99;
    }


    if (case_type !== null) {
      const human_review_required =
        severity === "critical" ||
        case_type === "phishing_or_social_engineering";

      const agent_summary =
        message.length > 120
          ? message.slice(0, 120) + "..."
          : message;

      return res.json({
        ticket_id,
        case_type,
        severity,
        department,
        agent_summary,
        human_review_required,
        confidence,
      });
    }

    // =====================
    // Gemini fallback
    // =====================
    try {
      const prompt = `
You classify customer support tickets for a digital finance company.

Return ONLY valid JSON.

{
  "case_type": "wrong_transfer | payment_failed | refund_request | phishing_or_social_engineering | other",
  "severity": "low | medium | high | critical",
  "department": "customer_support | dispute_resolution | payments_ops | fraud_risk",
  "agent_summary": "One neutral sentence summary.",
  "human_review_required": false,
  "confidence": 0.0
}

Rules:
- human_review_required must be true for critical severity or phishing cases.
- Never ask for PIN, OTP, password, or card number.

Customer message:
${message}
`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });

      let textResponse = response.text;


      textResponse = textResponse
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

      const result = JSON.parse(textResponse);

      const validCaseTypes = [
        "wrong_transfer",
        "payment_failed",
        "refund_request",
        "phishing_or_social_engineering",
        "other",
      ];

      const validSeverities = [
        "low",
        "medium",
        "high",
        "critical",
      ];

      const validDepartments = [
        "customer_support",
        "dispute_resolution",
        "payments_ops",
        "fraud_risk",
      ];

      if (!validCaseTypes.includes(result.case_type)) {
        result.case_type = "other";
      }

      if (!validSeverities.includes(result.severity)) {
        result.severity = "low";
      }

      if (!validDepartments.includes(result.department)) {
        result.department = "customer_support";
      }

      result.confidence =
        Number(result.confidence) || 0.5;

      result.human_review_required =
        result.severity === "critical" ||
        result.case_type ===
          "phishing_or_social_engineering";

      return res.json({
        ticket_id,
        ...result,
      });
    } catch (err) {
      console.error("Gemini Error:", err);

     
      return res.json({
        ticket_id,
        case_type: "other",
        severity: "low",
        department: "customer_support",
        agent_summary:
          message.length > 120
            ? message.slice(0, 120) + "..."
            : message,
        human_review_required: false,
        confidence: 0.5,
      });
    }
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      error: "Internal server error",
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(
    `Server running on http://localhost:${PORT}`
  );
});