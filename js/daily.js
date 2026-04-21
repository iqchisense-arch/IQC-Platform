console.log("DAILY MODULE LOADED");

/* ================= SESSION ================= */

const session = window.AppSession?.get() || JSON.parse(localStorage.getItem("loggedUser"));
if(!session) window.location.href="login.html";
if (window.AppAccess && !window.AppAccess.canAccessModule(session, "daily")) {
    window.location.href = "index.html";
}

/* ================= PART DATABASE ================= */

let PART_DATABASE = {};
let PARTS_READY = false;

fetch("./data/parts.json")
.then(res=>res.json())
.then(data=>{
    data.forEach(p=>{
        PART_DATABASE[p.PartNumber.trim().toUpperCase()] =
            p.Description.trim();
    });
    PARTS_READY = true;
})
.catch(err=>console.error("Parts DB error:", err));

/* ================= STORAGE ================= */

function getDailyData(){
    return window.AppStore ? window.AppStore.getDataset("dailyData") : (JSON.parse(localStorage.getItem("dailyData")) || []);
}

function saveDailyData(data){
    return window.AppStore ? window.AppStore.setDataset("dailyData", data) : localStorage.setItem("dailyData", JSON.stringify(data));
}

async function getFreshDailyData(){
    return window.AppStore?.refreshDataset ? await window.AppStore.refreshDataset("dailyData") : getDailyData();
}

async function getNextDailySerial(){
    return window.AppStore?.nextDatasetId ? await window.AppStore.nextDatasetId("dailyData") : generateDailySerial();
}

/* ================= SERIAL ================= */

function generateDailySerial(){
    const data = getDailyData();
    const today = new Date();

    const prefix = `DR${today.getFullYear().toString().slice(-2)}${String(today.getMonth()+1).padStart(2,"0")}`;

    const monthly = data.filter(r => r?.id?.startsWith(prefix));
    return `${prefix}-${String(monthly.length + 1).padStart(3,"0")}`;
}

/* ================= STRUCTURE ================= */

const DAILY_STRUCTURE = {
Module:{
items:["Optical sheet","Open cell","Plastic bracket","Difusion plate","Reflective sheet","LED","Conector","Himeron","P-chasis"],
issues:["Burr","Damaged","White spot","Bad cut","Out of dimension","Dirty","Bubble","Damaged sof","Particule"]
},
Assembly:{
items:["Speaker","T-con board","WIFI board","WIFI cable","LVDS","FFC connector","Power board","Main board","Speaker cable","Name plate","Pad","Energy label","IR board","Bracket","Back cover","Terminal","Scutcheon","Decorative","Laminated"],
issues:["Missing component","Bad assembly","Not working","Bad welding","Loose","Misaligned","Broken"]
},
Packaging:{
items:["Plastic film","Accessory bag","Side cushon","Bottom cushon","Top cushon","Front pad","Tray"],
issues:["Wet","Bent","Damaged","Stain","Low fusion","Broken"]
}
};
const RESPONSIBILITY_DATA = {

reportedBy: ["QM", "PFA", "WH","EFM","No apply"],

responsible: ["QM", "PFA", "WH","HQ","AMI","EFM","No apply"],

solution: ["Rework", "Scrap", "Use as is", "Replace"]

};

/* ================= DOM ================= */

const listContainer = document.getElementById("dailyList");
const addBtn = document.getElementById("addDaily");
const modal = document.getElementById("dailyModal");

const saveBtn = document.getElementById("saveDaily");
const cancelBtn = document.getElementById("cancelDaily");

const exportBtn = document.getElementById("exportDailyBtn");

const gridBtn = document.getElementById("gridViewBtn");
const listBtn = document.getElementById("listViewBtn");
const userFilter = document.getElementById("dailyUserFilter");
const dateFromFilter = document.getElementById("dailyDateFrom");
const dateToFilter = document.getElementById("dailyDateTo");
const clearFiltersBtn = document.getElementById("clearDailyFilters");

