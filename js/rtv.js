console.log("RTV MODULE LOADED");

/* ================= SESSION ================= */

const session = window.AppSession?.get() || JSON.parse(localStorage.getItem("loggedUser"));
if (!session) window.location.href = "login.html";
if (window.AppAccess && !window.AppAccess.canAccessModule(session, "rtv")) {
window.location.href = "index.html";
}

/* ================= IMAGE CONVERTER ================= */

function fileToBase64(file){

return new Promise((resolve,reject)=>{

if(!file){
resolve("");
return;
}

const reader = new FileReader();

reader.onload = () => resolve(reader.result);
reader.onerror = error => reject(error);

reader.readAsDataURL(file);

});

}

/* ================= PART DATABASE ================= */

let PART_DATABASE = {};
let PARTS_READY = false;

fetch("data/parts.json")
.then(res=>res.json())
.then(data=>{

data.forEach(p=>{

PART_DATABASE[p.PartNumber.trim().toUpperCase()] =
p.Description.trim();

});

PARTS_READY = true;

})
.catch(err=>{
console.warn("Parts database error:",err);
});

/* ================= CONFIG ================= */

const RTV_VENDORS=[
"JETAI",
"KB FOAM",
"SONOCO",
"BREADY",
"MACROLUCK",
"STANLEY",
"PROVEM",
"TIJUANA PALLETS",
"BC INDUSTRIAL",
"ELEMEK",
"ADI - KB FOAM",
"MYS"
];
/* ================= VENDOR CODES ================= */

const VENDOR_CODES = {

"JETAI":"JT",
"KB FOAM":"KB",
"SONOCO":"SCO",
"BREADY":"BD",
"MACROLUCK":"MLK",
"STANLEY":"ST",
"PROVEM":"PR",
"TIJUANA PALLETS":"TJP",
"BC INDUSTRIAL":"BCI",
"ELEMEK":"EMK",
"ADI - KB FOAM":"ADI",
"MYS":"MYS"

};

/* ================= RTV PROCESS BY VENDOR ================= */

const RTV_PROCESS = {

"JETAI":"RTV-REPLACEMENT PROCESS / RETURN TO VENDOR",
"KB FOAM":"RTV-RMA PROCESS / RETURN TO VENDOR",
"BREADY":"RTV-REPLACEMENT PROCESS / RETURN TO VENDOR",
"MACROLUCK":"RTV-REPLACEMENT PROCESS / RETURN TO VENDOR",
"STANLEY":"RTV-REPLACEMENT PROCESS / RETURN TO VENDOR",
"SONOCO":"RTV-RMA PROCESS / RETURN TO VENDOR",
"PROVEM":"RTV-REPLACEMENT PROCESS / RETURN TO VENDOR",
"TIJUANA PALLETS":"RTV-REPLACEMENT PROCESS / RETURN TO VENDOR",
"MYS":"RTV-REPLACEMENT PROCESS / RETURN TO VENDOR",
"ELEMEK":"RTV-REPLACEMENT PROCESS / RETURN TO VENDOR"

};

const RTV_LINES=[
"WH","L1","L2","L3","L4","L5",
"L6","L7","L8","L9","L10",
"L11","L12","L13","L14","L15"
];

const DEFECT_LIST=[
"Wet","Broken","Wrong part number","No label","Stained",
"Bad packing","Out of dimension","Bad cut","Particle","Print missing","Inverted print","Fugust",
"Electric damage BGA","Friction marks","Bent","Electric damage (no audio)","Scratch" 
];

/* ================= STORAGE ================= */

function getRTVData(){
return window.AppStore ? window.AppStore.getDataset("rtvData") : (JSON.parse(localStorage.getItem("rtvData")) || []);
}

function saveRTVData(data){
return window.AppStore ? window.AppStore.setDataset("rtvData", data) : localStorage.setItem("rtvData",JSON.stringify(data));
}

