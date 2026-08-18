const crypto = require("crypto");

function encode(value) {
  return encodeURIComponent(value)
    .replace(/!/g, "%21")
    .replace(/'/g, "%27")
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29")
    .replace(/\*/g, "%2A");
}

function isAuthorized(req) {
  const expectedSecret = process.env.LEA_READ_SECRET;
  const authorization = req.headers.authorization || "";
  const prefix = "Bearer ";

  if (!expectedSecret || !authorization.startsWith(prefix)) {
    return false;
  }

  const provided = Buffer.from(authorization.slice(prefix.length));
  const expected = Buffer.from(expectedSecret);

  return (
    provided.length === expected.length &&
    crypto.timingSafeEqual(provided, expected)
  );
}

function oauthHeader(method, url, query = {}) {
  const oauth = {
    oauth_consumer_key: process.env.X_CONSUMER_KEY,
    oauth_nonce: crypto.randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: process.env.X_ACCESS_TOKEN,
    oauth_version: "1.0",
  };

  const params = { ...query, ...oauth };

  const parameterString = Object.keys(params)
    .sort()
    .map((key) => `${encode(key)}=${encode(params[key])}`)
    .join("&");

  const baseString =
    `${method}&${encode(url)}&${encode(parameterString)}`;

  const signingKey =
    `${encode(process.env.X_CONSUMER_SECRET)}&` +
    `${encode(process.env.X_ACCESS_TOKEN_SECRET)}`;

  oauth.oauth_signature = crypto
    .createHmac("sha1", signingKey)
    .update(baseString)
    .digest("base64");

  return (
    "OAuth " +
    Object.keys(oauth)
      .sort()
      .map((key) => `${encode(key)}="${encode(oauth[key])}"`)
      .join(", ")
  );
}

module.exports = async (req, res) => {
  try {
    if (!isAuthorized(req)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const username = "LeaBecoming";

    // 1. Find Lea's X user ID
    const userUrl =
      `https://api.x.com/2/users/by/username/${username}`;

    const userResponse = await fetch(userUrl, {
      headers: {
        Authorization: oauthHeader("GET", userUrl),
      },
    });

    const user = await userResponse.json();

    if (!userResponse.ok) {
      return res.status(userResponse.status).json(user);
    }

    const userId = user.data.id;

    // 2. Read Lea's home timeline
    const timelineUrl =
      `https://api.x.com/2/users/${userId}/timelines/reverse_chronological`;

    const query = {
      max_results: "20",
      "tweet.fields": "created_at,author_id,conversation_id",
      expansions: "author_id",
      "user.fields": "name,username",
    };

    const qs = new URLSearchParams(query).toString();

    const timelineResponse = await fetch(`${timelineUrl}?${qs}`, {
      headers: {
        Authorization: oauthHeader("GET", timelineUrl, query),
      },
    });

    const timeline = await timelineResponse.json();

    return res.status(timelineResponse.status).json(timeline);
  } catch (error) {
    return res.status(500).json({
      error: "Lea could not read X",
      message: error.message,
    });
  }
};
