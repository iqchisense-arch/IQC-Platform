const DB_NAME = "RTV_Photos_DB";
const STORE_NAME = "photos";
const PHOTO_SYNC_STORE = "pendingPhotoSync";
const DB_VERSION = 3;
const PHOTO_API_BASE =
    (window.AppBackend && window.AppBackend.apiBase) ||
    localStorage.getItem("appApiBase") ||
    ((window.location.origin && window.location.origin !== "null")
    ? window.location.origin + "/api"
    : "/api");

/* ================= OPEN DB ================= */

function openDB(){

return new Promise((resolve,reject)=>{

const request = indexedDB.open(DB_NAME, DB_VERSION);

request.onupgradeneeded = e=>{

const db = e.target.result;

if(!db.objectStoreNames.contains(STORE_NAME)){
db.createObjectStore(STORE_NAME);
}

if(!db.objectStoreNames.contains(PHOTO_SYNC_STORE)){
db.createObjectStore(PHOTO_SYNC_STORE, { keyPath:"key" });
}

};

request.onsuccess = ()=>resolve(request.result);
request.onerror = ()=>reject(request.error);

});

}

function idbRequest(request){
return new Promise((resolve,reject)=>{
request.onsuccess = ()=>resolve(request.result);
request.onerror = ()=>reject(request.error);
});
}

function txDone(tx){
return new Promise((resolve,reject)=>{
tx.oncomplete = ()=>resolve(true);
tx.onerror = ()=>reject(tx.error);
tx.onabort = ()=>reject(tx.error);
});
}

async function putPhotoLocal(key,file){

const db = await openDB();
const tx = db.transaction(STORE_NAME,"readwrite");
tx.objectStore(STORE_NAME).put(file,key);
await txDone(tx);
return true;

}

async function getPhotoLocal(key){

const db = await openDB();
const tx = db.transaction(STORE_NAME,"readonly");
return idbRequest(tx.objectStore(STORE_NAME).get(key));

}

async function deletePhotoLocal(key){

const db = await openDB();
const tx = db.transaction(STORE_NAME,"readwrite");
tx.objectStore(STORE_NAME).delete(key);
await txDone(tx);
return true;

}

async function markPhotoPending(entry){

const db = await openDB();
const tx = db.transaction(PHOTO_SYNC_STORE,"readwrite");
tx.objectStore(PHOTO_SYNC_STORE).put({
...entry,
updatedAt:new Date().toISOString()
});
await txDone(tx);
notifyPhotoSyncState();

}

async function clearPhotoPending(key){

const db = await openDB();
const tx = db.transaction(PHOTO_SYNC_STORE,"readwrite");
tx.objectStore(PHOTO_SYNC_STORE).delete(key);
await txDone(tx);
notifyPhotoSyncState();

}

async function getPendingPhotos(){

const db = await openDB();
const tx = db.transaction(PHOTO_SYNC_STORE,"readonly");
return idbRequest(tx.objectStore(PHOTO_SYNC_STORE).getAll());

}

async function notifyPhotoSyncState(){

try{
const pendingPhotos = await getPendingPhotos();
window.dispatchEvent(new CustomEvent("app-photo-sync-state", {
detail:{ pendingPhotos: pendingPhotos.map(item => item.key) }
}));
}catch(_){
}

}

async function uploadPhotoToBackend(key,file){

const formData = new FormData();
formData.append("file", file, file.name || `${key}.bin`);

const response = await fetch(`${PHOTO_API_BASE}/photos/${encodeURIComponent(key)}`,{
method:"POST",
body:formData
});

if(!response.ok){
const error = new Error("photo_upload_failed");
error.status = response.status;
throw error;
}

return response;

}

async function deletePhotoFromBackend(key){

const response = await fetch(`${PHOTO_API_BASE}/photos/${encodeURIComponent(key)}`,{
method:"DELETE"
});

if(!response.ok){
const error = new Error("photo_delete_failed");
error.status = response.status;
throw error;
}

return response;

}

function isPhotoRetryable(error){
return !error || !error.status || error.status >= 500;
}

/* ================= PHOTO SYNC QUEUE ================= */

async function syncPendingPhotos(){

const pending = await getPendingPhotos();

for(const entry of pending){
try{
if(entry.action === "delete"){
await deletePhotoFromBackend(entry.key);
await clearPhotoPending(entry.key);
continue;
}

const file = entry.file || await getPhotoLocal(entry.key);
if(!file){
await clearPhotoPending(entry.key);
continue;
}

await uploadPhotoToBackend(entry.key,file);
await clearPhotoPending(entry.key);
}catch(error){
console.warn("Pending photo sync failed:", entry.key, error);
if(!isPhotoRetryable(error)){
throw error;
}
}
}

}

/* ================= SAVE PHOTO ================= */

async function savePhoto(key,file){

await putPhotoLocal(key,file);
await markPhotoPending({ key, action:"upload", file });

try{
await uploadPhotoToBackend(key,file);
await clearPhotoPending(key);
}catch(err){
console.warn("Photo backend sync failed:", err);
if(!isPhotoRetryable(err)){
throw err;
}
}

return true;

}

/* ================= GET PHOTO ================= */

async function getPhoto(key){

if(!key) return null;

const localPhoto = await getPhotoLocal(key);
if(localPhoto) return localPhoto;

try{
const response = await fetch(`${PHOTO_API_BASE}/photos/${encodeURIComponent(key)}`);
if(!response.ok) return null;

const blob = await response.blob();
await putPhotoLocal(key, new File([blob], `${key}.bin`, { type: blob.type || "application/octet-stream" }));
return blob;
}catch(err){
console.warn("Photo fetch failed:", err);
return null;
}

}

/* ================= DELETE PHOTO ================= */

async function deletePhoto(key){

if(!key) return true;

await deletePhotoLocal(key);
await markPhotoPending({ key, action:"delete" });

try{
await deletePhotoFromBackend(key);
await clearPhotoPending(key);
}catch(err){
console.warn("Photo delete sync failed:", err);
if(!isPhotoRetryable(err)){
throw err;
}
}

return true;

}

/* ================= LOAD PHOTO INTO IMG ================= */

async function loadPhotoToImg(key,imgId){

const file = await getPhoto(key);
const img = document.getElementById(imgId);

if(!img) return;

if(file){
const url = URL.createObjectURL(file);
img.src = url;
}else{
img.src = "./img/no-photo.png";
}

}

window.AppPhotoSync = {
syncPendingPhotos,
getPendingPhotos
};

window.addEventListener("online", () => {
syncPendingPhotos().catch(error => console.warn("Photo sync retry failed:", error));
});
window.addEventListener("focus", () => {
syncPendingPhotos().catch(error => console.warn("Photo sync retry failed:", error));
});
document.addEventListener("visibilitychange", () => {
if(!document.hidden){
syncPendingPhotos().catch(error => console.warn("Photo sync retry failed:", error));
}
});
window.setInterval(() => {
syncPendingPhotos().catch(error => console.warn("Photo sync retry failed:", error));
}, 30000);

notifyPhotoSyncState();
syncPendingPhotos().catch(error => console.warn("Photo sync startup failed:", error));
