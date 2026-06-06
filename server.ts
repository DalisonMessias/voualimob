import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { createServer } from "http";
import { Server } from "socket.io";
import fs from "fs";
import { waManager } from "./src/server/whatsapp";
import admin from "firebase-admin";
import Groq from "groq-sdk";
import { supabase } from "./src/lib/supabase";

dotenv.config();

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

// Initialize Firebase Admin
const firebaseConfigPath = path.join(process.cwd(), "firebase-applet-config.json");
if (fs.existsSync(firebaseConfigPath)) {
  try {
    const config = JSON.parse(fs.readFileSync(firebaseConfigPath, "utf8"));
    if (!admin.apps.length) {
      admin.initializeApp({
        projectId: config.projectId,
        storageBucket: config.storageBucket,
      });
    }
  } catch (err) {
    console.error("Erro ao inicializar Firebase Admin:", err);
  }
}

const app = express();
const PORT = 3000;

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const connectedUsers = new Map<string, { userId: string; role: "client" | "driver" }>();
const activeRequests = new Map<string, any>();
const rideChats = new Map<string, any[]>();

// --- FCM PUSH NOTIFICATIONS SETUP ---
let subscriptions: { userId: string; token: string; platform: string }[] = [];
const SUB_FILE = path.join(process.cwd(), "push-subscriptions.json");

function loadSubscriptions() {
  if (fs.existsSync(SUB_FILE)) {
    try {
      subscriptions = JSON.parse(fs.readFileSync(SUB_FILE, "utf8"));
    } catch (e) {
      console.error("Erro ao carregar assinaturas de push:", e);
    }
  }
}

function saveSubscription(userId: string, token: string, platform: string = "web") {
  subscriptions = subscriptions.filter(s => s.token !== token);
  subscriptions.push({ userId, token, platform });
  try {
    fs.writeFileSync(SUB_FILE, JSON.stringify(subscriptions, null, 2), "utf8");
  } catch (err) {
    console.error("Erro ao salvar arquivo de assinatura push:", err);
  }
}

function deleteSubscription(token: string) {
  subscriptions = subscriptions.filter(s => s.token !== token);
  try {
    fs.writeFileSync(SUB_FILE, JSON.stringify(subscriptions, null, 2), "utf8");
  } catch (err) {
    console.error("Erro ao remover token FCM inválido:", err);
  }
}

loadSubscriptions();

async function sendPushNotification(userId: string, payload: { title: string; body: string; url?: string; type?: string; rideId?: string }) {
  console.log(`[FCM Push] Enviando para ${userId}:`, payload);
  const userSubs = subscriptions.filter(s => s.userId === userId);
  
  if (userSubs.length === 0) {
    console.log(`[FCM Push] Nenhum token registrado para o usuario ${userId}`);
    return;
  }

  for (const sub of userSubs) {
    try {
      const message: any = {
        token: sub.token,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: {
          url: payload.url || "/",
          type: payload.type || "generic",
          rideId: payload.rideId || "",
          title: payload.title,
          body: payload.body,
        },
        android: {
          priority: "high",
          notification: {
            sound: "default",
            clickAction: "FLUTTER_NOTIFICATION_CLICK", // for reference, but works for web too if handled
          }
        },
        webpush: {
          headers: {
            Urgency: "high",
          },
          notification: {
            icon: "https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=96&h=96&fit=crop",
            requireInteraction: payload.type === "new_ride",
          },
          data: {
            url: payload.url || "/",
            rideId: payload.rideId || "",
          }
        }
      };

      await admin.messaging().send(message);
      console.log(`[FCM Push] Sucesso para o token: ${sub.token.substring(0, 10)}...`);
    } catch (err: any) {
      console.error(`[FCM Push] Erro no envio para token ${sub.token.substring(0, 10)}...:`, err.code);
      // If token is invalid/not registered, cleanup
      if (err.code === "messaging/registration-token-not-registered" || err.code === "messaging/invalid-argument") {
        deleteSubscription(sub.token);
      }
    }
  }
}

