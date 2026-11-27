const AUTH_CHANNEL_NAME = "auth_logout_channel";

/**
 * Identifies this tab. A BroadcastChannel message also reaches the other
 * channel objects in the tab that sent it, so without this the tab you signed
 * out in heard its own message and showed "Signed out in another tab" on top
 * of "Signed out". Listeners ignore messages carrying their own tab's id.
 */
const TAB_ID =
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;

export function broadcastLogout() {
  if (typeof window === "undefined") return;
  if (typeof BroadcastChannel !== "undefined") {
    const channel = new BroadcastChannel(AUTH_CHANNEL_NAME);
    channel.postMessage({
      type: "LOGOUT",
      tabId: TAB_ID,
      timestamp: Date.now(),
    });
    channel.close();
    return;
  }
  // Fallback only: listeners hear either the channel or the storage event,
  // never both, so other tabs get one toast and one redirect.
  try {
    localStorage.setItem("auth_logout_event", Date.now().toString());
  } catch {}
}

export function subscribeToLogout(onLogout: () => void) {
  if (typeof window === "undefined") return () => {};

  const cleanups: Array<() => void> = [];
  if (typeof BroadcastChannel !== "undefined") {
    const channel = new BroadcastChannel(AUTH_CHANNEL_NAME);
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "LOGOUT" && event.data?.tabId !== TAB_ID) {
        onLogout();
      }
    };
    channel.addEventListener("message", handleMessage);
    cleanups.push(() => {
      channel.removeEventListener("message", handleMessage);
      channel.close();
    });

    return () => {
      cleanups.forEach((cleanup) => cleanup());
    };
  }
  const handleStorage = (event: StorageEvent) => {
    if (event.key === "auth_logout_event") {
      onLogout();
    }
  };
  window.addEventListener("storage", handleStorage);
  cleanups.push(() => window.removeEventListener("storage", handleStorage));

  return () => {
    cleanups.forEach((cleanup) => cleanup());
  };
}
