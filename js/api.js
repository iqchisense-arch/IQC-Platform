(function () {
const TRACKED_KEYS = [
"incomingData",
"boxData",
"dailyData",
"rtvData",
"supplierQualityData"
];

const DEFAULT_DATASETS = {
incomingData: [],
boxData: [],
dailyData: [],
rtvData: [],
supplierQualityData: {}
};

const API_BASE =
window.APP_API_BASE ||
localStorage.getItem("appApiBase") ||
((window.location.origin && window.location.origin !== "null")
? window.location.origin + "/api"
: "/api");

const datasetState = {};
let syncMuted = false;
const timers = {};
const pendingSyncs = {};
let deferredInstallPrompt = null;
const PENDING_DATASETS_KEY = "iqcPendingDatasetSync";
const NOTIFICATION_SEEN_PREFIX = "iqcSeenNotifications:";

window.addEventListener("beforeinstallprompt", event => {
event.preventDefault();
deferredInstallPrompt = event;
window.dispatchEvent(new CustomEvent("app-install-available"));
});

window.addEventListener("appinstalled", () => {
deferredInstallPrompt = null;
window.dispatchEvent(new CustomEvent("app-install-available"));
});

function clone(value) {
return JSON.parse(JSON.stringify(value));
}

function safeJSONParse(raw, fallback) {
if (!raw) return clone(fallback);
try {
return JSON.parse(raw);
} catch (_) {
return clone(fallback);
}
}

function readPendingDatasets() {
return safeJSONParse(window.localStorage.getItem(PENDING_DATASETS_KEY), {});
}

function writePendingDatasets(value) {
window.localStorage.setItem(PENDING_DATASETS_KEY, JSON.stringify(value));
}

function getPendingDatasetNames() {
const pending = readPendingDatasets();
return TRACKED_KEYS.filter(key => Object.prototype.hasOwnProperty.call(pending, key));
}

function notifySyncState() {
window.dispatchEvent(new CustomEvent("app-sync-state", {
detail: { pendingDatasets: getPendingDatasetNames() }
}));
}

function markDatasetPending(name) {
const pending = readPendingDatasets();
pending[name] = new Date().toISOString();
writePendingDatasets(pending);
notifySyncState();
}

function clearDatasetPending(name) {
const pending = readPendingDatasets();
if (!Object.prototype.hasOwnProperty.call(pending, name)) return;
delete pending[name];
writePendingDatasets(pending);
notifySyncState();
}

function isRetriableSyncError(error) {
return !error || !error.status || error.status >= 500;
}

function getDefaultDataset(name) {
return clone(DEFAULT_DATASETS[name] ?? []);
}

function loadSession() {
return safeJSONParse(window.localStorage.getItem("loggedUser"), null);
}

function persistSession(user) {
window.localStorage.setItem("loggedUser", JSON.stringify(user));
window.localStorage.setItem("inspector", JSON.stringify({
name: user.name,
emp: user.emp,
role: user.role,
level: user.level,
photo: user.photo
}));
}

function clearSession() {
try {
fetch(API_BASE + "/auth/logout", {
method: "POST",
keepalive: true
}).catch(() => {});
} catch (_) {
}

window.localStorage.removeItem("loggedUser");
window.localStorage.removeItem("inspector");
}

function canReceivePushNotifications(sessionUser) {
return Boolean(sessionUser && ["Admin", "Inspector", "Group Leader", "Engineer", "Manager", "Director", "Vendor"].includes(sessionUser.role));
}

function isStandaloneApp() {
return window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true;
}

function isIOSDevice() {
return /iphone|ipad|ipod/i.test(window.navigator.userAgent || "");
}

function mobileNotificationHelpMessage() {
if (!window.isSecureContext) {
return "Open IQC with HTTPS before enabling phone notifications.";
}

if (isIOSDevice() && !isStandaloneApp()) {
return "On iPhone/iPad, open Share and choose Add to Home Screen. Then open IQC from the new app icon and enable notifications.";
}

return "Install IQC on the device, then tap Enable browser to allow native notifications.";
}

function urlBase64ToUint8Array(base64String) {
const padding = "=".repeat((4 - base64String.length % 4) % 4);
const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
const rawData = window.atob(base64);
const outputArray = new Uint8Array(rawData.length);

for (let i = 0; i < rawData.length; i += 1) {
outputArray[i] = rawData.charCodeAt(i);
}

return outputArray;
}

async function initPushNotifications(registration) {
const sessionUser = loadSession();

if (!canReceivePushNotifications(sessionUser)) return;
if (!("Notification" in window) || !("PushManager" in window) || !window.isSecureContext) return;

try {
let permission = Notification.permission;
if (permission !== "granted") return;
await subscribeWebPush(registration);
} catch (error) {
console.warn("Push notification setup failed:", error);
}
}

async function subscribeWebPush(registration) {
const keyResponse = await fetch(API_BASE + "/push/vapid-public-key");
if (!keyResponse.ok) throw new Error("push_key_failed");

const keyData = await keyResponse.json().catch(() => ({}));
if (!keyData.enabled || !keyData.publicKey) throw new Error("push_not_enabled");

const activeRegistration = registration || await navigator.serviceWorker.ready;
let subscription = await activeRegistration.pushManager.getSubscription();

if (!subscription) {
subscription = await activeRegistration.pushManager.subscribe({
userVisibleOnly: true,
applicationServerKey: urlBase64ToUint8Array(keyData.publicKey)
});
}

await fetch(API_BASE + "/push/subscribe", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify(subscription.toJSON())
});

return subscription;
}

async function enableWebNotifications() {
const sessionUser = loadSession();
if (!canReceivePushNotifications(sessionUser)) throw new Error("notifications_not_allowed");
if (!("Notification" in window) || !("PushManager" in window) || !window.isSecureContext) {
throw new Error("notifications_unsupported");
}

let permission = Notification.permission;
if (permission === "default") {
permission = await Notification.requestPermission();
}
if (permission !== "granted") throw new Error("notifications_denied");

const registration = "serviceWorker" in navigator
? await navigator.serviceWorker.ready
: null;
await subscribeWebPush(registration);
await showWebNotification({
id: "enabled-" + Date.now(),
isRead: false,
title: "Notifications enabled",
message: "IQC web notifications are active.",
url: "/index.html"
});
return { permission };
}

function formatNotificationTime(value) {
if (!value) return "";
const date = new Date(value);
if (Number.isNaN(date.getTime())) return "";
return date.toLocaleString([], {
month: "short",
day: "2-digit",
hour: "2-digit",
minute: "2-digit"
});
}

async function fetchNotifications(limit = 40) {
const response = await fetch(API_BASE + "/notifications?limit=" + encodeURIComponent(limit));
if (!response.ok) throw new Error("notifications_fetch_failed");
return response.json();
}

async function markNotificationRead(id) {
const response = await fetch(API_BASE + "/notifications/" + encodeURIComponent(id) + "/read", {
method: "PATCH"
});
if (!response.ok) throw new Error("notification_read_failed");
return response.json();
}

async function markAllNotificationsRead() {
const response = await fetch(API_BASE + "/notifications/read", {
method: "PATCH"
});
if (!response.ok) throw new Error("notifications_read_failed");
return response.json();
}

function notificationActionClass(action) {
return ["created", "modified", "deleted", "approved"].includes(action) ? action : "updated";
}

function isIndexPage() {
const path = window.location.pathname.split("/").pop() || "index.html";
return path === "index.html";
}

function renderNotificationItems(listEl, notifications) {
listEl.innerHTML = "";

if (!notifications.length) {
const empty = document.createElement("div");
empty.className = "notification-empty";
empty.textContent = "No notifications yet.";
listEl.appendChild(empty);
return;
}

notifications.forEach(item => {
const button = document.createElement("button");
button.type = "button";
button.className = "notification-item" + (item.isRead ? "" : " unread");
button.dataset.notificationId = item.id;
button.dataset.url = item.url || "/index.html";

const marker = document.createElement("span");
marker.className = "notification-marker " + notificationActionClass(item.action);

const body = document.createElement("span");
body.className = "notification-body";

const title = document.createElement("strong");
title.textContent = item.title || "Notification";

const message = document.createElement("span");
message.textContent = item.message || "";

const meta = document.createElement("small");
meta.textContent = formatNotificationTime(item.createdAt);

body.append(title, message, meta);
button.append(marker, body);
listEl.appendChild(button);
});
}

function seenNotificationKey(sessionUser) {
return NOTIFICATION_SEEN_PREFIX + (sessionUser?.username || sessionUser?.emp || sessionUser?.name || "default");
}

function readSeenNotificationIds(sessionUser) {
const ids = safeJSONParse(window.localStorage.getItem(seenNotificationKey(sessionUser)), []);
return new Set(Array.isArray(ids) ? ids.map(String) : []);
}

function writeSeenNotificationIds(sessionUser, ids) {
window.localStorage.setItem(seenNotificationKey(sessionUser), JSON.stringify([...ids].slice(-300)));
}

async function showWebNotification(item) {
if (!item || item.isRead) return;

const options = {
body: item.message || "",
icon: "/img/app-icon-192.png",
badge: "/img/app-icon-192.png",
tag: "iqc:" + item.id,
renotify: true,
requireInteraction: false,
vibrate: [120, 60, 120],
data: { url: item.url || "/index.html" }
};

try {
if ("Notification" in window && Notification.permission === "granted" && "serviceWorker" in navigator && window.isSecureContext) {
const registration = await navigator.serviceWorker.ready;
await registration.showNotification(item.title || "IQC notification", options);
playNotificationSound();
return;
}

if ("Notification" in window && Notification.permission === "granted" && window.isSecureContext) {
const notification = new Notification(item.title || "IQC notification", options);
playNotificationSound();
notification.onclick = () => {
window.focus();
window.location.href = options.data.url;
notification.close();
};
return;
}

showNotificationToast(item);
} catch (error) {
console.warn("Unable to show web notification:", error);
showNotificationToast(item);
}
}

function showNotificationToast(item) {
if (!isIndexPage()) return;

let container = document.getElementById("notificationToastStack");
if (!container) {
container = document.createElement("div");
container.id = "notificationToastStack";
container.className = "notification-toast-stack";
document.body.appendChild(container);
}

const toast = document.createElement("button");
toast.type = "button";
toast.className = "notification-toast";
toast.innerHTML = `
<strong>${item.title || "IQC notification"}</strong>
<span>${item.message || ""}</span>
`;
toast.addEventListener("click", () => {
window.location.href = item.url || "/index.html";
});

container.appendChild(toast);
playNotificationSound();
window.setTimeout(() => {
toast.classList.add("leaving");
window.setTimeout(() => toast.remove(), 250);
}, 6500);
}

function playNotificationSound() {
try {
const AudioContextClass = window.AudioContext || window.webkitAudioContext;
if (!AudioContextClass) return;

const context = new AudioContextClass();
const gain = context.createGain();
gain.gain.setValueAtTime(0.0001, context.currentTime);
gain.gain.exponentialRampToValueAtTime(0.18, context.currentTime + 0.02);
gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.55);
gain.connect(context.destination);

const first = context.createOscillator();
first.type = "sine";
first.frequency.setValueAtTime(880, context.currentTime);
first.connect(gain);
first.start(context.currentTime);
first.stop(context.currentTime + 0.18);

const second = context.createOscillator();
second.type = "sine";
second.frequency.setValueAtTime(1175, context.currentTime + 0.18);
second.connect(gain);
second.start(context.currentTime + 0.18);
second.stop(context.currentTime + 0.42);

window.setTimeout(() => context.close().catch(() => {}), 700);
} catch (error) {
console.warn("Notification sound failed:", error);
}
}

