import crypto from "crypto";

const COOKIE_NAME = "bl_manager_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;

const normalize = (v) => String(v || "").trim();

const sha256Hex = (value) => crypto.createHash("sha256").update(value).digest("hex");

const toBase64Url = (input) => Buffer.from(input).toString("base64url");
const fromBase64Url = (input) => Buffer.from(input, "base64url").toString("utf8");

const sign = (payload, secret) => crypto.createHmac("sha256", secret).update(payload).digest("base64url");

const makeSessionToken = ({ email, secret, exp }) => {
  const payload = JSON.stringify({ email, exp });
  const payloadB64 = toBase64Url(payload);
  const sig = sign(payloadB64, secret);
  return `${payloadB64}.${sig}`;
};

const parseCookies = (cookieHeader) => {
  const result = {};
  if (!cookieHeader) return result;
  cookieHeader.split(";").forEach((part) => {
    const [k, ...rest] = part.trim().split("=");
    if (!k) return;
    result[k] = rest.join("=");
  });
  return result;
};

const verifySessionToken = (token, secret) => {
  if (!token || !secret) return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [payloadB64, incomingSig] = parts;
  const expectedSig = sign(payloadB64, secret);
  try {
    const a = Buffer.from(incomingSig);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length) return false;
    if (!crypto.timingSafeEqual(a, b)) return false;
  } catch {
    return false;
  }

  try {
    const payload = JSON.parse(fromBase64Url(payloadB64));
    if (!payload?.exp || Number(payload.exp) < Date.now()) return false;
    return true;
  } catch {
    return false;
  }
};

const buildCookie = ({ token, maxAge = SESSION_MAX_AGE_SECONDS }) => {
  const isProd = process.env.NODE_ENV === "production";
  const secure = isProd ? "; Secure" : "";
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
};

const clearCookie = () => `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;

export default async function handler(req, res) {
  const managerEmail = normalize(process.env.MANAGER_LOGIN_EMAIL).toLowerCase();
  const managerHash = normalize(process.env.MANAGER_LOGIN_PASSWORD_HASH).toLowerCase();
  const managerSalt = normalize(process.env.MANAGER_LOGIN_PASSWORD_SALT);
  const sessionSecret = normalize(process.env.MANAGER_SESSION_SECRET);

  if (!managerEmail || !managerHash || !sessionSecret) {
    return res.status(503).json({ ok: false, message: "Manager auth is not configured." });
  }

  if (req.method === "GET") {
    const cookies = parseCookies(req.headers.cookie || "");
    const token = cookies[COOKIE_NAME] || "";
    const ok = verifySessionToken(token, sessionSecret);
    if (!ok) return res.status(401).json({ ok: false });
    return res.status(200).json({ ok: true });
  }

  if (req.method === "DELETE") {
    res.setHeader("Set-Cookie", clearCookie());
    return res.status(200).json({ ok: true });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, message: "Method not allowed" });
  }

  const email = normalize(req.body?.email).toLowerCase();
  const password = normalize(req.body?.password);
  if (!email || !password) {
    return res.status(400).json({ ok: false, message: "Missing credentials" });
  }

  const candidate = sha256Hex(managerSalt ? `${managerSalt}:${password}` : password).toLowerCase();
  if (email !== managerEmail || candidate !== managerHash) {
    return res.status(401).json({ ok: false, message: "Invalid credentials" });
  }

  const exp = Date.now() + (SESSION_MAX_AGE_SECONDS * 1000);
  const token = makeSessionToken({ email, secret: sessionSecret, exp });
  res.setHeader("Set-Cookie", buildCookie({ token }));
  return res.status(200).json({ ok: true });
}
