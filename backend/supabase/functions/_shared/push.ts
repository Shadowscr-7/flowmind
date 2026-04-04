// Shared helper to send FCM push notifications via Firebase HTTP v1 API
// Uses a service account key stored as FIREBASE_SERVICE_ACCOUNT_JSON env var

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

interface ServiceAccountKey {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
}

// Cache the access token
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  // Check cache
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60000) {
    return cachedToken.token;
  }

  const serviceAccountJson = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON");
  if (!serviceAccountJson) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON not configured");
  }

  const sa: ServiceAccountKey = JSON.parse(serviceAccountJson);

  // Create JWT
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: sa.token_uri,
    iat: now,
    exp: now + 3600,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signInput = `${encodedHeader}.${encodedPayload}`;

  // Sign with RSA-SHA256
  const privateKey = await importPrivateKey(sa.private_key);
  const signature = await sign(signInput, privateKey);
  const jwt = `${signInput}.${signature}`;

  // Exchange JWT for access token
  const response = await fetch(sa.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  if (!response.ok) {
    throw new Error(`Token exchange failed: ${await response.text()}`);
  }

  const tokenData = await response.json();
  cachedToken = {
    token: tokenData.access_token,
    expiresAt: Date.now() + tokenData.expires_in * 1000,
  };

  return cachedToken.token;
}

function base64UrlEncode(str: string): string {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const base64 = btoa(String.fromCharCode(...data));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlEncodeBytes(bytes: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...bytes));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const pemContents = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\n/g, "");

  const binaryDer = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

  return await crypto.subtle.importKey(
    "pkcs8",
    binaryDer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

async function sign(input: string, key: CryptoKey): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const signatureBuffer = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    data
  );
  return base64UrlEncodeBytes(new Uint8Array(signatureBuffer));
}

/// Send a push notification to a specific FCM token
export async function sendPush(
  fcmToken: string,
  payload: PushPayload
): Promise<boolean> {
  try {
    const accessToken = await getAccessToken();

    const serviceAccountJson = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON");
    const sa: ServiceAccountKey = JSON.parse(serviceAccountJson ?? "{}");

    const url = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`;

    const message: Record<string, unknown> = {
      message: {
        token: fcmToken,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: payload.data ?? {},
        android: {
          priority: "high",
          notification: {
            channel_id: "flowmind_push",
            sound: "default",
          },
        },
        apns: {
          payload: {
            aps: {
              alert: {
                title: payload.title,
                body: payload.body,
              },
              sound: "default",
              badge: 1,
            },
          },
        },
      },
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error(`FCM send error: ${err}`);
      return false;
    }

    return true;
  } catch (error) {
    console.error(`sendPush error: ${error}`);
    return false;
  }
}

/// Send push to a user by looking up their FCM token in profiles
export async function sendPushToUser(
  supabase: any,
  userId: string,
  payload: PushPayload
): Promise<boolean> {
  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("fcm_token")
      .eq("id", userId)
      .single();

    if (!profile?.fcm_token) {
      console.log(`No FCM token for user ${userId}`);
      return false;
    }

    // Also store as in-app notification
    await supabase.from("notifications").insert({
      user_id: userId,
      type: payload.data?.type ?? "system",
      title: payload.title,
      body: payload.body,
      data: payload.data ?? {},
      is_read: false,
    });

    return await sendPush(profile.fcm_token, payload);
  } catch (error) {
    console.error(`sendPushToUser error: ${error}`);
    return false;
  }
}
