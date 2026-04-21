/* =========================================
   UNIVERSAL APP ALERT SYSTEM
========================================= */

(function(){
let modalReady = false;

function ensureAlertModal(){
if(modalReady) return;
if(!document.body) return;

if(!document.getElementById("appAlertModal")){
const modal = document.createElement("div");
modal.id = "appAlertModal";
modal.className = "app-alert-modal";
modal.innerHTML = `
<div class="app-alert-content">
    <div id="appAlertIcon" class="app-alert-icon"></div>
    <h2 id="appAlertTitle" class="app-alert-title"></h2>
    <p id="appAlertMessage" class="app-alert-message"></p>
    <div id="appAlertActions" class="app-alert-actions"></div>
</div>
`;

document.body.appendChild(modal);
}

if(!document.getElementById("appAlertStyles")){
const style = document.createElement("style");
style.id = "appAlertStyles";
style.textContent = `
.app-alert-modal{
position:fixed;
inset:0;
display:none;
align-items:center;
justify-content:center;
padding:16px;
background:#0b1220;
z-index:60000;
}

.app-alert-modal.show{
display:flex;
}

.app-alert-content{
width:min(100%, 420px);
padding:28px;
border-radius:18px;
text-align:center;
background:linear-gradient(180deg,#020617,#0f172a);
color:#e5e7eb;
box-shadow:0 20px 50px rgba(0,0,0,.45);
border:1px solid #1e293b;
animation:appAlertIn .22s ease;
}

.app-alert-icon{
font-size:38px;
line-height:1;
margin-bottom:12px;
}

.app-alert-title{
margin:0 0 10px;
font-size:22px;
font-weight:700;
}

.app-alert-message{
margin:0;
line-height:1.5;
white-space:pre-line;
color:#dbe4f0;
}

.app-alert-actions{
display:flex;
gap:12px;
justify-content:center;
margin-top:22px;
flex-wrap:wrap;
}

.app-alert-btn{
min-width:120px;
padding:12px 18px;
border:none;
border-radius:12px;
font-weight:600;
cursor:pointer;
transition:.2s;
color:#fff;
}

.app-alert-btn:hover{
transform:translateY(-1px);
}

.app-alert-btn.primary{
background:linear-gradient(135deg,#14b8a6,#0f766e);
box-shadow:0 6px 18px rgba(0,0,0,.25);
}

.app-alert-btn.secondary{
background:#374151;
box-shadow:0 4px 12px rgba(0,0,0,.25);
}

.app-alert-btn.danger{
background:linear-gradient(135deg,#ef4444,#b91c1c);
box-shadow:0 6px 18px rgba(0,0,0,.25);
}

@keyframes appAlertIn{
from{opacity:0;transform:scale(.94)}
to{opacity:1;transform:scale(1)}
}

@media (max-width:480px){
.app-alert-content{
padding:22px 18px;
border-radius:16px;
}

.app-alert-actions{
flex-direction:column;
}

.app-alert-btn{
width:100%;
}
}
`;
document.head.appendChild(style);
}

modalReady = true;
}

function closeAlertModal(){
const modal = document.getElementById("appAlertModal");
if(modal){
modal.classList.remove("show");
}
}

window.showAppAlert = function(message, type="info"){
ensureAlertModal();

const modal = document.getElementById("appAlertModal");
const title = document.getElementById("appAlertTitle");
const text = document.getElementById("appAlertMessage");
const icon = document.getElementById("appAlertIcon");
const actions = document.getElementById("appAlertActions");

if(!modal || !title || !text || !icon || !actions) return;

text.textContent = message;
actions.innerHTML = `<button id="appAlertOK" class="app-alert-btn primary">OK</button>`;

if(type==="success"){
icon.textContent="✓";
title.textContent="Success";
}
else if(type==="error"){
icon.textContent="✕";
title.textContent="Error";
}
else if(type==="warning"){
icon.textContent="⚠";
title.textContent="Warning";
}
else{
icon.textContent="i";
title.textContent="Notification";
}

modal.classList.add("show");

document.getElementById("appAlertOK").onclick = closeAlertModal;
};

window.showAppConfirm = function(message, callback, options = {}){
ensureAlertModal();

const modal = document.getElementById("appAlertModal");
const title = document.getElementById("appAlertTitle");
const text = document.getElementById("appAlertMessage");
const icon = document.getElementById("appAlertIcon");
const actions = document.getElementById("appAlertActions");

if(!modal || !title || !text || !icon || !actions) return;

icon.textContent = options.icon || "?";
title.textContent = options.title || "Confirmation";
text.textContent = message;
actions.innerHTML = `
<button id="confirmCancel" class="app-alert-btn secondary">${options.cancelLabel || "Cancel"}</button>
<button id="confirmOK" class="app-alert-btn ${options.danger ? "danger" : "primary"}">${options.confirmLabel || "Confirm"}</button>
`;

modal.classList.add("show");

document.getElementById("confirmCancel").onclick = closeAlertModal;
document.getElementById("confirmOK").onclick = async ()=>{
closeAlertModal();
if(typeof callback === "function"){
await callback();
}
};
};

const originalAlert = window.alert ? window.alert.bind(window) : null;
window.__nativeAlert = originalAlert;

window.alert = function(message){
if(document.body){
showAppAlert(String(message ?? ""), "warning");
return;
}

if(originalAlert){
originalAlert(message);
}
};

if(document.readyState === "loading"){
document.addEventListener("DOMContentLoaded", ensureAlertModal, { once:true });
} else {
ensureAlertModal();
}
})();