io.on("connection", (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  socket.on("register", ({ userId, role }) => {
    connectedUsers.set(socket.id, { userId, role });
    socket.join(`user_${userId}`);
    console.log(`User registered: ${userId} as ${role}`);
  });

  socket.on("requestRide", (request) => {
    console.log("Ride requested:", request.id);
    activeRequests.set(request.id, request);
    rideChats.set(request.id, []);

    if (request.driverId) {
      io.to(`user_${request.driverId}`).emit("incomingRideRequest", request);
      // Send real push notification to the targeted driver
      sendPushNotification(request.driverId, {
        title: "🏍️ Nova Corrida para Você!",
        body: `Viagem solicitada de ${request.origemLabel || "sua localização"} para ${request.destinoLabel || "seu destino"}.`,
        url: "/"
      });
    } else {
      // Broadcast push notifications to all registered driver subscriptions
      subscriptions.forEach(sub => {
        if (sub.userId !== request.clientId) {
          sendPushNotification(sub.userId, {
            title: "⚡ Nova Corrida no Radar!",
            body: `Passageiro próximo solicita corrida de ${request.origemLabel || "Origem"} para ${request.destinoLabel || "Destino"}.`,
            url: "/"
          });
        }
      });
    }
    socket.join(`ride_${request.id}`);
  });

  socket.on("joinRide", ({ rideId, userId, role }) => {
    socket.join(`ride_${rideId}`);
    console.log(`User ${userId} [${role}] joined ride_${rideId}`);

    const existing = activeRequests.get(rideId);
    if (existing) {
      socket.emit("rideStateUpdate", existing);
    }

    const chat = rideChats.get(rideId) || [];
    socket.emit("chatHistory", chat);
  });

  socket.on("acceptRide", ({ rideId, driverId, driverName, driverPhone, driverCoords, veiculoPlaca, veiculoModelo }) => {
    const req = activeRequests.get(rideId);
    if (req) {
      req.status = "aceito";
      req.driverId = driverId;
      req.driverName = driverName;
      req.driverPhone = driverPhone;
      req.driverCoords = driverCoords;
      req.veiculoPlaca = veiculoPlaca;
      req.veiculoModelo = veiculoModelo;
      activeRequests.set(rideId, req);

      io.to(`ride_${rideId}`).emit("rideStateUpdate", req);
      io.to(`user_${req.clientId}`).emit("rideStateUpdate", req);

      // Notify the client that the driver accepted and is heading towards them
      sendPushNotification(req.clientId, {
        title: "🏍️ Piloto a Caminho!",
        body: `O condutor ${driverName} (${veiculoModelo} - ${veiculoPlaca}) aceitou sua corrida e já está se deslocando.`,
        url: "/"
      });
    }
  });

  socket.on("declineOrCancelRide", ({ rideId }) => {
    const req = activeRequests.get(rideId);
    if (req) {
      const prevStatus = req.status;
      req.status = "cancelado";
      activeRequests.set(rideId, req);
      io.to(`ride_${rideId}`).emit("rideStateUpdate", req);
      io.to(`user_${req.clientId}`).emit("rideCancelled", { rideId });
      
      // Notify client of cancellation
      sendPushNotification(req.clientId, {
        title: "⚠️ Corrida Cancelada",
        body: "Sua corrida foi cancelada.",
        url: "/"
      });

      if (req.driverId) {
        io.to(`user_${req.driverId}`).emit("rideCancelled", { rideId });
        // Notify driver of cancellation
        sendPushNotification(req.driverId, {
          title: "⚠️ Corrida Cancelada",
          body: "A corrida ativa foi cancelada pelo passageiro.",
          url: "/"
        });
      }
      activeRequests.delete(rideId);
    }
  });

  socket.on("updateRideStatus", ({ rideId, status, driverCoords }) => {
    const req = activeRequests.get(rideId);
    if (req) {
      req.status = status;
      if (driverCoords) {
        req.driverCoords = driverCoords;
      }
      activeRequests.set(rideId, req);
      io.to(`ride_${rideId}`).emit("rideStateUpdate", req);

      // Handle real-time push alerts on ride state changes
      if (status === "chegou") {
        sendPushNotification(req.clientId, {
          title: "📍 Seu Piloto Chegou!",
          body: `O condutor ${req.driverName || "Vouali"} chegou ao local de embarque. Pegue seu capacete e encontre-o!`,
          url: "/"
        });
      } else if (status === "em_andamento") {
        sendPushNotification(req.clientId, {
          title: "⚡ Corrida Iniciada!",
          body: `Viagem iniciada. Siga seu trajeto no mapa até ${req.destinoLabel || "o destino"}.`,
          url: "/"
        });
      } else if (status === "finalizado") {
        sendPushNotification(req.clientId, {
          title: "🎉 Corrida Concluída!",
          body: `Você chegou ao seu destino! Obrigado por viajar de Vouali. Realize o pagamento de R$ ${req.valorCalculado || "0,00"} via PIX no seu app.`,
          url: "/"
        });
      }

      if (status === "finalizado" || status === "cancelado") {
        activeRequests.delete(rideId);
      }
    }
  });

  socket.on("updatePaymentStatus", ({ rideId, statusPagamento }) => {
    const req = activeRequests.get(rideId);
    if (req) {
      req.statusPagamento = statusPagamento;
      activeRequests.set(rideId, req);
      io.to(`ride_${rideId}`).emit("rideStateUpdate", req);
    }
  });

  socket.on("sendChatMessage", ({ rideId, sender, text }) => {
    const msg = {
      sender,
      text,
      timestamp: new Date().toISOString()
    };
    const chat = rideChats.get(rideId) || [];
    chat.push(msg);
    rideChats.set(rideId, chat);

    io.to(`ride_${rideId}`).emit("newMessage", msg);
    console.log(`Chat message sent in ${rideId} by ${sender}: ${text}`);

    // Notify the other party if they are in the background / offline
    const req = activeRequests.get(rideId);
    if (req) {
      const otherUserId = sender === "client" ? req.driverId : req.clientId;
      const otherUserLabel = sender === "client" ? "Passageiro" : (req.driverName || "Piloto");
      if (otherUserId) {
        sendPushNotification(otherUserId, {
          title: `💬 Nova mensagem de ${otherUserLabel}`,
          body: text.length > 55 ? text.substring(0, 52) + "..." : text,
          url: "/"
        });
      }
    }
  });

  socket.on("disconnect", () => {
    connectedUsers.delete(socket.id);
  });
});

