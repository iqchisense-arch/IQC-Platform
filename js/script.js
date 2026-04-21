if (!window.APP_USERS_LOADED) {
window.APP_USERS_LOADED = true;

/* ================= LOGIN ================= */

function showLoginError(){
alert("Usuario o contrasena incorrectos");
}

/* ================= LOGOUT ================= */

function logout(){

if(window.AppSession){
window.AppSession.clear();
}else{
localStorage.removeItem("loggedUser");
localStorage.removeItem("inspector");
}

window.location.href="login.html";

}

/* ================= AUTH ================= */

function requireAuth(){

const data = window.AppSession ? JSON.stringify(window.AppSession.get()) : localStorage.getItem("loggedUser");

if(!data){
window.location.href="login.html";
return null;
}

return JSON.parse(data);

}

}

function isVendorSession(sessionUser){
return Boolean(sessionUser && sessionUser.role === "Vendor");
}

function isReadOnlyInternalSession(sessionUser){
return Boolean(sessionUser && ["Manager","Director"].includes(sessionUser.role));
}

function isAdminSession(sessionUser){
return Boolean(sessionUser && sessionUser.role === "Admin");
}

function isFullOperationSession(sessionUser){
return Boolean(sessionUser && ["Admin","Engineer"].includes(sessionUser.role));
}

function normalizeVendor(value){
return (value || "").trim().toUpperCase();
}

function canAccessModule(sessionUser, moduleName){
if(!sessionUser) return false;
if(!isVendorSession(sessionUser)) return true;
return ["incoming", "rtv"].includes(moduleName);
}

function canEditModule(sessionUser, moduleName){
if(!sessionUser) return false;
if(isFullOperationSession(sessionUser)) return true;
if(isVendorSession(sessionUser) || isReadOnlyInternalSession(sessionUser)) return false;
return ["Inspector","Group Leader"].includes(sessionUser.role);
}

function recordMatchesVendor(record, sessionUser){
if(!isVendorSession(sessionUser)) return true;
return normalizeVendor(record?.vendor) === normalizeVendor(sessionUser.vendorScope);
}

window.AppAccess = {
isVendorSession,
isReadOnlyInternalSession,
isAdminSession,
isFullOperationSession,
canAccessModule,
canEditModule,
recordMatchesVendor
};

/* ================= DASHBOARD ================= */

function renderActivityDashboard(){

const session = window.AppSession?.get() || JSON.parse(localStorage.getItem("loggedUser"));
if(!session) return;

const tbody = document.querySelector("#activityTable tbody");
if(!tbody) return;

tbody.innerHTML="";

/* ================= DATA ================= */

const incoming = window.AppStore ? window.AppStore.getDataset("incomingData") : (JSON.parse(localStorage.getItem("incomingData")) || []);
const box = window.AppStore ? window.AppStore.getDataset("boxData") : (JSON.parse(localStorage.getItem("boxData")) || []);
const daily = window.AppStore ? window.AppStore.getDataset("dailyData") : (JSON.parse(localStorage.getItem("dailyData")) || []);
const rtv = window.AppStore ? window.AppStore.getDataset("rtvData") : (JSON.parse(localStorage.getItem("rtvData")) || []);

/* ================= TAG ================= */

const tagged = [

...incoming.map(r=>({...r, module:"WMS"})),
...box.map(r=>({...r, module:"BOX INSPECTION"})),
...daily.map(r=>({...r, module:"DAILY INSPECTION"})),
...rtv.map(r=>({...r, module:"RTV"}))

];

/* ================= PERMISSIONS FILTER ================= */

function applyPermissions(data){

    const session = window.AppSession?.get() || JSON.parse(localStorage.getItem("loggedUser"));
    if(!session) return [];

    const role = session.role;

    const userName = (session.name || "").trim().toLowerCase();
    const userShift = (session.shift || "").trim();

    /* ===== ADMIN ===== */
    if(["Admin","Engineer","Manager","Director"].includes(role)){
        return data;
    }

    /* ===== GROUP LEADER ===== */
    if(role === "Group Leader"){
        return data.filter(r => {
            const shift = (r.shift || "").trim();
            return shift === userShift;
        });
    }

    /* ===== INSPECTOR (ðŸ”¥ FIX REAL) ===== */
    if(role === "Inspector"){
        return data.filter(r => {

            const inspector = (r.inspector || "").trim().toLowerCase();
            const shift = (r.shift || "").trim();

            return inspector === userName && shift === userShift;
        });
    }

    return [];
}

console.log("SESSION:", session);
console.log("DATA:", tagged);
/* ================= FILTER ================= */

const filtered = applyPermissions(tagged).filter(rec => {

    if(!rec.date) return false;

    const recordDate = new Date(rec.date);
    if(isNaN(recordDate)) return true; // no romper datos viejos

    const now = new Date();
    const shift = session.shift;

    let start = new Date(now);
    let end = new Date(now);

    if(shift === "T01"){
        start.setHours(6,0,0,0);
        end.setHours(17,0,0,0);
    }

    if(shift === "T02"){
        start.setHours(16,0,0,0);
        end.setHours(23,59,59,999);

        const nextDay = new Date(now);
        nextDay.setDate(now.getDate()+1);
        nextDay.setHours(1,0,0,0);

        return (recordDate >= start && recordDate <= end) ||
               (recordDate <= nextDay && recordDate.getHours() < 1);
    }

    return recordDate >= start && recordDate <= end;
});

}