async function notifyNewUnreadItems(notifications, sessionUser) {
const storageKey = seenNotificationKey(sessionUser);
if (!window.localStorage.getItem(storageKey)) {
const baselineIds = new Set(
notifications
.filter(item => item.id)
.map(item => String(item.id))
);
writeSeenNotificationIds(sessionUser, baselineIds);
return;
}

const seenIds = readSeenNotificationIds(sessionUser);
const nextSeenIds = new Set(seenIds);
const newItems = notifications
.filter(item => !item.isRead && item.id && !seenIds.has(String(item.id)))
.sort((left, right) => new Date(left.createdAt || 0) - new Date(right.createdAt || 0));

for (const item of newItems) {
nextSeenIds.add(String(item.id));
await showWebNotification(item);
}

if (newItems.length) writeSeenNotificationIds(sessionUser, nextSeenIds);
}

function initNotificationBell() {
const sessionUser = loadSession();
const topBar = document.querySelector(".top-bar");
if (!isIndexPage() || !topBar || !canReceivePushNotifications(sessionUser) || document.getElementById("notificationWidget")) return;

const widget = document.createElement("div");
widget.id = "notificationWidget";
widget.className = "notification-widget";
widget.innerHTML = `
<button id="notificationBell" class="notification-bell" type="button" aria-label="Notifications" aria-expanded="false">
<span class="notification-bell-icon" aria-hidden="true">&#128276;</span>
<span id="notificationBadge" class="notification-badge" hidden>0</span>
</button>
<div id="notificationBackdrop" class="notification-screen-backdrop" hidden></div>
<div id="notificationPanel" class="notification-panel" hidden>
<div class="notification-panel-head">
<div>
<strong>Notifications</strong>
<span>Recent activity</span>
</div>
<div class="notification-panel-actions">
<button id="notificationEnableWeb" type="button">Enable browser</button>
<button id="notificationInstallApp" type="button">Install app</button>
<button id="notificationMarkAll" type="button">Mark all read</button>
</div>
</div>
<div id="notificationList" class="notification-list"></div>
</div>
`;

const pageTitle = topBar.querySelector(".page-title");
if (pageTitle && pageTitle.nextSibling) {
topBar.insertBefore(widget, pageTitle.nextSibling);
} else {
topBar.appendChild(widget);
}

const bell = widget.querySelector("#notificationBell");
const badge = widget.querySelector("#notificationBadge");
const backdrop = widget.querySelector("#notificationBackdrop");
const panel = widget.querySelector("#notificationPanel");
const list = widget.querySelector("#notificationList");
const markAll = widget.querySelector("#notificationMarkAll");
const enableWeb = widget.querySelector("#notificationEnableWeb");
const installApp = widget.querySelector("#notificationInstallApp");

function setNotificationPanelOpen(isOpen) {
panel.hidden = !isOpen;
backdrop.hidden = !isOpen;
bell.setAttribute("aria-expanded", String(isOpen));
}

function updateWebButton() {
if (!enableWeb) return;
if (!window.isSecureContext) {
enableWeb.textContent = "HTTPS required";
enableWeb.disabled = true;
return;
}
if (!("Notification" in window) || !("PushManager" in window)) {
enableWeb.textContent = "Not supported";
enableWeb.disabled = true;
return;
}
if (Notification.permission === "granted") {
enableWeb.textContent = "Browser on";
enableWeb.disabled = true;
return;
}
if (Notification.permission === "denied") {
enableWeb.textContent = "Blocked";
enableWeb.disabled = true;
return;
}
enableWeb.textContent = "Enable browser";
enableWeb.disabled = false;
}

function updateInstallButton() {
if (!installApp) return;

if (isStandaloneApp()) {
installApp.textContent = "Installed";
installApp.disabled = true;
return;
}

if (deferredInstallPrompt) {
installApp.textContent = "Install app";
installApp.disabled = false;
return;
}

if (isIOSDevice()) {
installApp.textContent = "iOS steps";
installApp.disabled = false;
return;
}

installApp.textContent = "Install from menu";
installApp.disabled = false;
}

async function refresh() {
try {
const data = await fetchNotifications();
const notifications = data.notifications || [];
const unreadCount = Number(data.unreadCount || 0);
badge.textContent = unreadCount > 99 ? "99+" : String(unreadCount);
badge.hidden = unreadCount <= 0;
renderNotificationItems(list, notifications);
await notifyNewUnreadItems(notifications, sessionUser);
} catch (error) {
list.innerHTML = `<div class="notification-empty">Unable to load notifications.</div>`;
}
}

bell.addEventListener("click", async event => {
event.stopPropagation();
const isOpen = !panel.hidden;
setNotificationPanelOpen(!isOpen);
if (!isOpen) await refresh();
});

backdrop.addEventListener("click", event => {
event.stopPropagation();
setNotificationPanelOpen(false);
});

markAll.addEventListener("click", async event => {
event.stopPropagation();
await markAllNotificationsRead();
await refresh();
});

enableWeb.addEventListener("click", async event => {
event.stopPropagation();
enableWeb.disabled = true;
enableWeb.textContent = "Enabling...";
try {
await enableWebNotifications();
updateWebButton();
await refresh();
} catch (error) {
enableWeb.textContent = "Unavailable";
console.warn("Browser notifications could not be enabled:", error);
}
});

installApp.addEventListener("click", async event => {
event.stopPropagation();

if (deferredInstallPrompt) {
deferredInstallPrompt.prompt();
await deferredInstallPrompt.userChoice.catch(() => null);
deferredInstallPrompt = null;
updateInstallButton();
return;
}

if (typeof showAppAlert === "function") {
showAppAlert(mobileNotificationHelpMessage(), "info");
} else {
alert(mobileNotificationHelpMessage());
}
});

list.addEventListener("click", async event => {
const item = event.target.closest(".notification-item");
if (!item) return;
await markNotificationRead(item.dataset.notificationId);
window.location.href = item.dataset.url || "index.html";
});

document.addEventListener("click", event => {
if (!widget.contains(event.target)) {
setNotificationPanelOpen(false);
}
});

window.addEventListener("focus", refresh);
window.addEventListener("app-notifications-refresh", refresh);
window.addEventListener("app-install-available", updateInstallButton);
document.addEventListener("visibilitychange", () => {
if (!document.hidden) refresh();
});

refresh();
updateWebButton();
updateInstallButton();
window.setInterval(refresh, 30000);
}

