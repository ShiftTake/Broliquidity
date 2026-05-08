import React, { useState, useRef } from 'react';
import { askBroLLM, setGeminiApiKey } from './broai';

const DEFAULT_API_KEY = 'AIzaSyBXMdogkBz-B_Poo7-ZDGH2XsSRj4qPXCE';

function BroLLMChat() {
  const [messages, setMessages] = useState([
    { sender: 'bro', text: 'Hey bro! Ask me anything about finance, markets, or life.' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const chatRef = useRef(null);

  React.useEffect(() => {
    setGeminiApiKey(DEFAULT_API_KEY);
  }, []);

  React.useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    setMessages((msgs) => [...msgs, { sender: 'user', text: input }]);
    setLoading(true);
    setInput('');
    try {
      const answer = await askBroLLM(input);
      setMessages((msgs) => [...msgs, { sender: 'bro', text: answer }]);
    } catch (err) {
      setMessages((msgs) => [...msgs, { sender: 'bro', text: 'Error: ' + (err.message || 'Unknown error') }]);
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] py-8 px-2">
      <div className="w-full max-w-xl bg-white dark:bg-[#181a20] rounded-3xl shadow-xl p-6 flex flex-col h-[70vh]">
        <h2 className="text-2xl font-black mb-2 flex items-center gap-2">Bro <span className="text-xs font-bold text-broblue">(LLM)</span></h2>
        <div ref={chatRef} className="flex-1 overflow-y-auto mb-4 p-2 bg-slate-50 dark:bg-white/5 rounded-2xl">
          {messages.map((msg, i) => (
            <div key={i} className={`mb-2 flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`px-4 py-2 rounded-2xl max-w-[80%] ${msg.sender === 'user' ? 'bg-broblue text-white' : 'bg-brogreen text-black'}`}>
                <span className="font-bold mr-2">{msg.sender === 'user' ? 'You:' : 'Bro:'}</span> {msg.text}
              </div>
            </div>
          ))}
          {loading && (
            <div className="mb-2 flex justify-start">
              <div className="px-4 py-2 rounded-2xl bg-brogreen text-black max-w-[80%]">
                <span className="font-bold mr-2">Bro:</span> <span className="italic text-slate-500">Thinking...</span>
              </div>
            </div>
          )}
        </div>
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            className="flex-1 px-4 py-3 rounded-2xl bg-white dark:bg-white/8 border border-slate-200 dark:border-white/10 outline-none text-sm font-semibold"
            placeholder="Ask Bro anything..."
            autoComplete="off"
            value={input}
            onChange={e => setInput(e.target.value)}
            disabled={loading}
          />
          <button type="submit" className="px-4 py-3 rounded-2xl bg-broblue text-white font-black" disabled={loading || !input.trim()}>Send</button>
        </form>
      </div>
    </div>
  );
}

export default BroLLMChat;