function isSameShift(recordDate, shift){

    const now = new Date(recordDate);
    const hours = now.getHours();

    /* ===== T01 ===== (6:00 - 17:00) */
    if(shift === "T01"){
        return hours >= 6 && hours < 17;
    }

    /* ===== T02 ===== (16:00 - 01:00 next day) */
    if(shift === "T02"){
        return (hours >= 16 && hours <= 23) || (hours >= 0 && hours < 1);
    }

    return false;
}

function renderActivitySummary(){

    const summaryDiv = document.getElementById("activitySummary");
    if(!summaryDiv) return;

    const session = window.AppSession?.get() || JSON.parse(localStorage.getItem("loggedUser"));
    if(!session) return;

    const incoming = window.AppStore ? window.AppStore.getDataset("incomingData") : (JSON.parse(localStorage.getItem("incomingData")) || []);
    const box = window.AppStore ? window.AppStore.getDataset("boxData") : (JSON.parse(localStorage.getItem("boxData")) || []);
    const daily = window.AppStore ? window.AppStore.getDataset("dailyData") : (JSON.parse(localStorage.getItem("dailyData")) || []);
    const rtv = window.AppStore ? window.AppStore.getDataset("rtvData") : (JSON.parse(localStorage.getItem("rtvData")) || []);

    const tagged = [
        ...incoming.map(r=>({...r,module:"WMS"})),
        ...box.map(r=>({...r,module:"BOX"})),
        ...daily.map(r=>({...r,module:"DAILY"})),
        ...rtv.map(r=>({...r,module:"RTV"}))
    ];

    const filtered = tagged.filter(r=>{

        const role = session.role;
        const name = (session.name || "").trim().toLowerCase();
        const shift = session.shift;

        const recName = (r.inspector || "").trim().toLowerCase();
        const recShift = r.shift;

        /* ADMIN */
        if(["Admin","Engineer","Manager","Director"].includes(role)){
            return true;
        }

        /* GROUP LEADER */
        if(role === "Group Leader"){
            return recShift === shift;
        }

        /* INSPECTOR */
        if(role === "Inspector"){
            return recName === name && recShift === shift;
        }

        return false;
    });

    const counts = {
        RTV: filtered.filter(r=>r.module==="RTV").length,
        WMS: filtered.filter(r=>r.module==="WMS").length,
        BOX: filtered.filter(r=>r.module==="BOX").length,
        DAILY: filtered.filter(r=>r.module==="DAILY").length
    };

    const total = counts.RTV + counts.WMS + counts.BOX + counts.DAILY;

    summaryDiv.innerHTML = `
        <p>Total: <b>${total}</b></p>
        <p>RTV: <b>${counts.RTV}</b> | WMS: <b>${counts.WMS}</b></p>
        <p>BOX: <b>${counts.BOX}</b> | DAILY: <b>${counts.DAILY}</b></p>
    `;
}
function openActivityModal(){
    const modal = document.getElementById("activityModal");
    if(!modal) return;

    modal.style.display = "flex";

    renderActivityDashboard(); // ðŸ”¥ importante
}