function getDataset(name) {
if (!Object.prototype.hasOwnProperty.call(datasetState, name)) {
datasetState[name] = safeJSONParse(
window.localStorage.getItem(name),
getDefaultDataset(name)
);
}
return datasetState[name];
}

function setDatasetLocal(name, value) {
datasetState[name] = clone(value);
syncMuted = true;
try {
window.localStorage.setItem(name, JSON.stringify(datasetState[name]));
} finally {
syncMuted = false;
}
}

function bootstrapSync() {
try {
const xhr = new XMLHttpRequest();
xhr.open("GET", API_BASE + "/bootstrap", false);
xhr.send();

if (xhr.status >= 200 && xhr.status < 300) {
const response = JSON.parse(xhr.responseText || "{}");
const datasets = response.datasets || {};

TRACKED_KEYS.forEach(key => {
setDatasetLocal(key, Object.prototype.hasOwnProperty.call(datasets, key) ? datasets[key] : getDefaultDataset(key));
});
writePendingDatasets({});
notifySyncState();
return;
}
} catch (_) {
}

TRACKED_KEYS.forEach(key => {
getDataset(key);
});
retryPendingDatasetSyncs();
}

async function refreshDatasetFromServer(name) {
if (!TRACKED_KEYS.includes(name)) return getDefaultDataset(name);

const response = await fetch(API_BASE + "/datasets/" + encodeURIComponent(name));
if (!response.ok) {
throw new Error("dataset_refresh_failed");
}

const data = await response.json().catch(() => ({}));
const payload = Object.prototype.hasOwnProperty.call(data, "payload")
? data.payload
: getDefaultDataset(name);

setDatasetLocal(name, payload);
return payload;
}

