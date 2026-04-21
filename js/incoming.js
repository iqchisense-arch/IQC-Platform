console.log("WMS MODULE LOADED");

/* ================= SESSION ================= */

const session = window.AppSession?.get() || JSON.parse(localStorage.getItem("loggedUser"));
if (!session) window.location.href = "login.html";
if (window.AppAccess && !window.AppAccess.canAccessModule(session, "incoming")) {
window.location.href = "index.html";
}

/* ================= PART DATABASE ================= */

let PART_DATABASE = {};
let PARTS_READY = false;

fetch("data/parts.json")
.then(res => res.json())
.then(data => {

data.forEach(p => {
PART_DATABASE[p.PartNumber.trim().toUpperCase()] = p.Description.trim();
});

PARTS_READY = true;

});

/* ================= DROPDOWNS ================= */

const VENDORS = [
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
"TARIMAS DEL VALLE",
"HUMAN INDUSTRIAL INC",
"CENSA",
"ANKAI"
];

const DEFECTS = [
"Out of dimension",
"Wrong part number",
"Wrong label",
"Damaged",
"Uneven",
"Burr",
"Contaminated",
"Stained",
"Particle",
"Scratch",
"Missing stamp",
"Fugust",
"Broken",
"Bad cut",
"Wet",
"Dirty",
"Bad packing",
"Print missing",
"Inverted print"
];

/* ================= STORAGE ================= */

function getIncomingData(){
return window.AppStore ? window.AppStore.getDataset("incomingData") : (JSON.parse(localStorage.getItem("incomingData")) || []);
}

function saveIncomingData(data){
return window.AppStore ? window.AppStore.setDataset("incomingData", data) : localStorage.setItem("incomingData", JSON.stringify(data));
}

async function getFreshIncomingData(){
return window.AppStore?.refreshDataset ? await window.AppStore.refreshDataset("incomingData") : getIncomingData();
}

async function getNextIncomingSerial(){
return window.AppStore?.nextDatasetId ? await window.AppStore.nextDatasetId("incomingData") : generateIncomingSerial();
}

/* ================= SUPPLIER QUALITY ENGINE ================= */

function getSupplierQuality(){
return window.AppStore ? window.AppStore.getDataset("supplierQualityData") : (JSON.parse(localStorage.getItem("supplierQualityData")) || {});
}

function saveSupplierQuality(data){
return window.AppStore ? window.AppStore.setDataset("supplierQualityData", data) : localStorage.setItem("supplierQualityData", JSON.stringify(data));
}

function getSupplierState(vendor){

const db = getSupplierQuality();

if(!db[vendor]){

db[vendor] = {
level:"NORMAL",
consecutiveNG:0,
consecutiveOK:0
};

saveSupplierQuality(db);

}

return db[vendor];

}

/* =================================================
   SUPPLIER QUALITY LEARNING ENGINE
================================================= */

function updateSupplierLevel(vendor, judge){

const db = getSupplierQuality();
const supplier = getSupplierState(vendor);

if(judge === "NG"){

supplier.consecutiveNG++;
supplier.consecutiveOK = 0;

}else{

supplier.consecutiveOK++;
supplier.consecutiveNG = 0;

}

if(supplier.level === "NORMAL" && supplier.consecutiveNG >= 3){

supplier.level = "TIGHTENED";
supplier.consecutiveNG = 0;

alert(vendor + " moved to TIGHTENED inspection 🔺");

}

if(supplier.level === "TIGHTENED" && supplier.consecutiveOK >= 5){

supplier.level = "NORMAL";
supplier.consecutiveOK = 0;

alert(vendor + " returned to NORMAL inspection 🔻");

}

db[vendor] = supplier;

saveSupplierQuality(db);

}

/* ================= SAMPLE SIZE ================= */

