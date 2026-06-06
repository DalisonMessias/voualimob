// Vouali Advanced PWA Service Worker with FCM Support
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

// Initialize Firebase in the Service Worker
// In production, these should match your firebase-applet-config.json
firebase.initializeApp({
  apiKey: "AIzaSyBeQc-1aZmpbmyxobFI2iKa9XwQzNxHC9U",
  authDomain: "gen-lang-client-0970723662.firebaseapp.com",
  projectId: "gen-lang-client-0970723662",
  storageBucket: "gen-lang-client-0970723662.firebasestorage.app",
  messagingSenderId: "564077768608",
  appId: "1:564077768608:web:0a4fccd1ffc506a1e43ec5"
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log("[sw.js] Background message received: ", payload);

  const notificationTitle = payload.notification?.title || payload.data?.title || "Vouali";
  
  // Custom logic for driver alerts (stronger vibration and specific buttons)
  const isDriverAlert = payload.data?.type === "new_ride" || notificationTitle.includes("Corrida");
  
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || "Atualização em tempo real!",
    icon: "/https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=192&h=192&fit=crop",
    badge: "https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=96&h=96&fit=crop",
    vibrate: isDriverAlert ? [500, 200, 500, 200, 500, 200, 500] : [100, 50, 100],
    tag: payload.data?.tag || "vouali-notification",
    renotify: true,
    data: {
      url: payload.data?.url || "/",
      rideId: payload.data?.rideId
    },
    actions: isDriverAlert ? [
      { action: "accept", title: "✅ Aceitar Agora" },
      { action: "decline", title: "❌ Recusar" }
    ] : [
      { action: "open", title: "Visualizar" }
    ]
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

const CACHE_NAME = "vouali-v1";
const ASSETS_TO_CACHE = [
  "/",
  "/index.html",
  "/manifest.json",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
];

// Standard SW Lifecycle
self.addEventListener("install", (event) => {
  console.log("[sw.js] Installing...");
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  console.log("[sw.js] Activating...");
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// Fetch handling for offline support
self.addEventListener("fetch", (event) => {
  // Only cache GET requests
  if (event.request.method !== "GET") return;
  
  // Prevent caching API calls
  if (event.request.url.includes("/api/")) return;

  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});

// Notification click handling
self.addEventListener("notificationclick", (event) => {
  const action = event.action;
  const notification = event.notification;
  notification.close();

  console.log(`[sw.js] Notification clicked: ${action}`);

  const urlToOpen = notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      // Logic for specific actions
      if (action === "accept") {
        // In a real app we might call an API here, but for now we just open the app
        // with a query param to trigger the accept logic
        const acceptUrl = `/?action=accept&rideId=${notification.data?.rideId || ""}`;
        return openApp(acceptUrl, windowClients);
      }

      return openApp(urlToOpen, windowClients);
    })
  );
});

function openApp(url, windowClients) {
  for (let i = 0; i < windowClients.length; i++) {
    const client = windowClients[i];
    if (client.url && "focus" in client) {
      return client.focus();
    }
  }
  if (self.clients.openWindow) {
    return self.clients.openWindow(url);
  }
}