function scheduleDatasetSync(key, options = {}) {
if (!TRACKED_KEYS.includes(key)) return Promise.resolve(null);

const immediate = Boolean(options.immediate);

clearTimeout(timers[key]);

pendingSyncs[key] = new Promise((resolve, reject) => {
timers[key] = setTimeout(async () => {
try {
const response = await fetch(API_BASE + "/datasets/" + encodeURIComponent(key), {
method: "PUT",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ payload: getDataset(key) })
});

if (!response.ok) {
const body = await response.json().catch(() => ({}));
const error = new Error(body.message || "dataset_sync_failed");
error.status = response.status;
throw error;
}

const result = await response.json().catch(() => null);
clearDatasetPending(key);
window.dispatchEvent(new CustomEvent("app-notifications-refresh"));
resolve(result);
} catch (error) {
console.warn("Dataset backend sync failed:", key, error);

if (isRetriableSyncError(error)) {
markDatasetPending(key);
resolve({ queued: true, name: key });
return;
}

reject(error);
} finally {
delete pendingSyncs[key];
delete timers[key];
}
}, immediate ? 0 : 250);
});

return pendingSyncs[key];
}

function retryPendingDatasetSyncs() {
getPendingDatasetNames().forEach(key => {
if (!pendingSyncs[key]) {
scheduleDatasetSync(key, { immediate: true }).catch(error => {
console.warn("Pending dataset sync failed:", key, error);
});
}
});
notifySyncState();
}

