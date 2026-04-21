console.log("DAILY DETAIL LOADED");

/* SESSION */

const session = window.AppSession?.get() || JSON.parse(localStorage.getItem("loggedUser"));
if(!session) window.location.href="login.html";
if (window.AppAccess && !window.AppAccess.canAccessModule(session, "daily")) window.location.href="index.html";

/* STORAGE */

function getDailyData(){
return window.AppStore ? window.AppStore.getDataset("dailyData") : (JSON.parse(localStorage.getItem("dailyData")) || []);
}

function saveDailyData(data){
return window.AppStore ? window.AppStore.setDataset("dailyData", data) : localStorage.setItem("dailyData",JSON.stringify(data));
}

/* ================= SAFE HELPERS ================= */

function safe(val){
    return val !== undefined && val !== null && val !== "" ? val : "-";
}

function safeNum(val){
    return isNaN(val) ? 0 : val;
}

/* LOAD RECORD */

const data = getDailyData();
const index = Number(localStorage.getItem("currentDaily"));

if(isNaN(index) || !data[index]){
window.location.href="daily.html";
}

let rec = data[index];
let editMode=false;

/* DOM */

const editBtn = document.getElementById("editDaily");
const deleteBtn = document.getElementById("deleteDaily");
const approveBtn = document.getElementById("approveDaily");
const approvalStatusEl = document.getElementById("approvalStatus");
const approvalInfoRow = document.getElementById("approvalInfoRow");
const approvalInfoEl = document.getElementById("approvalInfo");

const dailyId = document.getElementById("dailyId");

const areaText=document.getElementById("areaText");
const itemText=document.getElementById("itemText");
const issueText=document.getElementById("issueText");

const inspectorText=document.getElementById("inspectorText");
const dateText=document.getElementById("dateText");
const lineText=document.getElementById("lineText");

const defectQtyText=document.getElementById("defectQtyText");
const sampleText=document.getElementById("sampleText");
const percentText=document.getElementById("percentText");

const reportedByText=document.getElementById("reportedByText");
const responsibleText=document.getElementById("responsibleText");
const solutionText=document.getElementById("solutionText");

const partText=document.getElementById("partText");
const descText=document.getElementById("descText");

const internalModelText=document.getElementById("internalModelText");
const customerModelText=document.getElementById("customerModelText");

const rollingText=document.getElementById("rollingText");
const planText=document.getElementById("planText");

const commentsText=document.getElementById("commentsText");

if(window.AppAccess && !window.AppAccess.canEditModule(session, "daily")){
    if(editBtn) editBtn.style.display = "none";
    if(deleteBtn) deleteBtn.style.display = "none";
}

function normalizeShift(value){
    return (value || "").trim().toUpperCase();
}

function isApproved(){
    return (rec.approvalStatus || "").trim() === "Approved";
}

function canApprove(){
    if(!session || isApproved()) return false;
    if(["Admin","Engineer","Manager","Director"].includes(session.role)) return true;
    return session.role === "Group Leader" && normalizeShift(session.shift) === normalizeShift(rec.shift);
}

function applyApprovalControls(){
    if(approvalStatusEl){
        approvalStatusEl.textContent = isApproved() ? "Approved" : "Pending";
        approvalStatusEl.className = isApproved() ? "approval-pill approved" : "approval-pill pending";
    }
    if(approvalInfoRow && approvalInfoEl){
        if(isApproved()){
            approvalInfoRow.style.display = "";
            approvalInfoEl.textContent = `${rec.approvedBy || "-"}${rec.approvedAt ? " / " + rec.approvedAt : ""}`;
        }else{
            approvalInfoRow.style.display = "none";
        }
    }
    if(approveBtn) approveBtn.style.display = canApprove() ? "" : "none";
    if(isApproved()){
        if(editBtn) editBtn.style.display = "none";
        if(deleteBtn) deleteBtn.style.display = "none";
    }
}

/* ================= RENDER ================= */