app.use(express.json());

// --- WHATSAPP AUTH & ADMIN API ---
const otpStore = new Map<string, { code: string; expires: number }>();

app.post("/api/auth/whatsapp/send-otp", async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: "Telefone é obrigatório" });

  console.log(`[WhatsApp Auth] Gerando OTP para: ${phone}`);

  try {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = Date.now() + 5 * 60 * 1000; // 5 minutes
    otpStore.set(phone, { code, expires });

    await waManager.sendOTP(phone, code);
    console.log(`[WhatsApp Auth] OTP ${code} enviado com sucesso para ${phone}`);
    res.json({ success: true, message: "Código enviado via WhatsApp" });
  } catch (err: any) {
    console.error(`[WhatsApp Auth] Erro ao enviar OTP para ${phone}:`, err);
    res.status(500).json({ error: err.message || "Falha ao enviar código" });
  }
});

app.post("/api/auth/whatsapp/verify-otp", async (req, res) => {
  const { phone, code } = req.body;
  if (!phone || !code) return res.status(400).json({ error: "Telefone e código são obrigatórios" });

  const stored = otpStore.get(phone);
  if (!stored) return res.status(400).json({ error: "Código expirado ou não solicitado" });

  if (Date.now() > stored.expires) {
    otpStore.delete(phone);
    return res.status(400).json({ error: "Código expirado" });
  }

  if (stored.code !== code) {
    return res.status(400).json({ error: "Código inválido" });
  }

  otpStore.delete(phone);

  try {
    // Generate custom token for the user based on phone number
    // In a real app, you'd look up the user by phone first
    const cleanPhone = phone.replace(/\D/g, "");
    const uid = `wa_${cleanPhone}`;
    let customToken = "";
    
    // Deterministic fallback credentials for systems where custom tokens are blocked by IAM
    const fallbackEmail = `${uid}@vouali.internal`;
    const fallbackPassword = `wa_verified_${uid}_secure`; // In production, use a more complex hash

    try {
      customToken = await admin.auth().createCustomToken(uid);
    } catch (e) {
      console.warn("Firebase Admin failed to create custom token, using simulated token and fallbacks", e);
      customToken = `simulated_token_${uid}`;
    }

    res.json({ 
      success: true, 
      customToken, 
      uid,
      fallbackEmail,
      fallbackPassword 
    });
  } catch (err: any) {
    res.status(500).json({ error: "Erro ao autenticar usuário" });
  }
});

app.get("/api/admin/whatsapp/status", (req, res) => {
  res.json(waManager.getConfig());
});

app.get("/api/admin/whatsapp/logs", (req, res) => {
  res.json(waManager.getLogs());
});

app.post("/api/admin/whatsapp/reconnect", async (req, res) => {
  waManager.reconnect().catch(err => console.error("[WhatsApp] Reconnect failed:", err));
  res.json({ success: true, message: "Reconexão iniciada em segundo plano." });
});

app.post("/api/admin/whatsapp/disconnect", async (req, res) => {
  waManager.disconnect().catch(err => console.error("[WhatsApp] Disconnect failed:", err));
  res.json({ success: true, message: "Desconexão iniciada em segundo plano." });
});

// --- PUSH NOTIFICATION API ENDPOINTS ---
app.get("/api/push/public-key", (req, res) => {
  // FCM doesn't use VAPID exactly this way for webpush, but we can return the messagingSenderId
  // or a specific VAPID key if configured in Firebase console.
  res.json({ publicKey: "BFA5r7Z..." }); // Replace with your Firebase Web Push VAPID key if needed
});

app.post("/api/driver/accept-contract", async (req, res) => {
  const { userId, contractVersion } = req.body;
  if (!userId || !contractVersion) {
    return res.status(400).json({ error: "userId e contractVersion são obrigatórios." });
  }

  const ip = (req.headers["x-forwarded-for"] as string) || req.ip || "0.0.0.0";
  const userAgent = req.headers["user-agent"] || "unknown";
  const timestamp = new Date().toISOString();

  console.log(`[Contract] Aceite recebido: User ${userId}, Versão ${contractVersion}, IP ${ip}`);

  try {
    // 1. Log the acceptance on Supabase
    const { error: logError } = await supabase
      .from("contract_acceptances")
      .insert({
        user_id: userId,
        contract_version: contractVersion,
        accepted_at: timestamp,
        ip,
        user_agent: userAgent
      });
    if (logError) throw logError;

    // 2. Update the driver profile on Supabase
    const { error: driverError } = await supabase
      .from("drivers")
      .update({
        contract_accepted_version: contractVersion,
        contract_accepted_at: timestamp
      })
      .eq("id", userId);
    if (driverError) throw driverError;

    res.json({ success: true, timestamp, ip });
  } catch (err: any) {
    console.error(`[Contract] Erro ao registrar aceite para ${userId}:`, err);
    res.status(500).json({ error: "Falha interna ao registrar aceite do contrato." });
  }
});