const originalSetItem = window.localStorage.setItem.bind(window.localStorage);
window.localStorage.setItem = function (key, value) {
originalSetItem(key, value);

if (!syncMuted && TRACKED_KEYS.includes(key)) {
datasetState[key] = safeJSONParse(value, getDefaultDataset(key));
markDatasetPending(key);
scheduleDatasetSync(key);
}
};

const originalRemoveItem = window.localStorage.removeItem.bind(window.localStorage);
window.localStorage.removeItem = function (key) {
originalRemoveItem(key);

if (!syncMuted && TRACKED_KEYS.includes(key)) {
datasetState[key] = getDefaultDataset(key);
markDatasetPending(key);
scheduleDatasetSync(key);
}
};

window.AppSession = {
get() {
return loadSession();
},
set(user) {
persistSession(user);
},
clear() {
clearSession();
}
};

window.AppStore = {
apiBase: API_BASE,
bootstrapSync,
getDataset(name) {
return getDataset(name);
},
setDataset(name, value) {
setDatasetLocal(name, value);
markDatasetPending(name);
return scheduleDatasetSync(name);
},
async syncDataset(name) {
if (!TRACKED_KEYS.includes(name)) return null;
return pendingSyncs[name] || scheduleDatasetSync(name, { immediate: true });
},
syncPending() {
retryPendingDatasetSyncs();
},
getPendingSyncs() {
return getPendingDatasetNames();
},
refreshDataset(name) {
return refreshDatasetFromServer(name);
},
async nextDatasetId(name) {
const response = await fetch(API_BASE + "/datasets/" + encodeURIComponent(name) + "/next-id");
if (!response.ok) throw new Error("dataset_serial_failed");
const data = await response.json().catch(() => ({}));
return data.id;
},
replaceRecord(name, index, value) {
const next = [...getDataset(name)];
next[index] = value;
return this.setDataset(name, next);
},
removeRecord(name, index) {
const next = [...getDataset(name)];
next.splice(index, 1);
return this.setDataset(name, next);
},
async login(username, password) {
const response = await fetch(API_BASE + "/auth/login", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ username, password })
});