async function renderView(){

dailyId.innerText = safe(rec.id);

areaText.innerText = safe(rec.area);
itemText.innerText = safe(rec.item);
issueText.innerText = safe(rec.issue);

inspectorText.innerText = safe(rec.inspector);
dateText.innerText = safe(rec.date);
lineText.innerText = safe(rec.detectionLine);

defectQtyText.innerText = safeNum(rec.defectQty);
sampleText.innerText = safeNum(rec.sample);

percentText.innerText = safeNum(rec.percent) + "%";

reportedByText.innerText = safe(rec.reportedBy);
responsibleText.innerText = safe(rec.responsible);
solutionText.innerText = safe(rec.solution);

partText.innerText = safe(rec.partNumber);
descText.innerText = safe(rec.description);

internalModelText.innerText = safe(rec.internalModel);
customerModelText.innerText = safe(rec.customerModel);

rollingText.innerText = safe(rec.rolling);
planText.innerText = safeNum(rec.planQty);

commentsText.innerText = safe(rec.comments);
applyApprovalControls();

const attentionTimeText = document.getElementById("attentionTimeText");

if(attentionTimeText){
    attentionTimeText.innerText = safeNum(rec.attentionTime);
}

/* ================= PHOTO ================= */

const photo = document.getElementById("photoPreview");

if(rec.photo){

try{
await loadPhotoToImg(rec.photo, "photoPreview");
photo.style.display="block";

}catch{

photo.src = "./img/no-photo.png";
photo.style.display="block";

}

}else{

photo.src = "./img/no-photo.png";
photo.style.display="block";

}

}

renderView();

/* ================= ENABLE EDIT ================= */

function enableEdit(){

if(isApproved()){
    alert("This record is already approved and cannot be modified.");
    return;
}

editMode = true;
editBtn.innerText = "💾 Save";

/* GENERAL */

areaText.innerHTML = `<input id="areaEdit" value="${rec.area || ""}">`;
itemText.innerHTML = `<input id="itemEdit" value="${rec.item || ""}">`;
issueText.innerHTML = `<input id="issueEdit" value="${rec.issue || ""}">`;

lineText.innerHTML = `<input id="lineEdit" value="${rec.detectionLine || ""}">`;

/* INSPECTION */

defectQtyText.innerHTML =
`<input id="defectEdit" type="number" value="${rec.defectQty || 0}">`;

sampleText.innerHTML =
`<input id="sampleEdit" type="number" value="${rec.sample || 0}">`;

/* MODELS */

internalModelText.innerHTML =
`<input id="internalModelEdit" value="${rec.internalModel || ""}">`;

customerModelText.innerHTML =
`<input id="customerModelEdit" value="${rec.customerModel || ""}">`;

rollingText.innerHTML =
`<input id="rollingEdit" value="${rec.rolling || ""}">`;

planText.innerHTML =
`<input id="planEdit" type="number" value="${rec.planQty || 0}">`;

/* RESPONSIBILITY */

reportedByText.innerHTML =
`<input id="reportedEdit" value="${rec.reportedBy || ""}">`;

responsibleText.innerHTML =
`<input id="responsibleEdit" value="${rec.responsible || ""}">`;

solutionText.innerHTML =
`<input id="solutionEdit" value="${rec.solution || ""}">`;

/* COMMENTS */

commentsText.innerHTML =
`<textarea id="commentsEdit">${rec.comments || ""}</textarea>`;

/* VALIDATION LIVE */

document.getElementById("defectEdit")?.addEventListener("input", recalcPercent);
document.getElementById("sampleEdit")?.addEventListener("input", recalcPercent);

}

/* ================= SAVE ================= */