/* ================= SERIAL ================= */
function generateRTVSerial(vendor){

const data = getRTVData();

const today = new Date();

const year = today.getFullYear().toString().slice(-2);
const month = String(today.getMonth()+1).padStart(2,"0");

const prefix = `RTV${year}${month}`;

const vendorCode = VENDOR_CODES[vendor?.trim().toUpperCase()] || "XX";

/* buscar RTV del mismo mes y proveedor */

const filtered = data.filter(r => 
r.id.startsWith(prefix) && r.id.endsWith(`-${vendorCode}`)
);

/* calcular consecutivo */

let max = 0;

filtered.forEach(r => {

const match = r.id.match(/RTV\d{4}-(\d{3})-/);

if(match){
const num = parseInt(match[1]);
if(num > max) max = num;
}

});

const next = String(max + 1).padStart(3,"0");

return `${prefix}-${next}-${vendorCode}`;

}

/* ================= START ================= */

document.addEventListener("DOMContentLoaded",()=>{

const addRTVBtn=document.getElementById("addRTV");
const modal=document.getElementById("rtvModal");
const saveBtn=document.getElementById("saveRTV");
const cancelBtn=document.getElementById("cancelRTV");
const list=document.getElementById("rtvList");

const vendorInput=document.getElementById("vendorInput");
const lineInput=document.getElementById("lineInput");

const partsContainer=document.getElementById("partsContainer");
const addPartBtn=document.getElementById("addPartBtn");

const exportBtn=document.getElementById("exportRTVBtn");

const gridBtn=document.getElementById("gridViewBtn");
const listBtn=document.getElementById("listViewBtn");
const vendorFilter=document.getElementById("rtvVendorFilter");
const userFilter=document.getElementById("rtvUserFilter");
const dateFromFilter=document.getElementById("rtvDateFrom");
const dateToFilter=document.getElementById("rtvDateTo");
const clearFiltersBtn=document.getElementById("clearRTVFilters");

const closeCreated = document.getElementById("closeRTVCreated");

if(closeCreated){
closeCreated.onclick = ()=>{
document.getElementById("rtvCreatedModal").style.display = "none";
closeCreated.textContent = "OK";
};
}

const closeInvalid = document.getElementById("closeInvalidPart");

if(closeInvalid){
closeInvalid.onclick = ()=>{
document.getElementById("invalidPartModal").style.display = "none";
};
}

/* ================= LOAD DROPDOWNS ================= */

function loadDropdowns(){

vendorInput.innerHTML=`<option value="">Select Vendor</option>`;
lineInput.innerHTML=`<option value="">Select Line</option>`;

RTV_VENDORS.forEach(v=>{
vendorInput.innerHTML+=`<option value="${v}">${v}</option>`;
});

RTV_LINES.forEach(l=>{
lineInput.innerHTML+=`<option value="${l}">${l}</option>`;
});

}

loadDropdowns();

/* ================= VIEW ================= */

let currentView=localStorage.getItem("rtvView") || "grid";
/* APPLY SAVED VIEW */

if(currentView === "grid"){

gridBtn.classList.add("active");
listBtn.classList.remove("active");

}else{

listBtn.classList.add("active");
gridBtn.classList.remove("active");

}

gridBtn.onclick=()=>{

currentView="grid";
localStorage.setItem("rtvView","grid");

gridBtn.classList.add("active");
listBtn.classList.remove("active");

renderRTV();

};

listBtn.onclick=()=>{

currentView="list";
localStorage.setItem("rtvView","list");

listBtn.classList.add("active");
gridBtn.classList.remove("active");

renderRTV();

};

/* ================= PERMISSIONS FILTER ================= */

function filterRTVByUser(data){

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
        return data.filter(r =>
            (r.shift || "").trim() === userShift
        );
    }

    /* ===== INSPECTOR 🔥 */
    if(role === "Inspector"){
        return data.filter(r => {

            const inspector = (r.inspector || "").trim().toLowerCase();
            const shift = (r.shift || "").trim();

            return inspector === userName && shift === userShift;
        });
    }

    if(role === "Vendor"){
        return data.filter(r => window.AppAccess ? window.AppAccess.recordMatchesVendor(r, session) : true);
    }

    return [];
}

function parseRecordDate(value){
const parsed = value ? new Date(value) : null;
return parsed && !isNaN(parsed) ? parsed : null;
}

function applyRTVFilters(data){
const vendorValue = vendorFilter?.value || "";
const userValue = userFilter?.value || "";
const fromValue = dateFromFilter?.value || "";
const toValue = dateToFilter?.value || "";

return data.filter(rtv => {
if(vendorValue && rtv.vendor !== vendorValue) return false;
if(userValue && rtv.inspector !== userValue) return false;

const recordDate = parseRecordDate(rtv.date);
if(fromValue && recordDate){
const fromDate = new Date(fromValue + "T00:00:00");
if(recordDate < fromDate) return false;
}
if(toValue && recordDate){
const toDate = new Date(toValue + "T23:59:59");
if(recordDate > toDate) return false;
}

return true;
});
}

function populateRTVFilterOptions(data){
if(vendorFilter){
const current = vendorFilter.value;
const vendors = [...new Set(data.map(item => item.vendor).filter(Boolean))].sort();
vendorFilter.innerHTML = `<option value="">All vendors</option>` + vendors.map(v => `<option value="${v}">${v}</option>`).join("");
vendorFilter.value = vendors.includes(current) ? current : "";
}

if(userFilter){
const current = userFilter.value;
const users = [...new Set(data.map(item => item.inspector).filter(Boolean))].sort();
userFilter.innerHTML = `<option value="">All inspectors</option>` + users.map(v => `<option value="${v}">${v}</option>`).join("");
userFilter.value = users.includes(current) ? current : "";
}
}

/* ================= RENDER ================= */

function renderRTV(){

list.innerHTML="";

const rawData = getRTVData();
const visibleData = filterRTVByUser(rawData);
populateRTVFilterOptions(visibleData);
const data = applyRTVFilters(visibleData);

if(data.length===0){

list.innerHTML="<h2 style='text-align:center'>No RTV records yet</h2>";
return;

}

const reversed=[...data].reverse();

if(currentView==="grid"){

reversed.forEach((rtv,index)=>{

const realIndex=rawData.findIndex(item => item.id === rtv.id);

const card=document.createElement("div");
card.className="rtv-card";

card.innerHTML=`
<div class="rtv-card-title">${rtv.id}</div>

<div class="rtv-card-row">
<span class="label">Vendor:</span> ${rtv.vendor}
</div>

<div class="rtv-card-row">
<span class="label">Line:</span> ${rtv.line}
</div>

<div class="rtv-card-row">
<span class="label">Pieces:</span> ${rtv.parts.reduce((t,p)=>t+p.qty,0)}
</div>

<div class="rtv-card-row">
<span class="label">Inspector:</span> ${rtv.inspector}
</div>

<div class="rtv-card-row">
<span class="label">Date:</span> ${rtv.date}
</div>

<div class="rtv-card-row">
<span class="label">Approval:</span> ${rtv.approvalStatus === "Approved" ? "Approved" : "Pending"}
</div>
`;

card.onclick=()=>{
localStorage.setItem("currentRTV",realIndex);
window.location.href="rtv-detail.html";
};

list.appendChild(card);

});

return;

}

/* LIST VIEW */

const table=document.createElement("table");

table.className="rtv-table";

table.innerHTML=`
<thead>
<tr>
<th>RTV</th>
<th>Vendor</th>
<th>Line</th>
<th>Total Pieces</th>
<th>Inspector</th>
<th>Date</th>
<th>Approval</th>
</tr>
</thead>
<tbody></tbody>
`;

const tbody=table.querySelector("tbody");

reversed.forEach((rtv,index)=>{

const realIndex=rawData.findIndex(item => item.id === rtv.id);

const row=document.createElement("tr");

row.innerHTML=`
<td><strong>${rtv.id}</strong></td>
<td>${rtv.vendor}</td>
<td>${rtv.line}</td>
<td>${rtv.parts.reduce((t,p)=>t+p.qty,0)}</td>
<td>${rtv.inspector}</td>
<td>${rtv.date}</td>
<td>${rtv.approvalStatus === "Approved" ? "Approved" : "Pending"}</td>
`;

row.onclick=()=>{
localStorage.setItem("currentRTV",realIndex);
window.location.href="rtv-detail.html";
};

tbody.appendChild(row);

});

list.appendChild(table);

}

renderRTV();

[vendorFilter, userFilter, dateFromFilter, dateToFilter].forEach(el => {
el?.addEventListener("change", renderRTV);
});

clearFiltersBtn?.addEventListener("click", ()=>{
if(vendorFilter) vendorFilter.value = "";
if(userFilter) userFilter.value = "";
if(dateFromFilter) dateFromFilter.value = "";
if(dateToFilter) dateToFilter.value = "";
renderRTV();
});

if(window.AppAccess && !window.AppAccess.canEditModule(session, "rtv")){
    if(addRTVBtn) addRTVBtn.style.display = "none";
    if(exportBtn) exportBtn.style.display = "none";
}

/* ================= PART SYSTEM ================= */

let partCount=0;
const MAX_PARTS=6;

function addPartBlock(){

if(partCount>=MAX_PARTS){
alert("Maximum 6 parts per RTV");
return;
}

partCount++;

const defectOptions=DEFECT_LIST.map(d=>`<option>${d}</option>`).join("");

const div=document.createElement("div");

div.className="part-block";

div.innerHTML=`

<div class="form-grid">

<div class="form-box">
<label>Part Number</label>
<input type="text" class="partNumber">
</div>

<div class="form-box">
<label>Description</label>
<input type="text" class="description" disabled>
</div>

<div class="form-box">
<label>Defect</label>
<select class="defect">
<option value="">Select defect</option>
${defectOptions}
</select>
</div>

<div class="form-box">
<label>Quantity</label>
<input type="number" class="qty" min="1">
</div>

</div>
`;

partsContainer.appendChild(div);

/* ================= AUTO DESCRIPTION FIX ================= */

const pnInput=div.querySelector(".partNumber");
const descInput=div.querySelector(".description");

pnInput.addEventListener("keyup",()=>{
pnInput.classList.remove("invalid-part");

const pn=pnInput.value.trim().toUpperCase();

if(!pn){
descInput.value="";
return;
}

if(PART_DATABASE[pn]){
descInput.value=PART_DATABASE[pn];
}else{
descInput.value="";
}

});

}

/* ADD PART */

addPartBtn.onclick=()=>addPartBlock();

/* OPEN MODAL */

addRTVBtn.onclick=()=>{

modal.classList.add("show");

partsContainer.innerHTML="";
partCount=0;

vendorInput.value="";
lineInput.value="";

document.getElementById("photoPart").value="";
document.getElementById("photoMaterial").value="";
document.getElementById("photoIssue").value="";

addPartBlock();

};

/* CLOSE */

cancelBtn.onclick=()=>{
modal.classList.remove("show");
};

/* ================= SAVE RTV ================= */

saveBtn.onclick = async () => {

if(!vendorInput.value || !lineInput.value){
alert("Select Vendor and Line");
return;
}

const parts=[];

let invalidPartDetected = false;
let invalidInput = null;

const blocks = document.querySelectorAll(".part-block");

for(const block of blocks){

const pnInput = block.querySelector(".partNumber");

const pn = pnInput.value.trim().toUpperCase();
const desc = block.querySelector(".description").value;
const defect = block.querySelector(".defect").value;
const qty = parseInt(block.querySelector(".qty").value);

/* LOCK VALIDATION */

if(pn && !PART_DATABASE[pn]){

invalidPartDetected = true;
invalidInput = pnInput;

pnInput.classList.add("invalid-part");

break;

}

if(pn && qty){

parts.push({
partNumber:pn,
description:desc,
defect:defect,
qty:qty
});

}

}

/* STOP COMPLETELY IF INVALID */

if(invalidPartDetected){

showInvalidPartAlert();

setTimeout(()=>{
invalidInput.focus();
},200);

return;

}

if(parts.length===0){
showInvalidPartAlert();
return;
}


/* ================= GENERATE RTV ID ================= */

const rtvID = generateRTVSerial(vendorInput.value);

/* ================= FILE INPUTS ================= */

const partFile=document.getElementById("photoPart").files[0];
const materialFile=document.getElementById("photoMaterial").files[0];
const issueFile=document.getElementById("photoIssue").files[0];

/* ================= CREATE PHOTO KEYS ================= */

let partKey=null;
let materialKey=null;
let issueKey=null;

/* ================= SAVE PHOTOS ================= */

if(partFile){
partKey=`part_${rtvID}`;
await savePhoto(partKey,partFile);
}

if(materialFile){
materialKey=`material_${rtvID}`;
await savePhoto(materialKey,materialFile);
}

if(issueFile){
issueKey=`issue_${rtvID}`;
await savePhoto(issueKey,issueFile);
}

/* ================= SAVE DATA ================= */

const data=getRTVData();

const newRTV = {

id:rtvID,
vendor:vendorInput.value,
process:RTV_PROCESS[vendorInput.value] || "RTV PROCESS / RETURN TO VENDOR",
line:lineInput.value,
inspector:session.name,
shift:session.shift,
date:new Date().toLocaleString(),
dateISO:new Date().toISOString(),
approvalStatus:"Pending",
approvedBy:"",
approvedRole:"",
approvedAt:"",

parts:parts,

photos:{
part:partKey,
material:materialKey,
issue:issueKey
}

};

data.push(newRTV);

await saveRTVData(data);

modal.classList.remove("show");

renderRTV();

/* SHOW CREATED MODAL */

const createdModal = document.getElementById("rtvCreatedModal");
const createdNumber = document.getElementById("rtvCreatedNumber");

createdNumber.textContent = `Control Number: ${rtvID}`;

createdModal.style.display = "flex";

if(closeCreated){
closeCreated.textContent = "OK";
}

};

/* ================= EXPORT ================= */

exportBtn.onclick = () => {

const rawData = getRTVData();
const data = applyRTVFilters(filterRTVByUser(rawData));

if(data.length === 0){
showAppAlert("No RTV data available to export","warning");
return;
}

const rows = [];

/* ===== HELPER FUNCTIONS ===== */

function getWeekNumber(date){

const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
const dayNum = d.getUTCDay() || 7;

d.setUTCDate(d.getUTCDate() + 4 - dayNum);

const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));

return Math.ceil((((d - yearStart) / 86400000) + 1)/7);

}