if (!response.ok) {
throw new Error("invalid_credentials");
}

const data = await response.json();
return data.user;
}
};

window.AppBackend = {
apiBase: API_BASE,
bootstrapSync,
login: window.AppStore.login,
async listVendors() {
const response = await fetch(API_BASE + "/admin/vendors");
if (!response.ok) throw new Error("vendor_list_failed");
return response.json();
},
async createVendor(vendorName, password) {
const response = await fetch(API_BASE + "/admin/vendors", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ vendorName, password })
});
if (!response.ok) throw new Error("vendor_create_failed");
return response.json();
},
async updateVendorStatus(userId, isActive) {
const response = await fetch(API_BASE + "/admin/vendors/" + encodeURIComponent(userId) + "/status", {
method: "PATCH",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ isActive })
});
if (!response.ok) throw new Error("vendor_status_failed");
return response.json();
},
async updateVendorPassword(userId, password) {
const response = await fetch(API_BASE + "/admin/vendors/" + encodeURIComponent(userId) + "/password", {
method: "PATCH",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ password })
});
if (!response.ok) throw new Error("vendor_password_failed");
return response.json();
},
async adminReauth(password) {
const response = await fetch(API_BASE + "/admin/reauth", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ password })
});
if (!response.ok) throw new Error("admin_reauth_failed");
return response.json();
},
async resetVendorPassword(userId) {
const response = await fetch(API_BASE + "/admin/vendors/" + encodeURIComponent(userId) + "/reset-password", {
method: "POST"
});
if (!response.ok) throw new Error("vendor_reset_failed");
return response.json();
},
async listUsers() {
const response = await fetch(API_BASE + "/admin/users");
if (!response.ok) throw new Error("user_list_failed");
return response.json();
},
async createUser(payload) {
const response = await fetch(API_BASE + "/admin/users", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify(payload)
});
if (!response.ok) throw new Error("user_create_failed");
return response.json();
},
async updateUser(userId, payload) {
const response = await fetch(API_BASE + "/admin/users/" + encodeURIComponent(userId), {
method: "PATCH",
headers: { "Content-Type": "application/json" },
body: JSON.stringify(payload)
});
if (!response.ok) throw new Error("user_update_failed");
return response.json();
},
async resetUserPassword(userId) {
const response = await fetch(API_BASE + "/admin/users/" + encodeURIComponent(userId) + "/reset-password", {
method: "POST"
});
if (!response.ok) throw new Error("user_reset_failed");
return response.json();
},
async uploadUserPhoto(userId, file) {
const formData = new FormData();
formData.append("file", file, file.name);
const response = await fetch(API_BASE + "/admin/users/" + encodeURIComponent(userId) + "/photo", {
method: "POST",
body: formData
});
if (!response.ok) throw new Error("user_photo_failed");
return response.json();
},
listNotifications: fetchNotifications,
markNotificationRead,
markAllNotificationsRead,
enableWebNotifications
};

