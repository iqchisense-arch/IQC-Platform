const session = window.AppSession?.get() || JSON.parse(localStorage.getItem("loggedUser"));
if (session && window.AppAccess && !window.AppAccess.canAccessModule(session, "rtv")) {
window.location.href = "index.html";
}

/* =================================================
   RTV DETAIL CONTROLLER – FINAL COMPLETE VERSION
================================================= */

if (!window.RTV_DETAIL_LOADED) {
window.RTV_DETAIL_LOADED = true;

console.log("RTV DETAIL LOADED");

/* ================= GLOBAL STATE ================= */
let rtv = null;
let allRTV = [];
let indexRTV = null;

/* ================= DEFECT LIST ================= */
const DEFECT_LIST = [
 "Wet","Broken","Wrong part number","No label","Stained",
 "Bad packing","Out of dimension","Bad cut","Particle",
 "Print missing","Inverted print","Fugust","Electric damage BGA"
];

/* ================= PART DATABASE ================= */
let PART_DATABASE = {};
fetch("data/parts.json")
.then(res => res.json())
.then(data=>{
    data.forEach(p=>{
        PART_DATABASE[p.PartNumber.trim().toUpperCase()] = p.Description.trim();
    });
});

/* =================================================
   LOAD RTV FROM LOCALSTORAGE
================================================= */
function loadCurrentRTV(){

    indexRTV = Number(localStorage.getItem("currentRTV"));
    allRTV   = window.AppStore ? window.AppStore.getDataset("rtvData") : (JSON.parse(localStorage.getItem("rtvData")) || []);

    if(isNaN(indexRTV) || !allRTV[indexRTV]){
        alert("RTV no encontrado");
        window.location.href="rtv.html";
        return false;
    }

    rtv = allRTV[indexRTV];

    rtv.parts  = rtv.parts  || [];
    rtv.photos = rtv.photos || {};
    rtv.vendor = rtv.vendor || "";
    rtv.process = rtv.process || "RTV-FMA PROCESS / RETURN TO VENDOR";
    rtv.date   = rtv.date || new Date().toLocaleDateString();

    if(window.AppAccess && !window.AppAccess.recordMatchesVendor(rtv, session)){
        window.location.href = "rtv.html";
        return false;
    }

    return true;
}

/* =================================================
   START APP
================================================= */
document.addEventListener("DOMContentLoaded", () => {

if(!loadCurrentRTV()) return;

/* ===== DOM ===== */
const partsBody   = document.getElementById("partsTableBody");
const btnGenerate = document.getElementById("generatePDF");
const sendEmailBtn = document.getElementById("sendEmailBtn"); // ⭐ MOVER AQUÍ
const saveBtn     = document.getElementById("saveChanges");
const approveRTV  = document.getElementById("approveRTV");
const approvalStatusEl = document.getElementById("approvalStatus");
const approvalInfoRow = document.getElementById("approvalInfoRow");
const approvalInfoEl = document.getElementById("approvalInfo");


const editRTV     = document.getElementById("editRTV");
const editModal   = document.getElementById("editModal");
const cancelEdit  = document.getElementById("cancelEdit");
const confirmEdit = document.getElementById("confirmEdit");

const closeDeleteSuccess = document.getElementById("closeDeleteSuccess");

if(closeDeleteSuccess){

closeDeleteSuccess.onclick = ()=>{

document.getElementById("deleteSuccessModal").style.display="none";

window.location.href="rtv.html";

};

}

/* ================= ROLE PERMISSIONS ================= */

const ALLOWED_EMAIL_ROLES = ["Admin", "Engineer", "Group Leader"];

if(!session || !ALLOWED_EMAIL_ROLES.includes(session.role)){
    // ocultar botón si no tiene permiso
    sendEmailBtn.style.display = "none";
}

/* =================================================
   DELETE RTV (FIXED)
================================================= */

const deleteRTV      = document.getElementById("deleteRTV");
const deleteModal    = document.getElementById("deleteModal");
const cancelDelete   = document.getElementById("cancelDelete");
const confirmDelete  = document.getElementById("confirmDelete");

if(window.AppAccess && !window.AppAccess.canEditModule(session, "rtv")){
editRTV.style.display = "none";
deleteRTV.style.display = "none";
saveBtn.style.display = "none";
sendEmailBtn.style.display = "none";
}

function normalizeShift(value){
    return (value || "").trim().toUpperCase();
}

function isRTVApproved(){
    return (rtv.approvalStatus || "").trim() === "Approved";
}

function canApproveRTV(){
    if(!session || isRTVApproved()) return false;
    if(["Admin","Engineer","Manager","Director"].includes(session.role)) return true;
    return session.role === "Group Leader" && normalizeShift(session.shift) === normalizeShift(rtv.shift);
}

function applyApprovalControls(){
    if(approvalStatusEl){
        approvalStatusEl.textContent = isRTVApproved() ? "Approved" : "Pending";
        approvalStatusEl.className = isRTVApproved() ? "approval-pill approved" : "approval-pill pending";
    }

    if(approvalInfoRow && approvalInfoEl){
        if(isRTVApproved()){
            approvalInfoRow.style.display = "";
            approvalInfoEl.textContent = `${rtv.approvedBy || "-"}${rtv.approvedAt ? " / " + rtv.approvedAt : ""}`;
        }else{
            approvalInfoRow.style.display = "none";
        }
    }

    if(approveRTV){
        approveRTV.style.display = canApproveRTV() ? "block" : "none";
    }

    if(isRTVApproved()){
        editRTV.style.display = "none";
        deleteRTV.style.display = "none";
        saveBtn.style.display = "none";
    }
}

/* abrir modal */
deleteRTV.onclick = () => deleteModal.style.display = "flex";

/* cancelar */
cancelDelete.onclick = () => deleteModal.style.display = "none";

/* confirmar eliminación */
confirmDelete.onclick = async () => {

try{

if(isRTVApproved()){
alert("This RTV is already approved and cannot be deleted.");
deleteModal.style.display = "none";
return;
}

if(rtv.photos?.part) await deletePhoto(rtv.photos.part);
if(rtv.photos?.material) await deletePhoto(rtv.photos.material);
if(rtv.photos?.issue) await deletePhoto(rtv.photos.issue);

allRTV.splice(indexRTV,1);
if (window.AppStore) {
await window.AppStore.setDataset("rtvData", allRTV);
} else {
localStorage.setItem("rtvData", JSON.stringify(allRTV));
}

/* SHOW SUCCESS MODAL */

document.getElementById("deleteModal").style.display="none";

const successModal = document.getElementById("deleteSuccessModal");

successModal.style.display="flex";

}catch(err){

console.error(err);
alert("Error deleting RTV");

}

};
if(approveRTV){
approveRTV.onclick = async () => {
    if(!canApproveRTV()){
        alert("You don't have permission to approve this RTV.");
        return;
    }

    rtv.approvalStatus = "Approved";
    rtv.approvedBy = session.name || "";
    rtv.approvedRole = session.role || "";
    rtv.approvedAt = new Date().toLocaleString();

    allRTV[indexRTV] = rtv;
    if(window.AppStore){
        await window.AppStore.setDataset("rtvData", allRTV);
    }else{
        localStorage.setItem("rtvData", JSON.stringify(allRTV));
    }

    applyApprovalControls();
    alert("RTV approved successfully.");
};
}
/* =================================================
   RENDER DETAIL
================================================= */
function renderDetail(){

    rtvDetailTitle.textContent = rtv.id;
    vendor.textContent    = rtv.vendor;
    process.textContent   = rtv.process;
    line.textContent      = rtv.line;
    inspector.textContent = rtv.inspector;
    date.textContent      = rtv.date;
    applyApprovalControls();

    partsBody.innerHTML = "";

    rtv.parts.forEach(p=>{
        partsBody.insertAdjacentHTML("beforeend", `
            <tr>
                <td>${p.partNumber}</td>
                <td>${p.description}</td>
                <td>${p.qty}</td>
                <td>${p.defect}</td>
            </tr>
        `);
    });
}
renderDetail();

/* =================================================
   LOAD PHOTOS
================================================= */

async function loadPhotos(){

await loadPhotoToImg(rtv.photos?.part,"photoPartView");
await loadPhotoToImg(rtv.photos?.material,"photoMaterialView");
await loadPhotoToImg(rtv.photos?.issue,"photoIssueView");

}

loadPhotos();

/* =================================================
   GENERATE WORD
================================================= */
btnGenerate.onclick = async ()=>{
    try{
        btnGenerate.disabled = true;
        btnGenerate.innerText = "Generating...";
        await generateRTVWord(rtv);
        btnGenerate.disabled = false;
        btnGenerate.innerText = "Generate RTV Document";
    }catch(err){
        console.error(err);
        alert("Error generating document");
        btnGenerate.disabled = false;
        btnGenerate.innerText = "Generate RTV Document";
    }
    // ⭐ ACTUALIZAR STATUS A EMAIL SENT
      const allRTV = window.AppStore ? window.AppStore.getDataset("rtvData") : (JSON.parse(localStorage.getItem("rtvData")) || []);
      const indexRTV = Number(localStorage.getItem("currentRTV"));

     if(!isRTVApproved() && !isNaN(indexRTV) && allRTV[indexRTV]){
      allRTV[indexRTV].status = "EMAIL SENT";
      if (window.AppStore) {
      await window.AppStore.setDataset("rtvData", allRTV);
      } else {
      localStorage.setItem("rtvData", JSON.stringify(allRTV));
      }
}

};

sendEmailBtn.onclick = async ()=>{

    const ALLOWED_SENDERS = [
        "Ofelia Jimenez",
        "William Barreto",
        "Carmen Estrada",
        "Ruben Hernandez",
        "Jose Garcia",
        "Qiuchunguang",
        "Samuel Gomez"
    ];

    const session = window.AppSession?.get() || JSON.parse(localStorage.getItem("loggedUser"));
    const userName = (session?.name || "").trim();

    if(!ALLOWED_SENDERS.includes(userName)){
        alert("You don't have the permissions to send the document.\n\nPlease contact a Group Leader or Engineer.");
        return;
    }

    try{
        // 1️⃣ generar Word
        await generateRTVWord(rtv);

        // ⭐ 2️⃣ CAMBIAR STATUS ANTES DE ABRIR GMAIL
        const allRTV = window.AppStore ? window.AppStore.getDataset("rtvData") : (JSON.parse(localStorage.getItem("rtvData")) || []);
        const indexRTV = Number(localStorage.getItem("currentRTV"));

        if(!isRTVApproved() && !isNaN(indexRTV) && allRTV[indexRTV]){
            allRTV[indexRTV].status = "EMAIL SENT";
            if (window.AppStore) {
            await window.AppStore.setDataset("rtvData", allRTV);
            } else {
            localStorage.setItem("rtvData", JSON.stringify(allRTV));
            }
        }

        if(!isRTVApproved()){
            rtv.status = "EMAIL SENT";
        }

        // 3 abrir Coremail draft
        await openRTVEmail(rtv, { notify: true, attachmentGenerated: true });

        alert(isRTVApproved() ? "RTV email generated." : "RTV status updated to EMAIL SENT");

    }catch(err){
        console.error(err);
        alert("Error generating email");
    }
};



/* =================================================
   EDIT RTV
================================================= */

editRTV.onclick = () => editModal.style.display = "flex";
cancelEdit.onclick = () => editModal.style.display = "none";

confirmEdit.onclick = () => {
    editModal.style.display = "none";
    enableEditMode();
};

function enableEditMode(){

    if(isRTVApproved()){
        alert("This RTV is already approved and cannot be modified.");
        return;
    }

    // mostrar header Action
    const actionHeader = document.getElementById("actionHeader");
    actionHeader.style.display = "table-cell";

    saveBtn.style.display = "block";

    document.querySelectorAll("#partsTableBody tr").forEach(row=>{

        const pn     = row.children[0].innerText;
        const desc   = row.children[1].innerText;
        const qty    = row.children[2].innerText;
        const defect = row.children[3].innerText;

        row.children[0].innerHTML = `<input class="edit-pn" value="${pn}">`;
        row.children[1].innerHTML = `<input class="edit-desc" value="${desc}" disabled>`;
        row.children[2].innerHTML = `<input type="number" class="edit-qty" value="${qty}">`;

        const options = DEFECT_LIST
            .map(d => `<option ${d===defect ? "selected" : ""}>${d}</option>`)
            .join("");

        row.children[3].innerHTML = `<select class="edit-defect">${options}</select>`;

        // crear celda Action
        const actionCell = document.createElement("td");
        actionCell.className = "action-cell";
        actionCell.innerHTML = `<span class="delete-row">✖</span>`;

        row.appendChild(actionCell);
    });

    activatePartValidation();
    activateRowDelete();
}

/* validar PN */
function activatePartValidation(){
    document.querySelectorAll(".edit-pn").forEach((input,i)=>{
        input.addEventListener("change",e=>{
            const pn=e.target.value.trim().toUpperCase();
            const desc=document.querySelectorAll(".edit-desc")[i];
            if(!PART_DATABASE[pn]){
                alert("Part number not found");
                e.target.value=""; desc.value="";
                return;
            }
            desc.value=PART_DATABASE[pn];
        });
    });
}

/* eliminar fila */
function activateRowDelete(){
    document.querySelectorAll(".delete-row").forEach(btn=>{
        btn.onclick=()=>{
            showAppConfirm("Remove this part?", ()=>{
                btn.closest("tr").remove();
            }, {
                title: "Delete Part",
                confirmLabel: "Delete",
                danger: true,
                icon: "⚠"
            });
        };
    });
}

/* guardar cambios */
saveBtn.onclick = async ()=>{
    if(isRTVApproved()){
        alert("This RTV is already approved and cannot be modified.");
        return;
    }

    const rows=document.querySelectorAll("#partsTableBody tr");
    const updatedParts=[];

    for(const row of rows){
        const pn=row.querySelector(".edit-pn").value.trim().toUpperCase();
        const desc=row.querySelector(".edit-desc").value.trim();
        const qty=row.querySelector(".edit-qty").valueAsNumber;
        const defect=row.querySelector(".edit-defect").value;

        if(!pn||!desc||!defect||isNaN(qty)||qty<=0){
            alert("Complete all fields");
            return;
        }

        updatedParts.push({partNumber:pn,description:desc,qty,defect});
    }

    rtv.parts=updatedParts;
    allRTV[indexRTV]=rtv;
    if (window.AppStore) {
    await window.AppStore.setDataset("rtvData", allRTV);
    } else {
    localStorage.setItem("rtvData",JSON.stringify(allRTV));
    }

    alert("RTV updated successfully");
    location.reload();
};

});
}
const printRTVBtn = document.getElementById("printRTVBtn");

printRTVBtn.onclick = ()=>{
   window.open("print-rtv.html","_blank");
};
