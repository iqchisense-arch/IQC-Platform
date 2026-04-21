console.log("INCOMING DETAIL LOADED");

/* ================= SESSION ================= */

const session = window.AppSession?.get() || JSON.parse(localStorage.getItem("loggedUser"));

if (!session){
    window.location.href = "login.html";
}
if (window.AppAccess && !window.AppAccess.canAccessModule(session, "incoming")) {
    window.location.href = "index.html";
}


/* ================= PART DATABASE ================= */

let PART_DATABASE = {};
let PARTS_READY = false;

fetch("data/parts.json")
.then(res => res.json())
.then(data => {

    data.forEach(p=>{
        PART_DATABASE[p.PartNumber.trim().toUpperCase()] = p.Description.trim();
    });

    PARTS_READY = true;

})
.catch(err=>{
    console.error("Parts database load error",err);
});


/* ================= STORAGE ================= */

function getIncomingData(){
    return window.AppStore ? window.AppStore.getDataset("incomingData") : (JSON.parse(localStorage.getItem("incomingData")) || []);
}

function saveIncomingData(data){
    return window.AppStore ? window.AppStore.setDataset("incomingData", data) : localStorage.setItem("incomingData", JSON.stringify(data));
}

function getSupplierQuality(){
    return window.AppStore ? window.AppStore.getDataset("supplierQualityData") : (JSON.parse(localStorage.getItem("supplierQualityData")) || {});
}

function getSupplierState(vendor){
    const db = getSupplierQuality();
    return db[vendor] || { level:"NORMAL" };
}


/* ================= SAMPLE SIZE ================= */

function getSampleSize(q){

    q = Number(q);

    if(q<=2)return q;
    if(q<=15)return 2;
    if(q<=25)return 3;
    if(q<=90)return 5;
    if(q<=150)return 8;
    if(q<=280)return 13;
    if(q<=500)return 20;
    if(q<=1200)return 32;
    if(q<=3200)return 50;
    if(q<=10000)return 80;
    if(q<=35000)return 125;
    if(q<=150000)return 200;
    if(q<=500000)return 315;

    return 500;
}


/* ================= AQL TABLE ================= */

const AQL_TABLE = {

    NORMAL:{
        2:0,3:0,5:0,8:1,13:1,20:1,32:2,50:3,80:5,125:7,200:10,315:14,500:21
    },

    TIGHTENED:{
        2:0,3:0,5:0,8:0,13:1,20:1,32:1,50:2,80:3,125:5,200:7,315:10,500:14
    }

};

function getMaxDefects(sample,level){
    return AQL_TABLE[level]?.[sample] ?? 0;
}


/* ================= LOAD RECORD ================= */

const data = getIncomingData();
const index = Number(localStorage.getItem("currentIncoming"));

if(isNaN(index) || !data[index]){
    location.href="incoming.html";
}

let rec = data[index];
let editMode = false;

if(window.AppAccess && !window.AppAccess.recordMatchesVendor(rec, session)){
    location.href = "incoming.html";
}


/* ================= DOM ================= */

const editBtn = document.getElementById("editInspection");
const deleteBtn = document.getElementById("deleteInspection");
const approveBtn = document.getElementById("approveInspection");
const approvalStatusEl = document.getElementById("approvalStatus");
const approvalInfoRow = document.getElementById("approvalInfoRow");
const approvalInfoEl = document.getElementById("approvalInfo");

if(window.AppAccess && !window.AppAccess.canEditModule(session, "incoming")){
    if(editBtn) editBtn.style.display = "none";
    if(deleteBtn) deleteBtn.style.display = "none";
}