function closeActivityModal(){
    const modal = document.getElementById("activityModal");
    if(!modal) return;

    modal.style.display = "none";
}
document.addEventListener("DOMContentLoaded", ()=>{

    loadInspectorInfo(); // ðŸ”¥ AGREGA ESTO

    if(typeof initCarousel === "function"){
        initCarousel();
    }

    const session = window.AppSession?.get() || JSON.parse(localStorage.getItem("loggedUser"));
    if(session && isVendorSession(session)){
        document.getElementById("cardBox")?.remove();
        document.getElementById("cardDaily")?.remove();
    }
    if(session && isAdminSession(session)){
        const adminToolsSection = document.getElementById("adminToolsSection");
        if(adminToolsSection) adminToolsSection.style.display = "";
    }

    const card = document.getElementById("activityCard");

    if(card){
        card.addEventListener("click", () => {
            console.log("CLICK CARD");
            openActivityModal();
        });
    }

});

function persistSession(sessionUser){

    if(window.AppSession){
        window.AppSession.set(sessionUser);
        return;
    }

    localStorage.setItem("loggedUser",JSON.stringify(sessionUser));
    localStorage.setItem("inspector",JSON.stringify({
        name:sessionUser.name,
        emp:sessionUser.emp,
        role:sessionUser.role,
        level:sessionUser.level,
        photo:sessionUser.photo
    }));

}

login = async function(){

    const username=document.getElementById("user").value.toLowerCase().trim();
    const pass=document.getElementById("pass").value;

    try{
        if(window.AppBackend){
            const sessionUser = await window.AppBackend.login(username, pass);
            persistSession(sessionUser);
            window.location.href="index.html";
            return;
        }
    }catch(err){
        console.warn("Backend login failed.", err);
        showLoginError();
        return;
    }

    showLoginError();
};
   


/* ================= INSPECTOR PANEL PRO ================= */

document.addEventListener("click", function(e){

    const panel = document.getElementById("inspectorPanel");
    const backdrop = document.getElementById("backdrop");

    const logo = e.target.closest("#logoBtn");
    const closeBtn = e.target.closest("#closeInspectorBtn");

    if(!panel) return;

    /* ===== OPEN PANEL ===== */
    if(logo){
        panel.classList.add("open");
        if(backdrop) backdrop.classList.add("show");
        return;
    }

    /* ===== CLOSE BUTTON ===== */
    if(closeBtn){
        panel.classList.remove("open");
        if(backdrop) backdrop.classList.remove("show");
        return;
    }

    /* ===== CLICK FUERA DEL PANEL ===== */
    const clickInsidePanel = e.target.closest("#inspectorPanel");

    if(panel.classList.contains("open") && !clickInsidePanel){
        panel.classList.remove("open");
        if(backdrop) backdrop.classList.remove("show");
    }

});
/* ================= LOAD INSPECTOR INFO ================= */

function loadInspectorInfo(){

    const data = window.AppSession ? JSON.stringify(window.AppSession.get()) : localStorage.getItem("loggedUser");
    if(!data) return;

    let user;

    try{
        user = JSON.parse(data);
    }catch{
        console.error("Invalid session data");
        return;
    }

    /* ===== SET DATA ===== */

    const nameEl = document.getElementById("u-name");
    const roleEl = document.getElementById("u-role");
    const empEl  = document.getElementById("u-emp");
    const levelEl= document.getElementById("u-level");
    const dateEl = document.getElementById("u-date");
    const avatar = document.getElementById("u-avatar");

    if(nameEl) nameEl.textContent = user.name || "-";
    if(roleEl) roleEl.textContent = user.role || "-";
    if(empEl)  empEl.textContent  = user.emp || "-";
    if(levelEl)levelEl.textContent= user.level || "-";
    if(dateEl) dateEl.textContent = user.date || "-";

    if(avatar){
        avatar.src = user.photo || "img/inspectores/default.png";

        avatar.onerror = () => {
            avatar.src = "img/inspectores/default.png";
        };
    }

}

document.addEventListener("DOMContentLoaded", ()=>{

    const session = window.AppSession?.get() || JSON.parse(localStorage.getItem("loggedUser"));
    if(!session) return;

    if(session.role === "Inspector"){

        document.querySelectorAll("[id*='export']").forEach(btn=>{
            btn.style.display = "none";
        });

    }

});