if (!window.AppAccess) {
const normalizeVendor = value => (value || "").trim().toUpperCase();
const FULL_ACCESS_ROLES = ["Admin", "Engineer"];
const READ_ONLY_INTERNAL_ROLES = ["Manager", "Director"];

window.AppAccess = {
isVendorSession(sessionUser) {
return Boolean(sessionUser && sessionUser.role === "Vendor");
},
isReadOnlyInternalSession(sessionUser) {
return Boolean(sessionUser && READ_ONLY_INTERNAL_ROLES.includes(sessionUser.role));
},
canAccessModule(sessionUser, moduleName) {
if (!sessionUser) return false;
if (sessionUser.role !== "Vendor") return true;
return ["incoming", "rtv"].includes(moduleName);
},
canEditModule(sessionUser) {
if (!sessionUser) return false;
if (FULL_ACCESS_ROLES.includes(sessionUser.role)) return true;
if (this.isVendorSession(sessionUser) || this.isReadOnlyInternalSession(sessionUser)) return false;
return ["Inspector", "Group Leader"].includes(sessionUser.role);
},
recordMatchesVendor(record, sessionUser) {
if (!sessionUser || sessionUser.role !== "Vendor") return true;
return record?.approvalStatus === "Approved"
&& normalizeVendor(record?.vendor) === normalizeVendor(sessionUser.vendorScope);
}
};
}

window.addEventListener("online", retryPendingDatasetSyncs);
window.addEventListener("focus", retryPendingDatasetSyncs);
document.addEventListener("visibilitychange", () => {
if (!document.hidden) retryPendingDatasetSyncs();
});
window.setInterval(retryPendingDatasetSyncs, 30000);

if ("serviceWorker" in navigator) {
window.addEventListener("load", () => {
navigator.serviceWorker.register("/sw.js").then(registration => {
initPushNotifications(registration);
}).catch(error => {
console.warn("Service worker registration failed:", error);
});
});
}

if (document.readyState === "loading") {
document.addEventListener("DOMContentLoaded", initNotificationBell);
} else {
initNotificationBell();
}

bootstrapSync();
})();