function getSampleSize(lotQty){

lotQty = Number(lotQty);

if(!lotQty) return "";

if(lotQty <= 2) return lotQty;
if(lotQty <= 15) return 2;
if(lotQty <= 25) return 3;
if(lotQty <= 90) return 5;
if(lotQty <= 150) return 8;
if(lotQty <= 280) return 13;
if(lotQty <= 500) return 20;
if(lotQty <= 1200) return 32;
if(lotQty <= 3200) return 50;
if(lotQty <= 10000) return 80;
if(lotQty <= 35000) return 125;
if(lotQty <= 150000) return 200;
if(lotQty <= 500000) return 315;

return 500;

}

/* ================= AQL ================= */

const AQL_TABLE = {

NORMAL:{2:0,3:0,5:0,8:1,13:1,20:1,32:2,50:3,80:5,125:7,200:10,315:14,500:21},
TIGHTENED:{2:0,3:0,5:0,8:0,13:1,20:1,32:1,50:2,80:3,125:5,200:7,315:10,500:14}

};

function getMaxDefects(sampleSize, level){

if(!sampleSize) return "";

return AQL_TABLE[level][sampleSize] ?? 0;

}

/* ================= SERIAL ================= */

function generateIncomingSerial(){

const data = getIncomingData();

const today = new Date();

const year = today.getFullYear().toString().slice(-2);
const month = String(today.getMonth()+1).padStart(2,"0");

const prefix = `WMS${year}${month}`;

const monthly = data.filter(r => r.id.startsWith(prefix));

const consecutive = String(monthly.length + 1).padStart(3,"0");

return `${prefix}-${consecutive}`;

}

/* ================= DOM ================= */

const modal=document.getElementById("incomingModal");

const addBtn=document.getElementById("addIncoming");
const cancelBtn=document.getElementById("cancelIncoming");
const saveBtn=document.getElementById("saveIncoming");

const vendorInput=document.getElementById("vendorInput");
const partInput=document.getElementById("partNumberInput");
const descInput=document.getElementById("descInput");

const rollingInput=document.getElementById("rollingInput");
const lotInput=document.getElementById("lotQtyInput");
const sampleInput=document.getElementById("sampleInput");
const aqlLevelInput=document.getElementById("aqlLevelInput");
const maxDefectsInput=document.getElementById("maxDefectsInput");
const judgeInput=document.getElementById("judgeInput");

const ngQtyInput=document.getElementById("ngQtyInput");
const ngPercentInput=document.getElementById("ngPercentInput");

const defectInput=document.getElementById("defectInput");
const defectPhotosSection=document.getElementById("defectPhotosSection");
const defectPhotoInput=document.getElementById("defectPhotoInput");

const gridBtn = document.getElementById("gridViewBtn");
const listBtn = document.getElementById("listViewBtn");
const listContainer = document.getElementById("incomingList");
const vendorFilter = document.getElementById("incomingVendorFilter");
const userFilter = document.getElementById("incomingUserFilter");
const dateFromFilter = document.getElementById("incomingDateFrom");
const dateToFilter = document.getElementById("incomingDateTo");
const clearFiltersBtn = document.getElementById("clearIncomingFilters");

/* ================= LOAD DROPDOWNS ================= */

function loadDropdowns(){

vendorInput.innerHTML=`<option value="">Select Vendor</option>`;
defectInput.innerHTML=`<option value="">Select Defect</option>`;

VENDORS.forEach(v=>{
vendorInput.innerHTML+=`<option value="${v}">${v}</option>`;
});

DEFECTS.forEach(d=>{
defectInput.innerHTML+=`<option value="${d}">${d}</option>`;
});

}

loadDropdowns();

/* ================= MODAL ================= */

addBtn.onclick = () => {

modal.style.display = "flex";

vendorInput.value = "";
partInput.value = "";
descInput.value = "";
rollingInput.value = "";
lotInput.value = "";
sampleInput.value = "";
aqlLevelInput.value = "";
maxDefectsInput.value = "";
ngQtyInput.value = "";
ngPercentInput.value = "";
defectInput.value = "";
judgeInput.value = "";

document.getElementById("commentsInput").value = "";

defectPhotosSection.style.display = "none";
defectPhotoInput.value = "";

};