async function saveChanges(){

try{

if(isApproved()){
    alert("This record is already approved and cannot be modified.");
    return;
}

const defect = Number(document.getElementById("defectEdit")?.value) || 0;
const sample = Number(document.getElementById("sampleEdit")?.value) || 0;

if(sample === 0){
    alert("Sample cannot be 0");
    return;
}

if(defect > sample){
    alert("Defect cannot exceed sample");
    return;
}

const percent = (defect / sample) * 100;

/* UPDATE RECORD */

rec.area = document.getElementById("areaEdit")?.value || "";
rec.item = document.getElementById("itemEdit")?.value || "";
rec.issue = document.getElementById("issueEdit")?.value || "";

rec.detectionLine = document.getElementById("lineEdit")?.value || "";

rec.defectQty = defect;
rec.sample = sample;
rec.percent = Number(percent.toFixed(2));

rec.internalModel = document.getElementById("internalModelEdit")?.value || "";
rec.customerModel = document.getElementById("customerModelEdit")?.value || "";

rec.rolling = document.getElementById("rollingEdit")?.value || "";
rec.planQty = Number(document.getElementById("planEdit")?.value) || 0;

rec.reportedBy = document.getElementById("reportedEdit")?.value || "";
rec.responsible = document.getElementById("responsibleEdit")?.value || "";
rec.solution = document.getElementById("solutionEdit")?.value || "";

rec.comments = document.getElementById("commentsEdit")?.value || "";

/* SAVE */

data[index] = rec;
await saveDailyData(data);

/* RESET UI */

editMode = false;
editBtn.innerText = "✏ Edit";

renderView();

}catch(err){
console.error(err);
alert("Error saving changes");
}
}

/* ================= CONFIRM MODAL ================= */

function showConfirm(type,onConfirm){

const overlay=document.getElementById("confirmOverlay");
const okBtn=document.getElementById("confirmOk");
const cancelBtn=document.getElementById("confirmCancel");

overlay.classList.remove("hidden");

if(type==="edit"){

document.getElementById("confirmIcon").innerHTML="✏️";
document.getElementById("confirmTitle").innerText="Edit Record";

document.getElementById("confirmMessage").innerText=
"You are about to edit this inspection.";

document.getElementById("confirmWarning").innerText=
"Make sure all information is correct before saving.";

okBtn.innerText="Start Editing";

okBtn.style.background=
"linear-gradient(45deg,#1abc9c,#16a085)";
}

if(type==="delete"){

document.getElementById("confirmIcon").innerHTML="⚠️";
document.getElementById("confirmTitle").innerText="Delete Record";

document.getElementById("confirmMessage").innerText=
"You are about to permanently delete this inspection.";

document.getElementById("confirmWarning").innerText=
"This action cannot be undone.";

okBtn.innerText="Delete";

okBtn.style.background=
"linear-gradient(45deg,#ff3b3b,#d60000)";
}

cancelBtn.onclick=()=>overlay.classList.add("hidden");

okBtn.onclick=()=>{

overlay.classList.add("hidden");

onConfirm();

};

}

/* ================= EVENTS ================= */

editBtn.onclick=async ()=>{

if(!editMode){
showConfirm("edit",()=>enableEdit());
}else{
await saveChanges();
}

};

if(approveBtn){
approveBtn.onclick=async ()=>{
    if(!canApprove()){
        alert("You don't have permission to approve this record.");
        return;
    }

    rec.approvalStatus = "Approved";
    rec.approvedBy = session.name || "";
    rec.approvedRole = session.role || "";
    rec.approvedAt = new Date().toLocaleString();
    data[index] = rec;
    await saveDailyData(data);
    applyApprovalControls();
    alert("Record approved successfully.");
};
}

deleteBtn.onclick=()=>{

if(isApproved()){
    alert("This record is already approved and cannot be deleted.");
    return;
}

showConfirm("delete", async ()=>{

data.splice(index,1);

await saveDailyData(data);

window.location.href="daily.html";

});

};
function recalcPercent(){

const defect = Number(document.getElementById("defectEdit")?.value) || 0;
const sample = Number(document.getElementById("sampleEdit")?.value) || 0;

const percent = sample > 0 ? (defect / sample) * 100 : 0;

percentText.innerText = percent.toFixed(2) + "%";

if(defect > sample){
    percentText.style.color = "red";
}else{
    percentText.style.color = "";
}
}
