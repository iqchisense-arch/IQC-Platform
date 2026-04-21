const CACHE_NAME = "iqc-platform-cache-v31";
const APP_ASSETS = [
"/",
"/manifest.webmanifest",
"/login.html",
"/index.html",
"/admin-vendors.html",
"/admin-users.html",
"/incoming.html",
"/incoming-detail.html",
"/daily.html",
"/daily-detail.html",
"/box.html",
"/box-detail.html",
"/rtv.html",
"/rtv-detail.html",
"/print-rtv.html",
"/css/index.css",
"/css/responsive.css",
"/css/incoming.css",
"/css/daily.css",
"/css/box.css",
"/css/rtv.css",
"/css/admin.css",
"/js/api.js",
"/js/app-alert.js",
"/js/admin-vendors.js",
"/js/admin-users.js",
"/js/db.js",
"/js/script.js",
"/js/incoming.js",
"/js/incoming-detail.js",
"/js/daily.js",
"/js/daily-detail.js",
"/js/box.js",
"/js/box-detail.js",
"/js/rtv.js",
"/js/rtv-detail.js",
"/js/rtv-email.js",
"/js/theme.js",
"/js/word-generator.js",
"/js/docx.js",
"/data/parts.json",
"/img/hisense-logo.png",
"/img/app-icon-192.png",
"/img/app-icon-512.png",
"/img/no-photo.png",
"/img/no-image.png",
"/img/inspectores/default.png"
];

self.addEventListener("install", event => {
event.waitUntil(
caches.open(CACHE_NAME)
.then(cache => cache.addAll(APP_ASSETS))
.then(() => self.skipWaiting())
);
});

self.addEventListener("activate", event => {
event.waitUntil(
caches.keys()
.then(keys => Promise.all(
keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
))
.then(() => self.clients.claim())
);
});

self.addEventListener("fetch", event => {
const request = event.request;
const url = new URL(request.url);

if (url.pathname.startsWith("/api/")) return;

if (request.method !== "GET") return;

event.respondWith(
fetch(request)
.then(response => {
const copy = response.clone();
if (url.origin === self.location.origin && response.ok) {
caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
}
return response;
})
.catch(() => caches.match(request).then(cached => {
if (cached) return cached;
if (request.mode === "navigate") return caches.match("/index.html");
return cached;
}))
);
});

self.addEventListener("push", event => {
let payload = {};

try {
payload = event.data ? event.data.json() : {};
} catch (_) {
payload = {
title: "IQC notification",
body: event.data ? event.data.text() : "New inspection record"
};
}

const title = payload.title || "New inspection record";
const options = {
body: payload.body || "An inspector generated a new record.",
icon: "/img/app-icon-192.png",
badge: "/img/app-icon-192.png",
image: payload.image || undefined,
tag: payload.tag || "iqc-new-record",
renotify: true,
requireInteraction: false,
timestamp: Date.now(),
vibrate: [120, 60, 120],
actions: [
{ action: "open", title: "Open IQC" },
{ action: "dismiss", title: "Dismiss" }
],
data: {
url: payload.url || "/index.html",
notificationId: payload.notificationId || null
}
};

event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", event => {
event.notification.close();

if (event.action === "dismiss") {
return;
}

const targetUrl = new URL(event.notification.data?.url || "/index.html", self.location.origin).href;

event.waitUntil(
self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(clientList => {
for (const client of clientList) {
if (client.url === targetUrl && "focus" in client) {
return client.focus();
}
}

if (self.clients.openWindow) {
return self.clients.openWindow(targetUrl);
}

return null;
})
);
});

self.addEventListener("pushsubscriptionchange", event => {
event.waitUntil((async () => {
try {
const keyResponse = await fetch("/api/push/vapid-public-key", { credentials: "include" });
if (!keyResponse.ok) return;

const keyData = await keyResponse.json();
if (!keyData.enabled || !keyData.publicKey) return;

const padding = "=".repeat((4 - keyData.publicKey.length % 4) % 4);
const base64 = (keyData.publicKey + padding).replace(/-/g, "+").replace(/_/g, "/");
const rawData = atob(base64);
const applicationServerKey = new Uint8Array(rawData.length);
for (let index = 0; index < rawData.length; index += 1) {
applicationServerKey[index] = rawData.charCodeAt(index);
}

const subscription = await self.registration.pushManager.subscribe({
userVisibleOnly: true,
applicationServerKey
});

await fetch("/api/push/subscribe", {
method: "POST",
credentials: "include",
headers: { "Content-Type": "application/json" },
body: JSON.stringify(subscription.toJSON())
});
} catch (_) {
}
})());
});