if(!editBtn || !deleteBtn){
    console.warn("Detail buttons not found");
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


/* ================= RENDER VIEW ================= */

async function renderView(){

    document.getElementById("incomingId").innerText = rec.id;

    document.getElementById("vendorText").innerText = rec.vendor;
    document.getElementById("inspectorText").innerText = rec.inspector;
    document.getElementById("partText").innerText = rec.partNumber;

    document.getElementById("descText").innerText = rec.description || "-";

    document.getElementById("rollingText").innerText = rec.rolling;
    document.getElementById("lotText").innerText = rec.lotQty;

    document.getElementById("sampleText").innerText = rec.sample;
    document.getElementById("aqlText").innerText = rec.aqlLevel;
    document.getElementById("maxDefText").innerText = rec.maxDefects;

    document.getElementById("ngQtyText").innerText = rec.ngQty;
    document.getElementById("ngPercentText").innerText = rec.ngPercent;

    document.getElementById("defectText").innerText = rec.defect || "-";
    document.getElementById("commentsText").innerText = rec.comments || "-";

    const judgeBadge = document.getElementById("judgeBadge");

    judgeBadge.innerText = rec.judge;
    judgeBadge.className = "judge-badge " + (rec.judge==="NG"?"ng":"ok");

    const photoEl = document.getElementById("defectPhoto");
    applyApprovalControls();

if(rec.defectPhoto){

    loadPhotoToImg(rec.defectPhoto,"defectPhoto");

}else{

    photoEl.src = "./img/no-image.png";

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

    document.getElementById("partText").innerHTML =
        `<input id="pEdit" value="${rec.partNumber}">`;

    document.getElementById("descText").innerHTML =
        `<input id="descEdit" value="${rec.description}" disabled>`;

    document.getElementById("lotText").innerHTML =
        `<input id="lEdit" type="number" value="${rec.lotQty}">`;

    document.getElementById("ngQtyText").innerHTML =
        `<input id="ngEdit" type="number" value="${rec.ngQty}">`;

    document.getElementById("commentsText").innerHTML =
        `<input id="cEdit" value="${rec.comments||""}">`;

    document.getElementById("lEdit").oninput = recalcAll;
    document.getElementById("ngEdit").oninput = recalcAll;

    document.getElementById("pEdit").addEventListener("change", e=>{

        if(!PARTS_READY){
            alert("Parts DB loading");
            return;
        }

        const pn = e.target.value.trim().toUpperCase();

        if(!PART_DATABASE[pn]){
            alert("Part number not found");
            e.target.value = rec.partNumber;
            return;
        }

        document.getElementById("descEdit").value = PART_DATABASE[pn];

    });

}


/* ================= RECALC ================= */

function recalcAll(){

    const lot = Number(document.getElementById("lEdit").value);
    const ng = Number(document.getElementById("ngEdit").value);

    const supplier = getSupplierState(rec.vendor);

    const sample = getSampleSize(lot);
    const maxDef = getMaxDefects(sample,supplier.level);

    document.getElementById("sampleText").innerText = sample;

    document.getElementById("aqlText").innerText =
        supplier.level==="NORMAL"?"Level II":"Level III";

    document.getElementById("maxDefText").innerText = maxDef;

    if(lot){

        const percent = ((ng/lot)*100).toFixed(2)+"%";

        document.getElementById("ngPercentText").innerText = percent;

        const judge = ng>maxDef?"NG":"OK";

        const badge = document.getElementById("judgeBadge");

        badge.innerText = judge;
        badge.className = "judge-badge "+(judge==="NG"?"ng":"ok");

    }

}


/* ================= SAVE ================= */

async function saveChanges(){

    if(isApproved()){
        alert("This record is already approved and cannot be modified.");
        return;
    }

    const pn = document.getElementById("pEdit").value.trim().toUpperCase();

    if(!PART_DATABASE[pn]){
        alert("Invalid Part Number");
        return;
    }

    rec.partNumber = pn;
    rec.description = document.getElementById("descEdit").value;

    rec.lotQty = Number(document.getElementById("lEdit").value);
    rec.ngQty = Number(document.getElementById("ngEdit").value);

    rec.comments = document.getElementById("cEdit").value;

    rec.ngPercent = document.getElementById("ngPercentText").innerText;
    rec.sample = document.getElementById("sampleText").innerText;
    rec.aqlLevel = document.getElementById("aqlText").innerText;
    rec.maxDefects = document.getElementById("maxDefText").innerText;
    rec.judge = document.getElementById("judgeBadge").innerText;

    data[index] = rec;

    await saveIncomingData(data);

    location.reload();

}


/* ================= CONFIRM MODAL ================= */

function showConfirm(type,onConfirm){

    const overlay = document.getElementById("confirmOverlay");
    const okBtn = document.getElementById("confirmOk");
    const cancelBtn = document.getElementById("confirmCancel");

    overlay.classList.remove("hidden");

    if(type==="edit"){

        document.getElementById("confirmIcon").innerHTML="✏️";
        document.getElementById("confirmTitle").innerText="Edit Record";

        document.getElementById("confirmMessage").innerText =
            "You are about to edit this record.";

        document.getElementById("confirmWarning").innerText =
            "Make sure all information is correct before saving.";

        okBtn.innerText="Start Editing";
        okBtn.style.background="linear-gradient(45deg,#1abc9c,#16a085)";

    }

    if(type==="delete"){

        document.getElementById("confirmIcon").innerHTML="⚠️";
        document.getElementById("confirmTitle").innerText="Delete Record";

        document.getElementById("confirmMessage").innerText =
            "You are about to permanently delete this record.";

        document.getElementById("confirmWarning").innerText =
            "This action cannot be undone.";

        okBtn.innerText="Delete";
        okBtn.style.background="linear-gradient(45deg,#ff3b3b,#d60000)";

    }

    cancelBtn.onclick = ()=>overlay.classList.add("hidden");

    okBtn.onclick = ()=>{

        overlay.classList.add("hidden");

        onConfirm();

    };

}


/* ================= EVENTS ================= */

if(editBtn){

    editBtn.onclick = async ()=>{

        if(!editMode){
            showConfirm("edit",()=>enableEdit());
        }
        else{
            await saveChanges();
        }

    };

}

if(approveBtn){
    approveBtn.onclick = async ()=>{
        if(!canApprove()){
            alert("You don't have permission to approve this record.");
            return;
        }

        rec.approvalStatus = "Approved";
        rec.approvedBy = session.name || "";
        rec.approvedRole = session.role || "";
        rec.approvedAt = new Date().toLocaleString();
        data[index] = rec;
        await saveIncomingData(data);
        applyApprovalControls();
        alert("Record approved successfully.");
    };
}

if(deleteBtn){

    deleteBtn.onclick = ()=>{

        if(isApproved()){
            alert("This record is already approved and cannot be deleted.");
            return;
        }

        showConfirm("delete", async ()=>{

            data.splice(index,1);

            await saveIncomingData(data);

            location.href="incoming.html";

        });

    };

}
