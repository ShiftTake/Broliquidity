

const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();
const db = admin.firestore();

const { askGemini } = require('./gemini');
const { getQuote, searchSymbol, getCompanyProfile, getCompanyNews } = require('./finnhub');
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

// Finance notification for new comment on a post
exports.notifyOnNewComment = functions.firestore
  .document("posts/{postId}/comments/{commentId}")
  .onCreate(async (snap, context) => {
    const comment = snap.data();
    const postId = context.params.postId;
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
  });

// Finance notification for bullish/bearish vote
exports.notifyOnVote = functions.firestore
  .document("posts/{postId}")
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const postId = context.params.postId;
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
  });
