const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();
const db = admin.firestore();

const { askGemini } = require('./gemini');
const { getQuote, searchSymbol, getCompanyProfile, getCompanyNews, getCandles } = require('./finnhub');
// Finnhub: Get company profile
exports.companyProfile = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  try {
    const symbol = req.body.symbol || req.query.symbol;
    if (!symbol) return res.status(400).json({ error: 'Missing symbol' });
    const data = await getCompanyProfile(symbol);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message || 'Finnhub error' });
  }
});

// Finnhub: Get company news
exports.companyNews = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  try {
    const symbol = req.body.symbol || req.query.symbol;
    if (!symbol) return res.status(400).json({ error: 'Missing symbol' });
    const data = await getCompanyNews(symbol);
    res.json({ articles: data });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Finnhub error' });
  }
});

// Finnhub: Get real-time quote
exports.getQuote = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  try {
    const symbol = req.body.symbol || req.query.symbol;
    if (!symbol) return res.status(400).json({ error: 'Missing symbol' });
    const data = await getQuote(symbol);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message || 'Finnhub error' });
  }
});

exports.getCandles = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  try {
    const symbol = req.body.symbol || req.query.symbol;
    const resolution = req.body.resolution || req.query.resolution || 'D';
    const from = req.body.from || req.query.from;
    const to = req.body.to || req.query.to;
    if (!symbol || !from || !to) return res.status(400).json({ error: 'Missing candle params' });
    const data = await getCandles(symbol, resolution, from, to);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message || 'Finnhub error' });
  }
});

// Finnhub: Search for symbols
exports.searchSymbol = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  try {
    const query = req.body.query || req.query.query;
    if (!query) return res.status(400).json({ error: 'Missing query' });
    const data = await searchSymbol(query);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message || 'Finnhub error' });
  }
});

// Bro LLM Gemini API proxy
exports.broLLM = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  try {
    const prompt = req.body.prompt || req.query.prompt;
    if (!prompt) return res.status(400).json({ error: 'Missing prompt' });
    const answer = await askGemini(prompt);
    res.json({ answer });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Gemini error' });
  }
});

// Finance notification for new comment on a post (v2 API)
exports.notifyOnNewComment = functions.firestore.onDocumentCreated(
  "posts/{postId}/comments/{commentId}",
  async (event) => {
    const comment = event.data.data();
    const postId = event.params.postId;
    const postRef = db.collection("posts").doc(postId);
    const postSnap = await postRef.get();
    if (!postSnap.exists) return null;
    const post = postSnap.data();
    // Don't notify self
    if (comment.author === post.author) return null;
    await db.collection("notifications").add({
      recipient: post.author,
      type: "comment",
      message: `New comment on your post: "${comment.text.slice(0, 60)}"`,
      postId,
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return null;
  }
);

// Finance notification for bullish/bearish vote (v2 API)
exports.notifyOnVote = functions.firestore.onDocumentUpdated(
  "posts/{postId}",
  async (event) => {
    const before = event.data.before.data();
    const after = event.data.after.data();
    const postId = event.params.postId;
    // Only notify if vote count changed
    if ((before.bullish !== after.bullish) || (before.bearish !== after.bearish)) {
      // Don't notify if author is missing
      if (!after.author) return null;
      if (before.bullish !== after.bullish) {
        await db.collection("notifications").add({
          recipient: after.author,
          type: "bullish",
          message: "Your post received a new Bullish vote!",
          postId,
          read: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
      if (before.bearish !== after.bearish) {
        await db.collection("notifications").add({
          recipient: after.author,
          type: "bearish",
          message: "Your post received a new Bearish vote!",
          postId,
          read: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
    }
    return null;
  }
);

// --- Next.js SSR Handler for Firebase Hosting with Express static serving ---
const path = require('path');
const next = require('next');
const express = require('express');

const nextApp = next({
  dev: false,
  conf: { distDir: path.join('..', 'frontend', '.next') }
});
const handle = nextApp.getRequestHandler();

const server = express();
// Serve Next.js static files
server.use('/_next', express.static(path.join(__dirname, '../frontend/.next', 'static')));
server.use('/static', express.static(path.join(__dirname, '../frontend/static')));
server.use('/public', express.static(path.join(__dirname, '../frontend/public')));
server.use('/mainlogo.png', express.static(path.join(__dirname, '../frontend/public/mainlogo.png')));

server.use((req, res) => {
  return nextApp.prepare().then(() => handle(req, res));
});

exports.nextjsFunc = functions.https.onRequest(server);
// --- End Next.js SSR Handler ---

