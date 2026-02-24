import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.static(__dirname));

const PORT = process.env.PORT || 3000;

// Health check
app.get("/", (_req, res) => res.send("IVF Copilot server is running"));

app.post("/api/answer", async (req, res) => {
  try {
    const { user_state, dpt, question } = req.body || {};
    if (!question || typeof question !== "string") {
      return res.status(400).json({ error: "question is required" });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Missing OPENAI_API_KEY env var" });
    }

    const systemPrompt = `You are an IVF support assistant for people who had embryo transfer.
You must:
- Answer in Korean.
- Use the provided DPT (days past transfer) and embryo_day context.
- Never diagnose or claim certainty.
- Provide balanced, anxiety-reducing guidance.
- If there are red flags (severe pain, heavy bleeding, fever, fainting, severe one-sided pain, shortness of breath), advise contacting a clinic/ER.

Output must follow exactly this format with headings:

[한 줄 요약]
...

[지금 시점에 흔한 범위]
- ...

[병원에 문의해야 하는 경우]
- ...

[오늘 할 수 있는 행동(안전한 범위)]
- ...

[주의]
의료 조언이 아닙니다. 증상이 심하거나 불안하면 병원에 문의하세요.`;

    const userPayload = {
      user_state: user_state || {},
      dpt,
      question,
    };

    // Call OpenAI Responses API
    const resp = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `User context JSON:\n${JSON.stringify(userPayload, null, 2)}` },
        ],
      }),
    });

    const data = await resp.json();

    if (!resp.ok) {
 console.error("OpenAI API error status:", resp.status);
  console.error("OpenAI API error body:", JSON.stringify(data, null, 2));
      return res.status(resp.status).json({ error: data });
    }

    // Extract text safely
    const text =
      data.output_text ??
      (Array.isArray(data.output)
        ? data.output
            .flatMap((o) => o.content || [])
            .map((c) => c.text)
            .filter(Boolean)
            .join("\n")
        : "");

    res.json({ answer: text || "답변을 생성하지 못했어요. 질문을 조금 더 구체적으로 적어주세요." });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});