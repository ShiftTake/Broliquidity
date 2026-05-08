// broai.js
// Handles Bro LLM chat logic and Gemini API integration for feed.html

let geminiApiKey = null;

export function setGeminiApiKey(key) {
  geminiApiKey = key;
}

export async function askBroLLM(prompt) {
  if (!geminiApiKey) throw new Error('Gemini API key not set');
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=' + encodeURIComponent(geminiApiKey);
  const body = {
    contents: [{ parts: [{ text: prompt }] }]
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error('Gemini API error: ' + res.status);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response.';
}

// Usage in feed.html:
// import { setGeminiApiKey, askBroLLM } from './broai.js';
// setGeminiApiKey('YOUR_GEMINI_API_KEY');
// const answer = await askBroLLM('Your prompt here');
