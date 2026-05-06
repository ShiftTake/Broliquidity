const fetch = require('node-fetch');

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY || 'd7tp871r01qlbd3l169gd7tp871r01qlbd3l16a0';
const BASE_URL = 'https://finnhub.io/api/v1';

async function getQuote(symbol) {
  const url = `${BASE_URL}/quote?symbol=${encodeURIComponent(symbol)}&token=${FINNHUB_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Finnhub quote error');
  return await res.json();
}

async function searchSymbol(query) {
  const url = `${BASE_URL}/search?q=${encodeURIComponent(query)}&token=${FINNHUB_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Finnhub search error');
  return await res.json();
}

module.exports = { getQuote, searchSymbol };