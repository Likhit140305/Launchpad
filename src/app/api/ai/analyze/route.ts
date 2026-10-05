import { NextRequest } from "next/server";
import { HttpError, json, requireAdmin, route } from "@/lib/http";

export const POST = route(async (req: NextRequest) => {
  requireAdmin(req);
  const data = await req.json();

  if (!process.env.GEMINI_API_KEY) {
    throw new HttpError(400, "GEMINI_API_KEY is missing. Please configure it to use the Growth Copilot.");
  }

  const prompt = `You are an expert growth marketer. Analyze the provided campaign data and generate actionable recommendations.
The goal is to reach the target registrations.
Format your response exactly using these markdown headings:
### Campaign Status
### Forecast
### Biggest Opportunity
### Recommended Action
### Suggested Experiment
### Expected Impact

Keep your response concise. Do not invent metrics or claim experiments were run when they weren't.

Campaign Data:
${JSON.stringify(data, null, 2)}`;

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2 },
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new HttpError(500, `AI API Error: ${err.error?.message || response.statusText}`);
  }

  const result = await response.json();
  const analysis = result.candidates?.[0]?.content?.parts?.[0]?.text;
  
  if (!analysis) {
    throw new HttpError(500, "Received empty response from AI API.");
  }

  return json({ analysis });
});
