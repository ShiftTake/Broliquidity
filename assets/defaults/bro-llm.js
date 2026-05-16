// bro-llm.js
// Handles chat UI and Gemini API integration for Bro LLM


// Try to get Gemini API key from window or fallback
const GEMINI_API_KEY = window.GEMINI_API_KEY || "AIzaSyBXMdogkBz-B_Poo7-ZDGH2XsSRj4qPXCE";
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=" + GEMINI_API_KEY;

const chatForm = document.getElementById('chat-form');
const userInput = document.getElementById('user-input');
const messagesDiv = document.getElementById('messages');

function appendMessage(sender, text) {
    const msg = document.createElement('div');
    msg.className = sender;
    msg.textContent = text;
    messagesDiv.appendChild(msg);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const userText = userInput.value.trim();
    if (!userText) return;
    appendMessage('user', userText);
    userInput.value = '';
    appendMessage('llm', '...');
    try {
        const response = await fetch(GEMINI_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: userText }] }]
            })
        });
        const data = await response.json();
        const llmText = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response.';
        messagesDiv.lastChild.textContent = llmText;
    } catch (err) {
        messagesDiv.lastChild.textContent = 'Error: ' + err.message;
    }
});