app.post("/api/push/subscribe", (req, res) => {
  const { userId, token, platform } = req.body;
  if (!userId || !token) {
    res.status(400).json({ error: "userId e token são obrigatórios." });
    return;
  }
  saveSubscription(userId, token, platform);
  res.json({ success: true });
});

app.post("/api/push/send-test", async (req, res) => {
  const { userId, title, body, delay } = req.body;
  if (!userId) {
    res.status(400).json({ error: "userId é obrigatório para envio de teste." });
    return;
  }

  const sendAction = () => {
    sendPushNotification(userId, {
      title: title || "🏍️ Notificação Premium Vouali",
      body: body || "Seu piloto em teste está chegando! Prepare-se para uma experiência sem APK.",
      url: "/",
      type: "new_ride"
    });
  };

  if (delay && Number(delay) > 0) {
    console.log(`Scheduling test notification for user ${userId} in ${delay}ms`);
    setTimeout(sendAction, Number(delay));
    res.json({ success: true, message: `Notificação agendada para daqui a ${delay / 1000}s. Minimize o navegador agora!` });
  } else {
    await sendAction();
    res.json({ success: true, message: "Notificação de teste enviada imediatamente!" });
  }
});

// Helper to get API key (from environment or system headers/query)
const getOrsApiKey = (req: express.Request): string | null => {
  const headerKey = req.headers["x-ors-api-key"] as string;
  if (headerKey && headerKey.trim() !== "") {
    return headerKey;
  }
  return process.env.ORS_API_KEY || null;
};

// Simple Haversine distance formula
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Generate intermediate mock street coordinates between start and end to look like a realistic road path
function generateMockRoutePoints(lat1: number, lon1: number, lat2: number, lon2: number): [number, number][] {
  const points: [number, number][] = [];
  const steps = 15;
  
  // Create a slight curve/zigzag to simulate realistic city driving streets instead of a straight line
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const lat = lat1 + (lat2 - lat1) * t;
    const lon = lon1 + (lon2 - lon1) * t;
    
    if (i > 0 && i < steps) {
      // Add slight offset wave
      const wave = Math.sin(t * Math.PI) * 0.0015;
      const wave2 = Math.cos(t * Math.PI * 2) * 0.001;
      points.push([lat + wave, lon + wave2]);
    } else {
      points.push([lat, lon]);
    }
  }
  return points;
}