const areaInput = document.getElementById("areaInput");
const itemInput = document.getElementById("itemInput");
const issueInput = document.getElementById("issueInput");

const defectQtyInput = document.getElementById("defectQtyInput");
const sampleInput = document.getElementById("sampleInput");
const percentText = document.getElementById("percentText");

const partNumberInput = document.getElementById("partNumberInput");
const descriptionInput = document.getElementById("descriptionInput");

/* ================= VIEW MODE ================= */

let currentView = localStorage.getItem("dailyView") || "grid";

function applyView(view){
    currentView = view;
    localStorage.setItem("dailyView", view);

    gridBtn?.classList.toggle("active", view==="grid");
    listBtn?.classList.toggle("active", view==="list");

    renderDaily();
}

applyView(currentView);

gridBtn?.addEventListener("click", ()=>applyView("grid"));
listBtn?.addEventListener("click", ()=>applyView("list"));

/* ================= DROPDOWNS ================= */

function loadAreaDropdown(){

    if(!areaInput) return;

    areaInput.innerHTML = `<option value="">Select Area</option>`;

    Object.keys(DAILY_STRUCTURE).forEach(area=>{
        const op = document.createElement("option");
        op.value = area;
        op.textContent = area;
        areaInput.appendChild(op);
    });
}

function loadDependentDropdowns(){

    if(!areaInput) return;

    itemInput.innerHTML = `<option value="">Select Item</option>`;
    issueInput.innerHTML = `<option value="">Select Issue</option>`;

    const config = DAILY_STRUCTURE[areaInput.value];
    if(!config) return;

    config.items.forEach(i=>{
        const op=document.createElement("option");
        op.value=i;
        op.textContent=i;
        itemInput.appendChild(op);
    });

    config.issues.forEach(i=>{
        const op=document.createElement("option");
        op.value=i;
        op.textContent=i;
        issueInput.appendChild(op);
    });
}

areaInput?.addEventListener("change", loadDependentDropdowns);

/* ================= VALIDATION ================= */

function validateDaily(){

    const defect = Number(defectQtyInput?.value) || 0;
    const sample = Number(sampleInput?.value) || 0;

    if(sample === 0) return false;

    if(defect > sample){
        percentText.style.border="2px solid red";
        return false;
    }

    percentText.style.border="";
    return true;
}

/* ================= % AUTO ================= */

function updatePercent(){

    const qty = Number(defectQtyInput?.value) || 0;
    const sample = Number(sampleInput?.value) || 0;

    percentText.value =
        sample>0 ? ((qty/sample)*100).toFixed(2) : 0;
}

defectQtyInput?.addEventListener("input", updatePercent);
sampleInput?.addEventListener("input", updatePercent);

/* ================= PART AUTOFILL ================= */

partNumberInput?.addEventListener("change", e=>{
    if(!PARTS_READY) return;

    const pn = e.target.value.trim().toUpperCase();
    descriptionInput.value = PART_DATABASE[pn] || "";
});

/* ================= MODAL ================= */

addBtn?.addEventListener("click", ()=>{
    resetForm();
    modal.style.display="flex";
});

cancelBtn?.addEventListener("click", ()=>{
    modal.style.display="none";
});

/* ================= SAVE ================= */