/* ================= PART VALIDATION ================= */

partInput.addEventListener("change",e=>{

const pn=e.target.value.trim().toUpperCase();

if(!PART_DATABASE[pn]){

showInvalidPartAlert();

partInput.value="";
descInput.value="";

return;

}

descInput.value=PART_DATABASE[pn];

});

/* ================= CLOSE MODAL ================= */

cancelBtn.onclick = () => {

modal.style.display = "none";

/* limpiar campos */

vendorInput.value = "";
partInput.value = "";
descInput.value = "";
rollingInput.value = "";
lotInput.value = "";
sampleInput.value = "";
aqlLevelInput.value = "";
maxDefectsInput.value = "";
ngQtyInput.value = "";
ngPercentInput.value = "";
defectInput.value = "";
judgeInput.value = "";

document.getElementById("commentsInput").value = "";

defectPhotosSection.style.display = "none";
defectPhotoInput.value = "";

};

/* ================= AQL AUTO ================= */

function updateAQL(){

const vendor=vendorInput.value;
const lotQty=Number(lotInput.value);

if(!vendor||!lotQty) return;

const supplier=getSupplierState(vendor);

const sample=getSampleSize(lotQty);
const maxDefects=getMaxDefects(sample,supplier.level);

sampleInput.value=sample;
maxDefectsInput.value=maxDefects;

aqlLevelInput.value=supplier.level==="NORMAL"?"Level II":"Level III";

calculateJudgeLive();

}

lotInput.addEventListener("input",updateAQL);
vendorInput.addEventListener("change",updateAQL);

/* ================= JUDGE + NG% ================= */

function calculateJudgeLive(){

const lotQty=Number(lotInput.value);
const sample=Number(sampleInput.value);
const ngQty=Number(ngQtyInput.value);
const maxDefects=Number(maxDefectsInput.value);

if(!lotQty || isNaN(ngQty)) return;

if(sample && ngQty > sample){

showSampleErrorAlert();

ngQtyInput.value="";
ngPercentInput.value="";
judgeInput.value="";

return;

}

ngPercentInput.value=((ngQty/lotQty)*100).toFixed(2)+"%";

judgeInput.value=ngQty>maxDefects?"NG ❌":"OK ✅";

if(ngQty>0){

defectInput.disabled=false;
defectPhotosSection.style.display="block";

}else{

defectInput.disabled=true;
defectInput.value="";
defectPhotosSection.style.display="none";
defectPhotoInput.value="";

}

}

ngQtyInput.addEventListener("input",calculateJudgeLive);

/* ================= SAVE ================= */

saveBtn.onclick=async ()=>{

try{

if(!PARTS_READY){
alert("Parts DB loading");
return;
}

const vendor=vendorInput.value;
const partNumber=partInput.value.trim().toUpperCase();

if(!PART_DATABASE[partNumber]){
showInvalidPartAlert();
return;
}

const rolling=rollingInput.value;
const lotQty=lotInput.value;

if(!vendor||!partNumber||!rolling||!lotQty){
alert("Complete required fields");
return;
}

const sample = Number(sampleInput.value);
const ngQty = Number(ngQtyInput.value);

if(sample && ngQty > sample){
showSampleErrorAlert();
return;
}

const data=await getFreshIncomingData();

const id=await getNextIncomingSerial();

const judge=judgeInput.value.includes("NG")?"NG":"OK";

updateSupplierLevel(vendor,judge);

/* ================= SAVE PHOTO ================= */

let defectPhotoKey = null;

if(defectPhotoInput && defectPhotoInput.files[0]){

    defectPhotoKey = id + "_defect";

    await savePhoto(defectPhotoKey, defectPhotoInput.files[0]);

}

/* ================= SAVE RECORD ================= */

data.push({

module: "WMS",  // 🔥 CLAVE

id,
date:new Date().toLocaleString(),
dateISO:new Date().toISOString(),
shift: session.shift,
inspector:session.name,

vendor,
partNumber,
description:descInput.value,
rolling,

lotQty,
sample:sampleInput.value,
aqlLevel:aqlLevelInput.value,
maxDefects:maxDefectsInput.value,

judge,
ngQty:ngQtyInput.value,
ngPercent:ngPercentInput.value,

defect:defectInput.value,
comments:document.getElementById("commentsInput").value,
approvalStatus:"Pending",
approvedBy:"",
approvedRole:"",
approvedAt:"",

defectPhoto: defectPhotoKey

});

await saveIncomingData(data);

location.reload();

}catch(err){

console.error(err);
alert("Error saving inspection");

}

};
/* ================= VIEW SWITCH ================= */