// Helper to reverse geocode a pair of coordinates [lat, lng] to get a descriptive address label
async function tryGetAddressFromCoords(lat: number, lng: number, apiKey: string | null): Promise<string | null> {
  if (apiKey) {
    try {
      const url = `https://api.openrouteservice.org/geocode/reverse?api_key=${apiKey}&point.lon=${lng}&point.lat=${lat}&size=1`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        if (data.features && data.features.length > 0) {
          return data.features[0].properties.label || null;
        }
      }
    } catch (e) {
      console.error("[Geocoding Helper] ORS reverse geocoding failed:", e);
    }
  }

  // Fallback to OpenStreetMap/Nominatim Reverse Geocoding
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`;
    const response = await fetch(url, {
      headers: {
        "Accept-Language": "pt-BR,pt;q=0.9",
        "User-Agent": "MotoCalcPro/2.1 (contato.ifomee@gmail.com)"
      }
    });
    if (response.ok) {
      const data = await response.json();
      if (data && data.display_name) {
        return data.display_name;
      }
    }
  } catch (e) {
    console.error("[Geocoding Helper] Nominatim reverse geocoding failed:", e);
  }

  return null;
}

// Helper to perform simple text-based geocoding
async function geocodeAddressText(address: string, currentLat?: number, currentLng?: number, apiKey?: string | null): Promise<{ simulated: boolean; address: string; coordinates: [number, number] }> {
  // Try real ORS Autocomplete API first if we have a key
  if (apiKey) {
    try {
      const url = `https://api.openrouteservice.org/geocode/search?api_key=${apiKey}&text=${encodeURIComponent(address)}&size=5&boundary.country=BR`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        if (data.features && data.features.length > 0) {
          const firstFeature = data.features[0];
          const coords = firstFeature.geometry.coordinates; // [lon, lat]
          const label = firstFeature.properties.label;
          return {
            simulated: false,
            address: label,
            coordinates: coords,
          };
        }
      } else {
        const errorMsg = await response.text();
        console.warn(`ORS Geocoding response error: ${response.status} - ${errorMsg}`);
      }
    } catch (err) {
      console.error("ORS Geocoding failed, falling back to Nominatim/Simulation:", err);
    }
  }

  // Fallback 1: Nominatim (OpenStreetMap) Geocoding
  console.log(`[Nominatim Geocoding] Fetching: "${address}"`);
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=5&countrycodes=br`;
    const response = await fetch(url, {
      headers: {
        "Accept-Language": "pt-BR,pt;q=0.9",
        "User-Agent": "MotoCalcPro/2.1 (contato.ifomee@gmail.com)"
      }
    });
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        const first = data[0];
        const name = first.display_name;
        const lat = parseFloat(first.lat);
        const lng = parseFloat(first.lon);
        return {
          simulated: true, // marked as simulated/keyless
          address: name,
          coordinates: [lng, lat], // [longitude, latitude]
        };
      }
    }
  } catch (e) {
    console.error("Nominatim Geocoding failed, using static math simulator fallback:", e);
  }

  // Fallback 2: Mathematical offline simulator
  console.log(`[Geocoding Simulator] Geocoding query fallback: "${address}"`);
  let lat = -12.9714; // Default Salvador/BR
  let lng = -38.5014;
  
  if (currentLat && currentLng) {
    let hash = 0;
    for (let i = 0; i < address.length; i++) {
      hash = address.charCodeAt(i) + ((hash << 5) - hash);
    }
    const latOffset = ((Math.abs(hash) % 100) / 1000) * (hash % 2 === 0 ? 1 : -1);
    const lngOffset = (((Math.abs(hash) >> 3) % 100) / 1000) * (hash % 3 === 0 ? 1 : -1);
    
    lat = Number(currentLat) + latOffset;
    lng = Number(currentLng) + lngOffset;
  }

  return {
    simulated: true,
    address: `${address}, MotoCalc Simulação`,
    coordinates: [lng, lat],
  };
}

// Backend Geocoding Endpoint with Google Maps Link & coordinate pasting support
app.post("/api/geocode", async (req, res) => {
  try {
    const { address, currentLat, currentLng } = req.body;
    if (!address) {
      res.status(400).json({ error: "Endereço é obrigatório." });
      return;
    }

    const apiKey = getOrsApiKey(req);
    const addressClean = address.trim();

    // 1. Check if the input contains a Google Maps link anywhere
    const googleUrlRegex = /(https?:\/\/(?:maps\.(?:google|app)\.[a-z\.]+|goo\.gl\/maps|google\.[a-z\.]+\/maps)[^\s]*)/gi;
    const urlMatch = addressClean.match(googleUrlRegex);

    if (urlMatch && urlMatch.length > 0) {
      const rawUrl = urlMatch[0];
      console.log(`[Google Maps Parser] Extracted link: "${rawUrl}" from input "${addressClean}"`);
      
      let resolvedUrl = rawUrl;
      try {
        // Resolve shortened/redirected links using a dynamic fetch request that follows redirects
        const redirectRes = await fetch(rawUrl, {
          method: "GET", // Some redirect services block HEAD requests
          redirect: "follow",
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8"
          }
        });
        resolvedUrl = redirectRes.url || rawUrl;
        console.log(`[Google Maps Parser] Final redirected URL is: "${resolvedUrl}"`);
      } catch (err) {
        console.warn("[Google Maps Parser] Redirection fetch failed, parsing original URL directly:", err);
      }

      // Pattern A: Match coordinates from URL string path: `/@-13.011681,-38.533285`
      const urlCoordsMatch = resolvedUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (urlCoordsMatch) {
        const lat = parseFloat(urlCoordsMatch[1]);
        const lng = parseFloat(urlCoordsMatch[2]);
        console.log(`[Google Maps Parser] Parsed coordinates from path: lat=${lat}, lng=${lng}`);
        
        const reverseName = await tryGetAddressFromCoords(lat, lng, apiKey);
        res.json({
          simulated: !apiKey,
          address: reverseName || `Google Maps [${lat.toFixed(6)}, ${lng.toFixed(6)}]`,
          coordinates: [lng, lat],
        });
        return;
      }

      // Pattern B: Match coordinates from URL queries: `ll=-13.011681,-38.533285` or `query=-13.011681,-38.533285` or `q=-13.011681,-38.533285`
      const queryCoordsMatch = resolvedUrl.match(/\W(?:query|q|ll)=(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (queryCoordsMatch) {
        const lat = parseFloat(queryCoordsMatch[1]);
        const lng = parseFloat(queryCoordsMatch[2]);
        console.log(`[Google Maps Parser] Parsed coordinates from query: lat=${lat}, lng=${lng}`);
        
        const reverseName = await tryGetAddressFromCoords(lat, lng, apiKey);
        res.json({
          simulated: !apiKey,
          address: reverseName || `Google Maps [${lat.toFixed(6)}, ${lng.toFixed(6)}]`,
          coordinates: [lng, lat],
        });
        return;
      }

      // Pattern C: Match text label inside the google place url: `/maps/place/Rua+Nove,+123+-+Bairro/...`
      const placeNameMatch = resolvedUrl.match(/\/maps\/place\/([^/]+)/);
      if (placeNameMatch) {
        const placeText = decodeURIComponent(placeNameMatch[1].replace(/\+/g, " "));
        console.log(`[Google Maps Parser] Extracted place name to geocode: "${placeText}"`);
        const result = await geocodeAddressText(placeText, currentLat, currentLng, apiKey);
        res.json(result);
        return;
      }

      // Pattern D: Extract and query standard query params
      const qParamMatch = resolvedUrl.match(/\W(?:q|query)=([^&]+)/);
      if (qParamMatch) {
        const qText = decodeURIComponent(qParamMatch[1].replace(/\+/g, " "));
        console.log(`[Google Maps Parser] Extracted q metric to geocode: "${qText}"`);
        const result = await geocodeAddressText(qText, currentLat, currentLng, apiKey);
        res.json(result);
        return;
      }
    }

    // 2. Check if the input itself is direct GPS coordinates e.g. "-12.98124, -38.45021" or "-12.98124 -38.45021"
    const directCoordsRegex = /^\s*(-?\d+(?:\.\d+)?)\s*[\s,;]\s*(-?\d+(?:\.\d+)?)\s*$/;
    const directCoordsMatch = addressClean.match(directCoordsRegex);
    if (directCoordsMatch) {
      const lat = parseFloat(directCoordsMatch[1]);
      const lng = parseFloat(directCoordsMatch[2]);

      // Check validation constraints
      if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
        console.log(`[Direct Coordinates] Pasted coordinates: lat=${lat}, lng=${lng}`);
        const reverseName = await tryGetAddressFromCoords(lat, lng, apiKey);
        res.json({
          simulated: !apiKey,
          address: reverseName || `Coordenadas [${lat.toFixed(6)}, ${lng.toFixed(6)}]`,
          coordinates: [lng, lat],
        });
        return;
      }
    }

    // 3. Fallback to normal text-based address search
    const result = await geocodeAddressText(addressClean, currentLat, currentLng, apiKey);
    res.json(result);

  } catch (error: any) {
    console.error("Geocoding Error:", error);
    res.status(500).json({ error: error.message || "Erro no geocodificador das localizações." });
  }
});

// Backend Directions/Routing Endpoint
app.post("/api/route", async (req, res) => {
  try {
    const { startCoords, endCoords, waypoints = [] } = req.body; // format: [lon, lat]
    if (!startCoords || !endCoords || startCoords.length !== 2 || endCoords.length !== 2) {
      res.status(400).json({ error: "Coordenadas de início e fim são obrigatórias." });
      return;
    }

    const apiKey = getOrsApiKey(req);
    
    // Combine all points for the route
    const allPoints = [startCoords, ...waypoints, endCoords];
    
    // Calculate fallback/simulated metrics
    let totalStraightDist = 0;
    for (let i = 0; i < allPoints.length - 1; i++) {
      totalStraightDist += haversineDistance(allPoints[i][1], allPoints[i][0], allPoints[i+1][1], allPoints[i+1][0]);
    }

    // Driving distance is usually around 1.25x to 1.35x straight line distance due to streets
    const routedDistanceKm = parseFloat((totalStraightDist * 1.28).toFixed(2));
    const estimatedMinutes = Math.max(2, Math.round(routedDistanceKm * 1.8));

    if (!apiKey) {
      console.log("[Route OSRM] Calculating real route via OSRM public server");
      try {
        const coordsPath = allPoints.map(p => `${p[0]},${p[1]}`).join(";");
        const url = `http://router.project-osrm.org/route/v1/driving/${coordsPath}?overview=full&geometries=geojson`;
        const response = await fetch(url, {
          headers: {
            "Accept-Language": "pt-BR,pt;q=0.9",
            "User-Agent": "MotoCalcPro/2.1 (contato.ifomee@gmail.com)"
          }
        });
        if (response.ok) {
          const data = await response.json();
          if (data.code === "Ok" && data.routes && data.routes.length > 0) {
            const route = data.routes[0];
            res.json({
              simulated: true, // Mark as simulated since it's the free keyless server
              distance: parseFloat((route.distance / 1000).toFixed(2)),
              duration: route.duration,
              geometry: route.geometry.coordinates, // array of [lon, lat]
            });
            return;
          }
        }
      } catch (err) {
        console.error("OSRM Route calculations failed, falling back to straight-line math generator:", err);
      }

      // Mathematical straight-line wave fallback
      let geometryCoords: [number, number][] = [];
      for (let i = 0; i < allPoints.length - 1; i++) {
        const segPoints = generateMockRoutePoints(
          allPoints[i][1], allPoints[i][0], 
          allPoints[i+1][1], allPoints[i+1][0]
        ).map(pt => [pt[1], pt[0]] as [number, number]);
        geometryCoords = [...geometryCoords, ...segPoints];
      }

      res.json({
        simulated: true,
        distance: routedDistanceKm, // in KM
        duration: estimatedMinutes * 60, // in Seconds
        geometry: geometryCoords, // array of [lon, lat]
      });
      return;
    }

    // Call real ORS Directions API
    // For multiple waypoints, we should use the POST endpoint for directions
    const url = `https://api.openrouteservice.org/v2/directions/driving-car/geojson`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': apiKey
      },
      body: JSON.stringify({
        coordinates: allPoints
      })
    });

    if (!response.ok) {
      const errorMsg = await response.text();
      console.warn(`ORS Directions API failed (Status ${response.status}). Falling back to OSRM. Error: ${errorMsg}`);
      
      try {
        const coordsPath = allPoints.map(p => `${p[0]},${p[1]}`).join(";");
        const osrmUrl = `http://router.project-osrm.org/route/v1/driving/${coordsPath}?overview=full&geometries=geojson`;
        const osrmResponse = await fetch(osrmUrl, {
          headers: {
            "Accept-Language": "pt-BR,pt;q=0.9",
            "User-Agent": "MotoCalcPro/2.1 (contato.ifomee@gmail.com)"
          }
        });
        if (osrmResponse.ok) {
          const osrmData = await osrmResponse.json();
          if (osrmData.code === "Ok" && osrmData.routes && osrmData.routes.length > 0) {
            const route = osrmData.routes[0];
            res.json({
              simulated: true,
              distance: parseFloat((route.distance / 1000).toFixed(2)),
              duration: route.duration,
              geometry: route.geometry.coordinates,
              warning: "API do OpenRouteService indisponível. Usando rota de rua em tempo real."
            });
            return;
          }
        }
      } catch (err) {
        console.error("OSRM Fallback also failed:", err);
      }

      // Out of options, run mathematical wave fallback
      let geometryCoords: [number, number][] = [];
      for (let i = 0; i < allPoints.length - 1; i++) {
        const segPoints = generateMockRoutePoints(
          allPoints[i][1], allPoints[i][0], 
          allPoints[i+1][1], allPoints[i+1][0]
        ).map(pt => [pt[1], pt[0]] as [number, number]);
        geometryCoords = [...geometryCoords, ...segPoints];
      }

      res.json({
        simulated: true,
        distance: routedDistanceKm,
        duration: estimatedMinutes * 60,
        geometry: geometryCoords,
        warning: "API do OpenRouteService retornou erro. Usando simulação aproximada."
      });
      return;
    }

    const data = await response.json();
    if (data.features && data.features.length > 0) {
      const feature = data.features[0];
      const distanceMeters = feature.properties.summary.distance;
      const durationSeconds = feature.properties.summary.duration;
      const geometryCoords = feature.geometry.coordinates; // array of [lon, lat]

      res.json({
        simulated: false,
        distance: parseFloat((distanceMeters / 1000).toFixed(2)),
        duration: durationSeconds,
        geometry: geometryCoords,
      });
    } else {
      throw new Error("Nenhuma rota encontrada.");
    }
  } catch (error: any) {
    console.error("Routing Error:", error);
    // Secure grace fallback so app NEVER crashes and always displays map and results
    const startCoords = req.body.startCoords || [0, 0];
    const endCoords = req.body.endCoords || [0, 0];
    const straightDist = haversineDistance(startCoords[1], startCoords[0], endCoords[1], endCoords[0]);
    const routedDistanceKm = parseFloat((straightDist * 1.28).toFixed(2));
    const estimatedMinutes = Math.max(2, Math.round(routedDistanceKm * 1.8));
    const geometryCoords = generateMockRoutePoints(
      startCoords[1], startCoords[0], 
      endCoords[1], endCoords[0]
    ).map(pt => [pt[1], pt[0]]);

    res.json({
      simulated: true,
      distance: routedDistanceKm,
      duration: estimatedMinutes * 60,
      geometry: geometryCoords,
      error: error.message || "Erro de conexão, usando simulação integrada."
    });
  }
});