saveBtn?.addEventListener("click", async ()=>{

try{

    if(!validateDaily()){
        alert("Defect qty cannot exceed sample");
        return;
    }

    const data = await getFreshDailyData();
    const id = await getNextDailySerial();

    let photoKey = null;

    const photoInput = document.getElementById("photoInput");

    if(photoInput?.files[0] && typeof savePhoto==="function"){
        photoKey = id+"_photo";
        await savePhoto(photoKey, photoInput.files[0]);
    }

const record={

    id,
    date:new Date().toLocaleString(),
    dateISO:new Date().toISOString(),
    shift: session.shift,
    inspector:session.name,

    area:areaInput?.value,
    item:itemInput?.value,
    issue:issueInput?.value,

    defectQty:Number(defectQtyInput?.value)||0,
    sample:Number(sampleInput?.value)||0,
    percent:Number(percentText?.value)||0,

    partNumber:partNumberInput?.value,
    description:descriptionInput?.value,

    // 🔥 AQUÍ ESTÁ EL FIX
    internalModel:document.getElementById("internalModelInput")?.value || "",
    customerModel:document.getElementById("customerModelInput")?.value || "",

    rolling:document.getElementById("rollingInput")?.value || "",

    planQty:Number(document.getElementById("planQtyInput")?.value)||0,
    detectionLine:document.getElementById("detectionLineInput")?.value || "",

    reportedBy:document.getElementById("reportedByInput")?.value || "",
    responsible:document.getElementById("responsibleInput")?.value || "",
    solution:document.getElementById("solutionInput")?.value || "",
    attentionTime: Number(document.getElementById("attentionTimeInput")?.value) || 0,
    comments:document.getElementById("commentsInput")?.value || "",
    approvalStatus:"Pending",
    approvedBy:"",
    approvedRole:"",
    approvedAt:"",

    photo:photoKey
};

    data.push(record);
    await saveDailyData(data);

    modal.style.display="none";
    renderDaily();

}catch(err){
    console.error(err);
    alert("Error saving daily");
}
});

/* ================= PERMISSIONS FILTER ================= */

function filterDailyByUser(data){

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
        return data.filter(r => (r.shift || "").trim() === userShift);
    }

    /* ===== INSPECTOR ===== */
    if(role === "Inspector"){
        return data.filter(r => {

            const inspector = (r.inspector || "").trim().toLowerCase();
            const shift = (r.shift || "").trim();

            return inspector === userName && shift === userShift;
        });
    }

    return [];
}

function parseRecordDate(value){
    const parsed = value ? new Date(value) : null;
    return parsed && !isNaN(parsed) ? parsed : null;
}

