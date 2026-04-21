const session = window.AppSession?.get() || JSON.parse(localStorage.getItem("loggedUser"));
if(!session) window.location.href = "login.html";
if(session.role !== "Admin") window.location.href = "index.html";

const vendorTableBody = document.getElementById("vendorTableBody");
const vendorCount = document.getElementById("vendorCount");
const vendorCreateForm = document.getElementById("vendorCreateForm");
const vendorNameInput = document.getElementById("vendorNameInput");
const vendorPasswordInput = document.getElementById("vendorPasswordInput");
const passwordModal = document.getElementById("passwordModal");
const passwordModalLabel = document.getElementById("passwordModalLabel");
const newVendorPasswordInput = document.getElementById("newVendorPasswordInput");
const saveVendorPasswordBtn = document.getElementById("saveVendorPasswordBtn");
const cancelVendorPasswordBtn = document.getElementById("cancelVendorPasswordBtn");
const adminVerifyModal = document.getElementById("adminVerifyModal");
const adminVerifyPasswordInput = document.getElementById("adminVerifyPasswordInput");
const confirmAdminVerifyBtn = document.getElementById("confirmAdminVerifyBtn");
const cancelAdminVerifyBtn = document.getElementById("cancelAdminVerifyBtn");

let vendors = [];
let selectedVendorId = null;
let selectedVendorName = "";
let pendingAdminAction = null;

function escapeHtml(value){
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

async function loadVendors(){
    try{
        const response = await window.AppBackend.listVendors();
        vendors = response.vendors || [];
        renderVendors();
    }catch(error){
        console.error(error);
        showAppAlert("Unable to load vendor accounts.", "error");
    }
}

function renderVendors(){
    vendorCount.textContent = `${vendors.length} vendors`;
    vendorTableBody.innerHTML = "";

    if(!vendors.length){
        vendorTableBody.innerHTML = `<tr><td colspan="6">No vendor accounts found.</td></tr>`;
        return;
    }

    vendors.forEach(vendor => {
        const row = document.createElement("tr");
        row.innerHTML = `
        <td>${escapeHtml(vendor.name)}</td>
        <td><strong>${escapeHtml(vendor.username)}</strong></td>
        <td><span class="status-pill ${vendor.isActive ? "active" : "inactive"}">${vendor.isActive ? "Active" : "Inactive"}</span></td>
        <td>${escapeHtml((vendor.moduleAccess || []).join(", ") || "incomingData, rtvData")}</td>
        <td>${vendor.readOnly ? "Read only" : "Editable"}</td>
        <td>
            <div class="admin-actions">
                <button class="admin-action-btn toggle" data-action="toggle" data-id="${vendor.id}">
                    ${vendor.isActive ? "Deactivate" : "Activate"}
                </button>
                <button class="admin-action-btn password" data-action="password" data-id="${vendor.id}" data-name="${escapeHtml(vendor.name)}">
                    Change Password
                </button>
                <button class="admin-action-btn password" data-action="reset-password" data-id="${vendor.id}">
                    Reset Password
                </button>
            </div>
        </td>
        `;
        vendorTableBody.appendChild(row);
    });
}

vendorCreateForm.addEventListener("submit", async (event)=>{
    event.preventDefault();

    const vendorName = vendorNameInput.value.trim();
    const password = vendorPasswordInput.value.trim();

    if(!vendorName || !password){
        showAppAlert("Vendor name and password are required.", "warning");
        return;
    }

    try{
        await window.AppBackend.createVendor(vendorName, password);
        vendorNameInput.value = "";
        vendorPasswordInput.value = "";
        showAppAlert("Vendor account created successfully.", "success");
        await loadVendors();
    }catch(error){
        console.error(error);
        showAppAlert("Unable to create vendor account. It may already exist.", "error");
    }
});

vendorTableBody.addEventListener("click", async (event)=>{
    const button = event.target.closest("button[data-action]");
    if(!button) return;

    const action = button.dataset.action;
    const userId = Number(button.dataset.id);
    const vendor = vendors.find(item => item.id === userId);
    if(!vendor) return;

    if(action === "toggle"){
        const nextStatus = !vendor.isActive;
        showAppConfirm(
            `${nextStatus ? "Activate" : "Deactivate"} ${vendor.name}?`,
            async ()=>{
                try{
                    await window.AppBackend.updateVendorStatus(userId, nextStatus);
                    showAppAlert(`Vendor ${nextStatus ? "activated" : "deactivated"} successfully.`, "success");
                    await loadVendors();
                }catch(error){
                    console.error(error);
                    showAppAlert("Unable to update vendor status.", "error");
                }
            },
            {
                title: nextStatus ? "Activate Vendor" : "Deactivate Vendor",
                confirmLabel: nextStatus ? "Activate" : "Deactivate",
                danger: !nextStatus,
                icon: nextStatus ? "✓" : "⚠"
            }
        );
        return;
    }

    if(action === "password"){
        selectedVendorId = userId;
        selectedVendorName = vendor.name;
        passwordModalLabel.textContent = `Vendor: ${vendor.name}`;
        newVendorPasswordInput.value = "";
        passwordModal.classList.add("show");
        return;
    }

    if(action === "reset-password"){
        pendingAdminAction = async ()=>{
            try{
                const response = await window.AppBackend.resetVendorPassword(userId);
                showAppAlert(
                    `Temporary password for ${vendor.name}:\n\n${response.temporaryPassword}\n\nCurrent passwords cannot be recovered because they are stored as secure hashes.`,
                    "success"
                );
                await loadVendors();
            }catch(error){
                console.error(error);
                showAppAlert("Unable to reset vendor password.", "error");
            }
        };
        adminVerifyPasswordInput.value = "";
        adminVerifyModal.classList.add("show");
    }
});

cancelVendorPasswordBtn.addEventListener("click", ()=>{
    passwordModal.classList.remove("show");
});

saveVendorPasswordBtn.addEventListener("click", async ()=>{
    const password = newVendorPasswordInput.value.trim();
    if(!selectedVendorId){
        passwordModal.classList.remove("show");
        return;
    }

    if(password.length < 6){
        showAppAlert("Password must be at least 6 characters.", "warning");
        return;
    }

    try{
        await window.AppBackend.updateVendorPassword(selectedVendorId, password);
        passwordModal.classList.remove("show");
        showAppAlert(`Password updated for ${selectedVendorName}.`, "success");
        await loadVendors();
    }catch(error){
        console.error(error);
        showAppAlert("Unable to update vendor password.", "error");
    }
});

passwordModal.addEventListener("click", (event)=>{
    if(event.target === passwordModal){
        passwordModal.classList.remove("show");
    }
});

cancelAdminVerifyBtn.addEventListener("click", ()=>{
    adminVerifyModal.classList.remove("show");
    pendingAdminAction = null;
});

confirmAdminVerifyBtn.addEventListener("click", async ()=>{
    const password = adminVerifyPasswordInput.value;
    if(!password){
        showAppAlert("Admin password is required.", "warning");
        return;
    }

    try{
        await window.AppBackend.adminReauth(password);
        adminVerifyModal.classList.remove("show");
        const action = pendingAdminAction;
        pendingAdminAction = null;
        if(action) await action();
    }catch(error){
        console.error(error);
        showAppAlert("Admin password is incorrect.", "error");
    }
});

adminVerifyModal.addEventListener("click", (event)=>{
    if(event.target === adminVerifyModal){
        adminVerifyModal.classList.remove("show");
        pendingAdminAction = null;
    }
});

document.addEventListener("DOMContentLoaded", loadVendors);