// --- SUPPORT & AI CHAT API ---
async function getPlatformSettings() {
  try {
    const { data, error } = await supabase
      .from("settings")
      .select("data")
      .eq("id", "global")
      .single();

    if (error) throw error;
    return data?.data || {};
  } catch (err) {
    console.error("Error fetching settings from Supabase:", err);
    return {};
  }
}

function isSupportOnline(settings: any) {
  const support = settings.supportSettings;
  if (!support || !support.businessHours) return true; // Default to online if not configured
  
  const { businessHours } = support;
  const now = new Date();
  const day = now.getDay(); // 0 is Sunday
  
  if (!businessHours.daysAvailable.includes(day)) return false;
  
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  return currentTime >= businessHours.openingTime && currentTime <= businessHours.closingTime;
}

app.get("/api/support/status", async (req, res) => {
  const settings = await getPlatformSettings();
  const online = isSupportOnline(settings);
  res.json({ 
    online, 
    settings: settings.supportSettings?.businessHours || null 
  });
});

app.post("/api/support/ai-chat", async (req, res) => {
  const { ticketId, message, userId, userName, userRole } = req.body;
  
  if (!message || !ticketId) {
    return res.status(400).json({ error: "Mensagem e TicketId são obrigatórios." });
  }

  try {
    const settings = await getPlatformSettings();
    const aiConfig = settings.supportSettings?.aiConfig;

    if (!aiConfig || !aiConfig.enabled) {
      return res.status(503).json({ error: "Assistente de IA está desativado no momento." });
    }

    const { data: ticketData, error: ticketError } = await supabase
      .from("support_tickets")
      .select("category, subject, description")
      .eq("id", ticketId)
      .single();
    if (ticketError) throw ticketError;

    // Context preparation
    const systemPrompt = `
      Você é o assistente oficial de suporte do Vouali, chamado ${aiConfig.name || "Vouali Assist"}.
      Personalidade: ${aiConfig.behavior || "Profissional, prestativo e educado"}.
      
      Instruções principais:
      ${aiConfig.instructions}
      
      Contexto da plataforma:
      ${aiConfig.context}
      
      Informações do Usuário:
      Nome: ${userName}
      Papel: ${userRole === 'client' ? 'Passageiro' : 'Motorista'}
      
      Informações do Chamado:
      Categoria: ${ticketData?.category || 'Geral'}
      Assunto: ${ticketData?.subject || 'Suporte'}
      Descrição: ${ticketData?.description || ''}

      Regras:
      1. Responda apenas dúvidas sobre o Vouali (corridas, pagamentos PIX, cadastro, carteira).
      2. Se não souber a resposta ou for algo complexo (ex: estorno financeiro manual), diga que um atendente humano irá assumir em breve.
      3. Nunca saia do personagem.
      4. Responda de forma concisa e útil.
    `;

    // Fetch message history for the ticket from Supabase
    const { data: messagesData, error: messagesError } = await supabase
      .from("support_messages")
      .select("sender_role, text")
      .eq("ticket_id", ticketId)
      .order("timestamp", { ascending: true })
      .limit(10);
    if (messagesError) throw messagesError;
    
    const history = (messagesData || []).map(d => ({
      role: (d.sender_role === 'ai' ? 'assistant' : 'user') as any,
      content: String(d.text || "")
    }));

    const completion = await groq.chat.completions.create({
      messages: [
        { role: "system" as any, content: systemPrompt },
        ...history,
        { role: "user" as any, content: message }
      ],
      model: aiConfig.model || "llama-3.3-70b-versatile",
      temperature: 0.7,
      max_tokens: 500,
    });

    const aiResponse = completion.choices[0]?.message?.content || "Desculpe, não consegui processar sua solicitação agora.";

    // Save AI response to Supabase support_messages
    const msgId = "ai_msg_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9);
    const { error: msgInsertError } = await supabase
      .from("support_messages")
      .insert({
        id: msgId,
        ticket_id: ticketId,
        sender_id: "ai_bot",
        sender_name: aiConfig.name || "Vouali Assist",
        sender_role: "ai",
        text: aiResponse,
        timestamp: new Date().toISOString()
      });
    if (msgInsertError) throw msgInsertError;

    // Update ticket last message and unread status on Supabase
    const { error: ticketUpdateError } = await supabase
      .from("support_tickets")
      .update({
        last_message: aiResponse,
        updated_at: new Date().toISOString(),
        unread_user: true
      })
      .eq("id", ticketId);
    if (ticketUpdateError) throw ticketUpdateError;

    res.json({ success: true, response: aiResponse });
  } catch (err: any) {
    console.error("Erro na Groq API:", err);
    res.status(500).json({ error: "Falha ao processar resposta da IA." });
  }
});

app.post("/api/support/ai-sandbox", async (req, res) => {
  const { message, config } = req.body;
  
  if (!message || !config) {
    return res.status(400).json({ error: "Mensagem e Configuração são obrigatórios." });
  }

  try {
    const systemPrompt = `
      Você é o assistente de suporte chamado ${config.name || "Vouali Assist"}.
      Personalidade: ${config.behavior || "Profissional"}.
      
      Instruções principais:
      ${config.instructions}
      
      Contexto da plataforma:
      ${config.context}

      ⚠️ AVISO: Este é um ambiente de TESTE (SANDBOX). 
      Simule o comportamento real que você teria com um usuário.
    `;

    const completion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message }
      ],
      model: config.model || "llama-3.3-70b-versatile",
      temperature: 0.7,
      max_tokens: 500,
    });

    const aiResponse = completion.choices[0]?.message?.content || "Sem resposta do modelo.";
    res.json({ success: true, response: aiResponse });
  } catch (err: any) {
    console.error("Erro na Groq Sandbox:", err);
    res.status(500).json({ error: "Erro ao testar IA. Verifique sua GROQ_API_KEY." });
  }
});

// Serve UI assets and boot the server within an async wrapper to support CommonJS transpilation
async function bootstrap() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

bootstrap();
