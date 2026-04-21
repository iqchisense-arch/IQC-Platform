const session = window.AppSession?.get() || JSON.parse(localStorage.getItem("loggedUser"));
if(!session) window.location.href = "login.html";
if(session.role !== "Admin") window.location.href = "index.html";

const userTableBody = document.getElementById("userTableBody");
const userCount = document.getElementById("userCount");
const userCreateForm = document.getElementById("userCreateForm");
const userEditModal = document.getElementById("userEditModal");
const saveUserBtn = document.getElementById("saveUserBtn");
const cancelUserBtn = document.getElementById("cancelUserBtn");
const resetUserPasswordBtn = document.getElementById("resetUserPasswordBtn");

const createNameInput = document.getElementById("createNameInput");
const createUsernameInput = document.getElementById("createUsernameInput");
const createPasswordInput = document.getElementById("createPasswordInput");
const createRoleInput = document.getElementById("createRoleInput");
const createShiftInput = document.getElementById("createShiftInput");
const createEmpInput = document.getElementById("createEmpInput");
const createDateInput = document.getElementById("createDateInput");
const createLevelInput = document.getElementById("createLevelInput");
const createPhotoInput = document.getElementById("createPhotoInput");

const editNameInput = document.getElementById("editNameInput");
const editUsernameInput = document.getElementById("editUsernameInput");
const editRoleInput = document.getElementById("editRoleInput");
const editShiftInput = document.getElementById("editShiftInput");
const editEmpInput = document.getElementById("editEmpInput");
const editDateInput = document.getElementById("editDateInput");
const editLevelInput = document.getElementById("editLevelInput");
const editStatusInput = document.getElementById("editStatusInput");
const editPhotoInput = document.getElementById("editPhotoInput");
const editPhotoFileInput = document.getElementById("editPhotoFileInput");
const editPasswordInput = document.getElementById("editPasswordInput");
const editAuditInfo = document.getElementById("editAuditInfo");

const adminVerifyModal = document.getElementById("adminVerifyModal");
const adminVerifyPasswordInput = document.getElementById("adminVerifyPasswordInput");
const confirmAdminVerifyBtn = document.getElementById("confirmAdminVerifyBtn");
const cancelAdminVerifyBtn = document.getElementById("cancelAdminVerifyBtn");

let users = [];
let selectedUserId = null;
let pendingAdminAction = null;