function applyDailyFilters(data){
    const userValue = userFilter?.value || "";
    const fromValue = dateFromFilter?.value || "";
    const toValue = dateToFilter?.value || "";

    return data.filter(rec => {
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

function populateDailyFilterOptions(data){
    if(userFilter){
        const current = userFilter.value;
        const users = [...new Set(data.map(rec => rec.inspector).filter(Boolean))].sort();
        userFilter.innerHTML = `<option value="">All inspectors</option>` + users.map(u => `<option value="${u}">${u}</option>`).join("");
        userFilter.value = users.includes(current) ? current : "";
    }
}

/* ================= RENDER ================= */

function renderDaily(){

    if(!listContainer) return;

    const rawData = getDailyData();
    const visibleData = filterDailyByUser(rawData);
    populateDailyFilterOptions(visibleData);
    const data = applyDailyFilters(visibleData);
    listContainer.innerHTML="";

    if(!data.length){
        listContainer.innerHTML="<h2>No inspections yet</h2>";
        return;
    }

    const reversed=[...data].reverse();

    if(currentView==="grid"){

        reversed.forEach((rec,index)=>{

            const realIndex=rawData.findIndex(item => item.id === rec.id);

            const card=document.createElement("div");
            card.className="rtv-card";

            card.innerHTML=`
            <strong>${rec.id}</strong><br>
            ${rec.area || "-"}<br>
            ${rec.item || "-"}<br>
            ${rec.percent || 0}%<br>
            Approval: ${rec.approvalStatus === "Approved" ? "Approved" : "Pending"}
            `;

            card.onclick=()=>{
                localStorage.setItem("currentDaily",realIndex);
                window.location.href="daily-detail.html";
            };

            listContainer.appendChild(card);
        });

        return;
    }

    const table=document.createElement("table");
    table.className="rtv-table";

    table.innerHTML=`
    <thead>
    <tr>
    <th>ID</th>
    <th>Date</th>
    <th>Area</th>
    <th>Item</th>
    <th>%</th>
    <th>Approval</th>
    </tr>
    </thead>
    <tbody></tbody>
    `;

    const tbody=table.querySelector("tbody");

    reversed.forEach((rec,index)=>{

        const realIndex=rawData.findIndex(item => item.id === rec.id);

        const row=document.createElement("tr");

        row.innerHTML=`
        <td><b>${rec.id}</b></td>
        <td>${rec.date}</td>
        <td>${rec.area}</td>
        <td>${rec.item}</td>
        <td>${rec.percent || 0}%</td>
        <td>${rec.approvalStatus === "Approved" ? "Approved" : "Pending"}</td>
        `;

        row.onclick=()=>{
            localStorage.setItem("currentDaily",realIndex);
            window.location.href="daily-detail.html";
        };

        tbody.appendChild(row);
    });

    listContainer.appendChild(table);
}

/* ================= EXPORT ================= */

exportBtn?.addEventListener("click", ()=>{

    const rawData = getDailyData();
    const data = applyDailyFilters(filterDailyByUser(rawData));

    if(!data.length){
        alert("No data to export.");
        return;
    }

    const worksheet=XLSX.utils.json_to_sheet(data);
    const workbook=XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook,worksheet,"Daily");

    XLSX.writeFile(workbook,"Daily_Inspection.xlsx");
});

if(session.role === "Inspector"){
    exportBtn.style.display = "none";
}

[userFilter, dateFromFilter, dateToFilter].forEach(el => {
    el?.addEventListener("change", renderDaily);
});

clearFiltersBtn?.addEventListener("click", ()=>{
    if(userFilter) userFilter.value = "";
    if(dateFromFilter) dateFromFilter.value = "";
    if(dateToFilter) dateToFilter.value = "";
    renderDaily();
});

if(window.AppAccess && !window.AppAccess.canEditModule(session, "daily")){
    if(addBtn) addBtn.style.display = "none";
}

/* ================= RESET ================= */

function resetForm(){

    document
    .querySelectorAll("#dailyModal input, #dailyModal textarea")
    .forEach(el=>el.value="");

    document
    .querySelectorAll("#dailyModal select")
    .forEach(el=>el.selectedIndex=0);

    if(percentText) percentText.value=0;

    loadAreaDropdown();
    loadResponsibilityDropdowns(); // 🔥 ESTA LÍNEA ES CLAVE
    loadDetectionLineDropdown();
}
function loadResponsibilityDropdowns(){

    const reported = document.getElementById("reportedByInput");
    const responsible = document.getElementById("responsibleInput");
    const solution = document.getElementById("solutionInput");

    if(reported){
        reported.innerHTML = `<option value="">Select</option>`;
        RESPONSIBILITY_DATA.reportedBy.forEach(v=>{
            const op=document.createElement("option");
            op.value=v;
            op.textContent=v;
            reported.appendChild(op);
        });
    }

    if(responsible){
        responsible.innerHTML = `<option value="">Select</option>`;
        RESPONSIBILITY_DATA.responsible.forEach(v=>{
            const op=document.createElement("option");
            op.value=v;
            op.textContent=v;
            responsible.appendChild(op);
        });
    }

    if(solution){
        solution.innerHTML = `<option value="">Select</option>`;
        RESPONSIBILITY_DATA.solution.forEach(v=>{
            const op=document.createElement("option");
            op.value=v;
            op.textContent=v;
            solution.appendChild(op);
        });
    }
}
function loadDetectionLineDropdown(){

    const select = document.getElementById("detectionLineInput");
    if(!select) return;

    select.innerHTML = `<option value="">Select Line</option>`;

    for(let i=1; i<=15; i++){
        const line = "L" + i;

        const op = document.createElement("option");
        op.value = line;
        op.textContent = line;

        select.appendChild(op);
    }
}
