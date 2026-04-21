console.log("BOX DETAIL LOADED");

/* ================= SESSION ================= */

const session = window.AppSession?.get() || JSON.parse(localStorage.getItem("loggedUser"));
if (!session) window.location.href = "login.html";
if (window.AppAccess && !window.AppAccess.canAccessModule(session, "box")) {
    window.location.href = "index.html";
}

/* ================= STORAGE ================= */

function getBoxData(){
    return window.AppStore ? window.AppStore.getDataset("boxData") : (JSON.parse(localStorage.getItem("boxData")) || []);
}

function saveBoxData(data){
    return window.AppStore ? window.AppStore.setDataset("boxData", data) : localStorage.setItem("boxData", JSON.stringify(data));
}

/* ================= LOAD RECORD ================= */

const data = getBoxData();
const index = Number(localStorage.getItem("currentBox"));

if(isNaN(index) || !data[index]){
    location.href="box.html";
}

let rec = data[index];
let editMode = false;

/* ================= HELPERS ================= */

function getVal(id){
    const el = document.getElementById(id);
    return el ? Number(el.value) || 0 : 0;
}

function getText(id){
    const el = document.getElementById(id);
    return el ? el.value : "";
}

/* ================= DOM ================= */

document.addEventListener("DOMContentLoaded",()=>{

const editBtn = document.getElementById("editBox");
const deleteBtn = document.getElementById("deleteBox");
const approveBtn = document.getElementById("approveBox");
const approvalStatusEl = document.getElementById("approvalStatus");
const approvalInfoRow = document.getElementById("approvalInfoRow");
const approvalInfoEl = document.getElementById("approvalInfo");
const photoEl = document.getElementById("damagePhoto");

if(window.AppAccess && !window.AppAccess.canEditModule(session, "box")){
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

    document.getElementById("boxId").innerText = rec.id || "-";

    document.getElementById("colorText").innerText = rec.color || "-";
    document.getElementById("lineText").innerText = rec.line || "-";
    document.getElementById("partText").innerText = rec.partNumber || "-";
    document.getElementById("descText").innerText = rec.description || "-";
    document.getElementById("modelText").innerText = rec.model || "-";
    document.getElementById("rollingText").innerText = rec.rolling || "-";

    document.getElementById("qtyText").innerText = rec.qtyInspected || 0;
    document.getElementById("levelAText").innerText = rec.levelA || 0;
    document.getElementById("levelBText").innerText = rec.levelB || 0;
    document.getElementById("levelCText").innerText = rec.levelC || 0;
    document.getElementById("damagedText").innerText = rec.damagedTotal || 0;

    document.getElementById("planQtyText").innerText = rec.planQty || "-";
    document.getElementById("marketText").innerText = rec.market || "-";
    document.getElementById("spareText").innerText = rec.spareParts || 0;
    document.getElementById("commentsText").innerText = rec.comments || "-";
    applyApprovalControls();

    /* PHOTO */

    if(rec.damagePhoto){
        try{
            await loadPhotoToImg(rec.damagePhoto, "damagePhoto");
            photoEl.style.display = "block";
        }catch{
            photoEl.src = "./img/no-photo.png";
            photoEl.style.display = "block";
        }
    }else{
        photoEl.src = "./img/no-photo.png";
        photoEl.style.display = "block";
    }

    /* BREAKDOWN */

    const B = rec.damageBreakdown?.B || {};
    const C = rec.damageBreakdown?.C || {};

    ["EFM","PFA","WH","HQ"].forEach(k=>{
        document.getElementById("b"+k).innerText = B[k] ?? 0;
        document.getElementById("c"+k).innerText = C[k] ?? 0;
    });
}

renderView();

/* ================= EDIT MODE ================= */

function enableEdit(){

    if(isApproved()){
        alert("This record is already approved and cannot be modified.");
        return;
    }

    editMode = true;
    editBtn.innerText = "💾 Save";

    document.getElementById("colorText").innerHTML =
        `<input id="colorEdit" value="${rec.color || ""}">`;

    document.getElementById("marketText").innerHTML =
        `<input id="marketEdit" value="${rec.market || ""}">`;

    document.getElementById("qtyText").innerHTML =
        `<input id="qtyEdit" type="number" value="${rec.qtyInspected || 0}">`;

    document.getElementById("levelAText").innerHTML =
        `<input id="levelAEdit" type="number" value="${rec.levelA || 0}">`;

    document.getElementById("spareText").innerHTML =
        `<input id="spareEdit" type="number" value="${rec.spareParts || 0}">`;

    document.getElementById("commentsText").innerHTML =
        `<input id="commentsEdit" value="${rec.comments || ""}">`;

    /* BREAKDOWN EDIT */

    const B = rec.damageBreakdown?.B || {};
    const C = rec.damageBreakdown?.C || {};

    ["EFM","PFA","WH","HQ"].forEach(k=>{
        document.getElementById("b"+k).innerHTML =
            `<input id="b_${k}" type="number" value="${B[k] || 0}">`;

        document.getElementById("c"+k).innerHTML =
            `<input id="c_${k}" type="number" value="${C[k] || 0}">`;
    });

    [
        "qtyEdit","levelAEdit",
        "b_EFM","b_PFA","b_WH","b_HQ",
        "c_EFM","c_PFA","c_WH","c_HQ"
    ].forEach(id=>{
        const el = document.getElementById(id);
        if(el) el.addEventListener("input", validateTotals);
    });
}

/* ================= VALIDATION ================= */

function validateTotals(){

    const qty = getVal("qtyEdit");
    const levelA = getVal("levelAEdit");

    const bTotal =
        getVal("b_EFM") +
        getVal("b_PFA") +
        getVal("b_WH") +
        getVal("b_HQ");

    const cTotal =
        getVal("c_EFM") +
        getVal("c_PFA") +
        getVal("c_WH") +
        getVal("c_HQ");

    const damaged = bTotal + cTotal;

    const el = document.getElementById("damagedText");
    if(el) el.innerText = damaged;

    if(levelA + damaged !== qty){
        if(el) el.style.color = "red";
        return false;
    }else{
        if(el) el.style.color = "";
        return true;
    }
}

/* ================= SAVE ================= */

async function saveChanges(){

try{

    if(isApproved()){
        alert("This record is already approved and cannot be modified.");
        return;
    }

    if(!validateTotals()){
        alert("Level A + Defects must equal Qty");
        return;
    }

    const qty = getVal("qtyEdit");
    const levelA = getVal("levelAEdit");

    const b = {
        EFM:getVal("b_EFM"),
        PFA:getVal("b_PFA"),
        WH:getVal("b_WH"),
        HQ:getVal("b_HQ")
    };

    const c = {
        EFM:getVal("c_EFM"),
        PFA:getVal("c_PFA"),
        WH:getVal("c_WH"),
        HQ:getVal("c_HQ")
    };

    const bTotal = Object.values(b).reduce((a,v)=>a+v,0);
    const cTotal = Object.values(c).reduce((a,v)=>a+v,0);

    rec.color = getText("colorEdit");
    rec.market = getText("marketEdit");

    rec.qtyInspected = qty;
    rec.levelA = levelA;

    rec.levelB = bTotal;
    rec.levelC = cTotal;
    rec.damagedTotal = bTotal + cTotal;

    rec.damageBreakdown = { B:b, C:c };

    rec.spareParts = getVal("spareEdit");
    rec.comments = getText("commentsEdit");

    rec.lastEdited = new Date().toLocaleString();
    rec.editedBy = session.name;

    data[index] = rec;
    await saveBoxData(data);

    alert("Saved successfully");

    location.reload();

}catch(err){
    console.error(err);
    alert("Error saving");
}
}

/* ================= CONFIRM ================= */

function showConfirm(type, onConfirm){

    const overlay = document.getElementById("confirmOverlay");
    const okBtn = document.getElementById("confirmOk");
    const cancelBtn = document.getElementById("confirmCancel");

    const icon = document.getElementById("confirmIcon");
    const title = document.getElementById("confirmTitle");
    const message = document.getElementById("confirmMessage");
    const warning = document.getElementById("confirmWarning");

    if(!overlay) return;

    overlay.classList.remove("hidden");

    /* ================= EDIT ================= */
    if(type === "edit"){

        icon.innerHTML = "✏️";
        title.innerText = "Edit Record";

        message.innerText =
            "You are about to modify this inspection.";

        warning.innerText =
            "Ensure all values match before saving.";

        okBtn.innerText = "Edit";
    }

    /* ================= DELETE ================= */
    if(type === "delete"){

        icon.innerHTML = "⚠️";
        title.innerText = "Delete Record";

        message.innerText =
            "This record will be permanently deleted.";

        warning.innerText =
            "This action cannot be undone.";

        okBtn.innerText = "Delete";
    }

    cancelBtn.onclick = () => {
        overlay.classList.add("hidden");
    };

    okBtn.onclick = () => {
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
    await saveBoxData(data);
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
        await saveBoxData(data);
        location.href="box.html";
    });
};

});