function escapeHtml(value){
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

async function loadUsers(){
    try{
        const response = await window.AppBackend.listUsers();
        users = (response.users || []).filter(user => user.role !== "Vendor");
        renderUsers();
    }catch(error){
        console.error(error);
        showAppAlert("Unable to load internal users.", "error");
    }
}

function renderUsers(){
    userCount.textContent = `${users.length} users`;
    userTableBody.innerHTML = "";

    if(!users.length){
        userTableBody.innerHTML = `<tr><td colspan="6">No internal users found.</td></tr>`;
        return;
    }

    users.forEach(user => {
        const row = document.createElement("tr");
        row.innerHTML = `
        <td>${escapeHtml(user.name)}</td>
        <td><strong>${escapeHtml(user.username)}</strong></td>
        <td>${escapeHtml(user.role)}</td>
        <td>${escapeHtml(user.shift)}</td>
        <td><span class="status-pill ${user.isActive ? "active" : "inactive"}">${user.isActive ? "Active" : "Inactive"}</span></td>
        <td>
            <div class="admin-actions">
                <button class="admin-action-btn password" data-action="edit" data-id="${user.id}">Edit User</button>
            </div>
        </td>
        `;
        userTableBody.appendChild(row);
    });
}

function openEditModal(user){
    selectedUserId = user.id;
    editNameInput.value = user.name || "";
    editUsernameInput.value = user.username || "";
    editRoleInput.value = user.role || "Inspector";
    editShiftInput.value = user.shift || "";
    editEmpInput.value = user.emp || "";
    editDateInput.value = user.date || "";
    editLevelInput.value = user.level || "";
    editStatusInput.value = String(Boolean(user.isActive));
    editPhotoInput.value = user.photo || "";
    editPhotoFileInput.value = "";
    editPasswordInput.value = "";
    editAuditInfo.textContent = user.updatedAt
        ? `Last update: ${user.updatedAt} by ${user.updatedBy || "unknown"}`
        : "No audit data.";
    userEditModal.classList.add("show");
}

function openAdminVerify(action){
    pendingAdminAction = action;
    adminVerifyPasswordInput.value = "";
    adminVerifyModal.classList.add("show");
}

async function runAdminVerifiedAction(){
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
}

userCreateForm.addEventListener("submit", async (event)=>{
    event.preventDefault();

    const payload = {
        name: createNameInput.value.trim(),
        username: createUsernameInput.value.trim(),
        password: createPasswordInput.value.trim(),
        role: createRoleInput.value,
        shift: createShiftInput.value.trim() || "ALL",
        emp: createEmpInput.value.trim(),
        date: createDateInput.value.trim(),
        level: createLevelInput.value.trim(),
        photo: createPhotoInput.value.trim() || "img/inspectores/default.png",
        isActive: true
    };

    if(!payload.name || !payload.username || !payload.password){
        showAppAlert("Name, username and password are required.", "warning");
        return;
    }

    try{
        await window.AppBackend.createUser(payload);
        userCreateForm.reset();
        showAppAlert("User created successfully.", "success");
        await loadUsers();
    }catch(error){
        console.error(error);
        showAppAlert("Unable to create user. Verify username uniqueness and password length.", "error");
    }
});

userTableBody.addEventListener("click", (event)=>{
    const button = event.target.closest("button[data-action='edit']");
    if(!button) return;
    const userId = Number(button.dataset.id);
    const user = users.find(item => item.id === userId);
    if(!user) return;
    openEditModal(user);
});

cancelUserBtn.addEventListener("click", ()=>{
    userEditModal.classList.remove("show");
});

saveUserBtn.addEventListener("click", async ()=>{
    if(!selectedUserId){
        userEditModal.classList.remove("show");
        return;
    }

    const payload = {
        name: editNameInput.value.trim(),
        username: editUsernameInput.value.trim(),
        role: editRoleInput.value,
        shift: editShiftInput.value.trim(),
        emp: editEmpInput.value.trim(),
        date: editDateInput.value.trim(),
        level: editLevelInput.value.trim(),
        isActive: editStatusInput.value === "true",
        photo: editPhotoInput.value.trim()
    };

    const password = editPasswordInput.value.trim();
    if(password){
        payload.password = password;
    }

    if(!payload.name || !payload.username){
        showAppAlert("Name and username are required.", "warning");
        return;
    }

    try{
        if(editPhotoFileInput.files[0]){
            const uploadResponse = await window.AppBackend.uploadUserPhoto(selectedUserId, editPhotoFileInput.files[0]);
            payload.photo = uploadResponse.photo;
        }

        await window.AppBackend.updateUser(selectedUserId, payload);
        userEditModal.classList.remove("show");
        showAppAlert("User updated successfully.", "success");
        await loadUsers();
    }catch(error){
        console.error(error);
        showAppAlert("Unable to update user. Verify username uniqueness and password length.", "error");
    }
});

resetUserPasswordBtn.addEventListener("click", ()=>{
    if(!selectedUserId) return;
    const currentUser = users.find(item => item.id === selectedUserId);
    if(!currentUser) return;

    openAdminVerify(async ()=>{
        try{
            const response = await window.AppBackend.resetUserPassword(selectedUserId);
            showAppAlert(
                `Temporary password for ${currentUser.name}:\n\n${response.temporaryPassword}\n\nCurrent passwords cannot be recovered because they are stored as secure hashes.`,
                "success"
            );
            await loadUsers();
        }catch(error){
            console.error(error);
            showAppAlert("Unable to reset user password.", "error");
        }
    });
});

cancelAdminVerifyBtn.addEventListener("click", ()=>{
    adminVerifyModal.classList.remove("show");
    pendingAdminAction = null;
});

confirmAdminVerifyBtn.addEventListener("click", runAdminVerifiedAction);

userEditModal.addEventListener("click", (event)=>{
    if(event.target === userEditModal){
        userEditModal.classList.remove("show");
    }
});

adminVerifyModal.addEventListener("click", (event)=>{
    if(event.target === adminVerifyModal){
        adminVerifyModal.classList.remove("show");
        pendingAdminAction = null;
    }
});

document.addEventListener("DOMContentLoaded", loadUsers);