function getMonthName(date){

return date.toLocaleString("en-US",{month:"long"});

}

function parseInspectionDate(value, fallbackId){
if(value instanceof Date && !isNaN(value)) return value;

if(value){
const nativeDate = new Date(value);
if(!isNaN(nativeDate)) return nativeDate;

const match = String(value).match(/(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})(?:[,\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?/i);
if(match){
let first = Number(match[1]);
let second = Number(match[2]);
let year = Number(match[3]);
let hour = Number(match[4] || 0);
const minute = Number(match[5] || 0);
const secondValue = Number(match[6] || 0);
const meridian = (match[7] || "").toUpperCase();

if(year < 100) year += 2000;
if(meridian === "PM" && hour < 12) hour += 12;
if(meridian === "AM" && hour === 12) hour = 0;

let day = first;
let month = second;

if(second > 12 && first <= 12){
month = first;
day = second;
}

const parsed = new Date(year, month - 1, day, hour, minute, secondValue);
if(!isNaN(parsed)) return parsed;
}
}

const idMatch = String(fallbackId || "").match(/^(?:RTV|WMS|BOX|DR)(\d{2})(\d{2})/i);
if(idMatch){
const year = 2000 + Number(idMatch[1]);
const month = Number(idMatch[2]);
const parsed = new Date(year, month - 1, 1);
if(!isNaN(parsed)) return parsed;
}

return new Date();
}

function formatExportDate(date){
return date.toLocaleDateString("en-US", {
year:"numeric",
month:"2-digit",
day:"2-digit"
});
}

/* ===== BUILD EXCEL DATA ===== */

data.forEach(rtv => {

const rtvDate = parseInspectionDate(rtv.dateISO || rtv.date, rtv.id);

const week = getWeekNumber(rtvDate);
const month = getMonthName(rtvDate);

rtv.parts.forEach(part => {

rows.push({

Date: formatExportDate(rtvDate),

Week: week,

Month: month,

"Part number": part.partNumber,

Description: part.description,

QTY: part.qty,

Defect: part.defect,

"RTV number": rtv.id,

Inspector: rtv.inspector,

Line: rtv.line,

Vendor: rtv.vendor

});

});

});

const worksheet=XLSX.utils.json_to_sheet(rows);
const workbook=XLSX.utils.book_new();

XLSX.utils.book_append_sheet(workbook,worksheet,"RTV");

XLSX.writeFile(workbook,"RTV_Report.xlsx");

};

});

function showInvalidPartAlert(){

const modal = document.getElementById("invalidPartModal");

if(modal){
modal.style.display = "flex";
}

}

