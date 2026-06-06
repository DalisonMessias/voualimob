import { getToken, onMessage } from "firebase/messaging";
import { getFCM } from "../lib/firebase";

/**
 * Checks if Service Workers and Push notifications are supported in the current environment
 */
export function isPushSupported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window;
}

/**
 * Requests browser permission and attempts to subscribe the user to push notifications using FCM
 * @param userId Loaded logged-in user ID
 * @returns boolean indicating success status
 */
export async function registerPushNotification(userId: string): Promise<boolean> {
  if (!isPushSupported()) {
    console.warn("Push notifications are not supported in this browser.");
    return false;
  }

  try {
    const messaging = await getFCM();
    if (!messaging) {
      console.warn("FCM is not supported in this browser environment.");
      return false;
    }

    // 1. Request permission
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.warn("Notification permission was denied.");
      return false;
    }

    // 2. Get FCM Token
    // Note: The vapidKey should ideally come from your Firebase Console (Cloud Messaging -> Web Configuration)
    // For specific AI Studio environments, we'll try to fetch it if provided in config, or use a default if configured.
    const token = await getToken(messaging, {
      serviceWorkerRegistration: await navigator.serviceWorker.ready
    });

    if (token) {
      console.log("FCM Token secured:", token);
      
      // 3. Send subscription info to the backend sever
      const saveResponse = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          userId,
          token,
          platform: "web"
        })
      });

      if (!saveResponse.ok) {
        throw new Error(`Failed to save FCM token on backend (status ${saveResponse.status})`);
      }

      console.log("Successfully synchronized FCM token with backend.");
      
      // Setup foreground message listener
      onMessage(messaging, (payload) => {
        console.log("Notification received in foreground:", payload);
        // Custom logic to show non-blocking UI alert or use standard notification
        if (payload.notification) {
          new Notification(payload.notification.title || "Vouali", {
            body: payload.notification.body,
            icon: "https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=96&h=96&fit=crop"
          });
        }
      });

      return true;
    } else {
      console.warn("No FCM token retrieved. Check permissions or Firebase config.");
      return false;
    }

  } catch (err) {
    console.error("Error during FCM Push registration:", err);
    return false;
  }
}

/**
 * Triggers a simulated background push notification
 */
export async function triggerDemoPush(
  userId: string,
  title: string,
  body: string,
  delaySeconds: number
): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch("/api/push/send-test", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        userId,
        title,
        body,
        delay: delaySeconds * 1000
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      return { success: false, message: `Erro ao solicitar envio: ${errText}` };
    }

    const data = await response.json();
    return { success: true, message: data.message || "Simulação enviada via FCM!" };
  } catch (err: any) {
    console.error("Error sending FCM demo request:", err);
    return { success: false, message: err.message || "Falha de conexão com o servidor." };
  }
}