let currentView = localStorage.getItem("incomingView") || "grid";

/* limpiar estado primero */

gridBtn.classList.remove("active");
listBtn.classList.remove("active");

/* aplicar estado correcto */

if(currentView === "grid"){
gridBtn.classList.add("active");
}else{
listBtn.classList.add("active");
}

gridBtn.onclick = () => {

currentView = "grid";
localStorage.setItem("incomingView","grid");

gridBtn.classList.add("active");
listBtn.classList.remove("active");

renderIncoming();

};

listBtn.onclick = () => {

currentView = "list";
localStorage.setItem("incomingView","list");

listBtn.classList.add("active");
gridBtn.classList.remove("active");

renderIncoming();

};

/* ================= PERMISSIONS FILTER ================= */

function filterIncomingByUser(data){

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

function applyIncomingFilters(data){
    const vendorValue = vendorFilter?.value || "";
    const userValue = userFilter?.value || "";
    const fromValue = dateFromFilter?.value || "";
    const toValue = dateToFilter?.value || "";

    return data.filter(rec => {
        if(vendorValue && rec.vendor !== vendorValue) return false;
        if(userValue && rec.inspector !== userValue) return false;

        const recordDate = parseRecordDate(rec.date);
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

function populateIncomingFilterOptions(data){
    if(vendorFilter){
        const current = vendorFilter.value;
        const vendors = [...new Set(data.map(rec => rec.vendor).filter(Boolean))].sort();
        vendorFilter.innerHTML = `<option value="">All vendors</option>` + vendors.map(v => `<option value="${v}">${v}</option>`).join("");
        vendorFilter.value = vendors.includes(current) ? current : "";
    }

    if(userFilter){
        const current = userFilter.value;
        const users = [...new Set(data.map(rec => rec.inspector).filter(Boolean))].sort();
        userFilter.innerHTML = `<option value="">All inspectors</option>` + users.map(u => `<option value="${u}">${u}</option>`).join("");
        userFilter.value = users.includes(current) ? current : "";
    }
}

/* ================= RENDER SUMMARY ================= */

function renderIncoming(){

const rawData = getIncomingData();
const visibleData = filterIncomingByUser(rawData);
populateIncomingFilterOptions(visibleData);
const data = applyIncomingFilters(visibleData);

listContainer.innerHTML="";

if(data.length === 0){

listContainer.innerHTML="<h2 style='text-align:center'>No inspections yet</h2>";

return;

}

const reversed = data.slice().reverse();

/* ================= GRID VIEW ================= */

if(currentView === "grid"){

reversed.forEach((rec,index)=>{

const realIndex = rawData.findIndex(item => item.id === rec.id);

const card = document.createElement("div");

card.className="rtv-card";

card.innerHTML=`
<strong>${rec.id}</strong><br>
${rec.vendor}<br>
${rec.partNumber}<br>
<b>${rec.judge}</b><br>
NG: ${rec.ngPercent}<br>
Approval: ${rec.approvalStatus === "Approved" ? "Approved" : "Pending"}
`;

card.onclick=()=>{
localStorage.setItem("currentIncoming",realIndex);
window.location.href="incoming-detail.html";
};

listContainer.appendChild(card);

});

return;

}

/* ================= LIST VIEW ================= */

const table = document.createElement("table");

table.className="rtv-table";

table.innerHTML=`
<thead>
<tr>
<th>ID</th>
<th>Vendor</th>
<th>Part</th>
<th>Rolling</th>
<th>Judge</th>
<th>NG%</th>
<th>Date</th>
<th>Approval</th>
</tr>
</thead>
<tbody></tbody>
`;

const tbody = table.querySelector("tbody");

reversed.forEach((rec,index)=>{

const realIndex = rawData.findIndex(item => item.id === rec.id);

const row = document.createElement("tr");

row.innerHTML=`
<td><strong>${rec.id}</strong></td>
<td>${rec.vendor}</td>
<td>${rec.partNumber}</td>
<td>${rec.rolling}</td>
<td>${rec.judge}</td>
<td>${rec.ngPercent}</td>
<td>${rec.date}</td>
<td>${rec.approvalStatus === "Approved" ? "Approved" : "Pending"}</td>
`;

row.onclick=()=>{
localStorage.setItem("currentIncoming",realIndex);
window.location.href="incoming-detail.html";
};

tbody.appendChild(row);

});

listContainer.appendChild(table);

}

/* ================= INIT ================= */

renderIncoming();

[vendorFilter, userFilter, dateFromFilter, dateToFilter].forEach(el => {
    el?.addEventListener("change", renderIncoming);
});

clearFiltersBtn?.addEventListener("click", ()=>{
    if(vendorFilter) vendorFilter.value = "";
    if(userFilter) userFilter.value = "";
    if(dateFromFilter) dateFromFilter.value = "";
    if(dateToFilter) dateToFilter.value = "";
    renderIncoming();
});

if(window.AppAccess && !window.AppAccess.canEditModule(session, "incoming")){
    if(addBtn) addBtn.style.display = "none";
    const exportBtn = document.getElementById("exportExcelBtn");
    if(exportBtn) exportBtn.style.display = "none";
}

function showInvalidPartAlert(){

const modal = document.getElementById("invalidPartModal");

if(modal){
modal.style.display = "flex";
}

}

const closeInvalid = document.getElementById("closeInvalidPart");

if(closeInvalid){

closeInvalid.onclick = () => {
document.getElementById("invalidPartModal").style.display = "none";
};

}
function showSampleErrorAlert(){

const modal = document.getElementById("sampleErrorModal");

if(modal){
modal.style.display = "flex";
}

}

const closeSampleError = document.getElementById("closeSampleError");

if(closeSampleError){

closeSampleError.onclick = () => {

document.getElementById("sampleErrorModal").style.display = "none";

};

}
function exportToExcel(){

    const rawData = getIncomingData();
    const data = applyIncomingFilters(filterIncomingByUser(rawData));

    if(!data.length){
        alert("No data to export.");
        return;
    }

    const formattedData = data.map(rec => ({

        "ID": rec.id,

        "Marca temporal": rec.date,

        "Inspector": rec.inspector,

        "Vendor": rec.vendor,

        "Part number": rec.partNumber,

        "Description": rec.description,

        "Rolling": rec.rolling,

        "Lot quantity": rec.lotQty,

        "Sample": rec.sample,

        "AQL": rec.aqlLevel,

        "Judge": rec.judge,

        "NG QTY": rec.ngQty,

        "Defect description": rec.defect,

        "NG percentage": rec.ngPercent

    }));

    const worksheet = XLSX.utils.json_to_sheet(formattedData);
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, "WMS Report");

    const today = new Date();

    const fileName = `WMS_Report_${today.getFullYear()}-${today.getMonth()+1}-${today.getDate()}.xlsx`;

    XLSX.writeFile(workbook, fileName);
}
document.addEventListener("DOMContentLoaded", () => {

    const exportBtn = document.getElementById("exportExcelBtn");

    if(exportBtn){
        exportBtn.addEventListener("click", () => {
            console.log("CLICK EXPORT");
            exportToExcel();
        });
    }

});
