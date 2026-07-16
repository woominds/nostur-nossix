import { supabase } from "../../lib/supabase";

export type PushStatus = {
  supported: boolean;
  permission: NotificationPermission | "unsupported";
  subscribed: boolean;
  endpoint: string | null;
};

function base64UrlToUint8Array(value: string): Uint8Array {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

export function isPushSupported(): boolean {
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export async function getPushStatus(): Promise<PushStatus> {
  if (!isPushSupported()) {
    return { supported: false, permission: "unsupported", subscribed: false, endpoint: null };
  }

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();

  return {
    supported: true,
    permission: Notification.permission,
    subscribed: Boolean(subscription),
    endpoint: subscription?.endpoint || null
  };
}

function deviceDescription(): { deviceName: string; platform: string; browser: string } {
  const ua = navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua);
  const isAndroid = /Android/.test(ua);
  const platform = isIos ? "iOS" : isAndroid ? "Android" : navigator.platform || "Web";
  const browser = /CriOS|Chrome/.test(ua)
    ? "Chrome"
    : /FxiOS|Firefox/.test(ua)
      ? "Firefox"
      : /Safari/.test(ua)
        ? "Safari"
        : "Navegador";

  return {
    deviceName: `${platform} · ${browser}`,
    platform,
    browser
  };
}

export async function enablePushNotifications(userId: string): Promise<PushStatus> {
  if (!isPushSupported()) throw new Error("Este dispositivo no admite Web Push.");

  const vapidPublicKey = String(import.meta.env.VITE_WEB_PUSH_VAPID_PUBLIC_KEY || "").trim();
  if (!vapidPublicKey) throw new Error("Falta VITE_WEB_PUSH_VAPID_PUBLIC_KEY en .env.local.");

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error(permission === "denied" ? "El permiso fue rechazado en el dispositivo." : "No se concedió el permiso de notificaciones.");
  }

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToUint8Array(vapidPublicKey) as BufferSource
    });
  }

  const json = subscription.toJSON();
  const keys = json.keys;
  if (!json.endpoint || !keys?.p256dh || !keys?.auth) {
    throw new Error("El navegador no devolvió una suscripción push válida.");
  }

  const device = deviceDescription();
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint: json.endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      device_name: device.deviceName,
      platform: device.platform,
      browser: device.browser,
      app_version: __APP_VERSION__,
      enabled: true,
      last_seen_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    { onConflict: "endpoint" }
  );

  if (error) throw new Error(`No se pudo registrar el dispositivo: ${error.message}`);
  return getPushStatus();
}

export async function disablePushNotifications(): Promise<PushStatus> {
  if (!isPushSupported()) return getPushStatus();

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();

  if (subscription) {
    await supabase.from("push_subscriptions").delete().eq("endpoint", subscription.endpoint);
    await subscription.unsubscribe();
  }

  return getPushStatus();
}

export async function sendTestPush(): Promise<void> {
  const { data, error } = await supabase.functions.invoke("send-web-push", {
    body: {
      mode: "self-test",
      title: "NOSTUR Mobile",
      body: "Las notificaciones push están funcionando correctamente.",
      url: "/app/?screen=notifications",
      tag: `nostur-test-${Date.now()}`
    }
  });

  if (error) throw new Error(error.message || "No se pudo enviar el push de prueba.");
  if (data?.error) throw new Error(String(data.error));
}

export async function playNotificationSound(): Promise<void> {
  const audio = new Audio(new URL("sounds/chat-new.mp3", document.baseURI).toString());
  audio.volume = 1;
  await audio.play();
  localStorage.setItem("nostur:mobile-sounds-enabled", "1");
}
