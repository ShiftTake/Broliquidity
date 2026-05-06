const fetch = require('node-fetch');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyBXMdogkBz-B_Poo7-ZDGH2XsSRj4qPXCE';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=' + GEMINI_API_KEY;

async function askGemini(prompt) {
  const body = {
    contents: [{ parts: [{ text: prompt }] }]
  };
  const res = await fetch(GEMINI_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error('Gemini API error');
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response from Gemini.';
}

module.exports = { askGemini };