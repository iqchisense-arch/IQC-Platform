console.log("BOX MODULE LOADED");

/* ================= SESSION ================= */
const session = window.AppSession?.get() || JSON.parse(localStorage.getItem("loggedUser"));
if(!session) window.location.href="login.html";
if (window.AppAccess && !window.AppAccess.canAccessModule(session, "box")) {
    window.location.href = "index.html";
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
});

/* ================= DROPDOWNS ================= */

const BOX_COLORS = [
 "Brown",
 "White",
 "Green",
 "Blue",
 "Gray",
 "Orange"
];

const LINES = [
 "Line 1",
 "Line 2",
 "Line 3",
 "Line 4",
 "Line 5",
 "Line 6",
 "Line 7",
 "Line 8",
 "Line 9",
 "Line 10",
 "Line 11",
 "Line 12",
 "Line 13",
 "Line 14",
 "Line 15",
];

function loadDropdowns(){

   if(colorInput){
      colorInput.innerHTML = `<option value="">Select Color</option>`;

      BOX_COLORS.forEach(c=>{
         colorInput.innerHTML += `<option value="${c}">${c}</option>`;
      });
   }

   if(lineInput){
      lineInput.innerHTML = `<option value="">Select Line</option>`;

      LINES.forEach(l=>{
         lineInput.innerHTML += `<option value="${l}">${l}</option>`;
      });
   }

}

/* ================= STORAGE ================= */
function getBoxData(){
   return window.AppStore ? window.AppStore.getDataset("boxData") : (JSON.parse(localStorage.getItem("boxData")) || []);
}
function saveBoxData(data){
   return window.AppStore ? window.AppStore.setDataset("boxData", data) : localStorage.setItem("boxData", JSON.stringify(data));
}
async function getFreshBoxData(){
   return window.AppStore?.refreshDataset ? await window.AppStore.refreshDataset("boxData") : getBoxData();
}
async function getNextBoxSerial(){
   return window.AppStore?.nextDatasetId ? await window.AppStore.nextDatasetId("boxData") : generateBoxSerial();
}

/* ================= SERIAL ================= */
function generateBoxSerial(){
   const data = getBoxData();
   const today = new Date();
   const year  = today.getFullYear().toString().slice(-2);
   const month = String(today.getMonth()+1).padStart(2,"0");
   const prefix = `BOX${year}${month}`;
   const monthly = data.filter(r=>r.id.startsWith(prefix));
   const consecutive = String(monthly.length+1).padStart(3,"0");
   return `${prefix}-${consecutive}`;
}

/* ================= DOM ================= */
const modal = document.getElementById("boxModal");
const addBtn = document.getElementById("addBox");
const cancelBtn = document.getElementById("cancelBox");
const saveBtn = document.getElementById("saveBox");

const partInput    = document.getElementById("partNumberInput");
const descInput    = document.getElementById("descriptionInput");
const modelInput   = document.getElementById("modelInput");
const rollingInput = document.getElementById("rollingInput");

const lineInput  = document.getElementById("lineInput");
const colorInput = document.getElementById("colorInput");

const qtyInspectedInput = document.getElementById("qtyInspected");
const levelAInput = document.getElementById("levelA");
const damagedTotalInput = document.getElementById("damagedTotal");

const planQtyInput     = document.getElementById("planQtyInput");
const marketInput      = document.getElementById("marketInput");
const sparePartsInput  = document.getElementById("sparePartsInput");

const damagePhotoSection = document.getElementById("boxPhotoSection");
const damagePhotoInput   = document.getElementById("damagePhotoInput");
const commentsInput      = document.getElementById("commentsInput");

/* ================= MARKET AUTOCOMPLETE ================= */

const COUNTRY_LIST = [
 {name:"Mexico", code:"MX"},
 {name:"United States", code:"US"},
 {name:"Canada", code:"CA"},
 {name:"Brazil", code:"BR"},
 {name:"Argentina", code:"AR"},
 {name:"Chile", code:"CL"},
 {name:"Colombia", code:"CO"},
 {name:"Peru", code:"PE"},
 {name:"Germany", code:"DE"},
 {name:"France", code:"FR"},
 {name:"Spain", code:"ES"},
 {name:"Italy", code:"IT"},
 {name:"United Kingdom", code:"UK"},
 {name:"Netherlands", code:"NL"},
 {name:"Belgium", code:"BE"},
 {name:"Poland", code:"PL"},
 {name:"Czech Republic", code:"CZ"},
 {name:"Hungary", code:"HU"},
 {name:"Romania", code:"RO"},
 {name:"Turkey", code:"TR"},
 {name:"China", code:"CN"},
 {name:"Japan", code:"JP"},
 {name:"South Korea", code:"KR"},
 {name:"India", code:"IN"},
 {name:"Vietnam", code:"VN"},
 {name:"Thailand", code:"TH"},
 {name:"Philippines", code:"PH"},
 {name:"Indonesia", code:"ID"},
 {name:"Australia", code:"AU"},
 {name:"New Zealand", code:"NZ"},
 {name:"South Africa", code:"ZA"}
];

let currentFocus = -1;

if(marketInput){

    const suggestionBox = document.createElement("div");
    suggestionBox.className = "autocomplete-box";
    marketInput.parentNode.appendChild(suggestionBox);

    marketInput.addEventListener("input", function(){

        const value = this.value.toLowerCase().trim();
        suggestionBox.innerHTML = "";
        currentFocus = -1;

        if(value.length === 0) return;

        const matches = COUNTRY_LIST
            .filter(c =>
                c.name.toLowerCase().startsWith(value)
            )
            .slice(0,6);

        matches.forEach(country=>{
            const item = document.createElement("div");
            item.className = "autocomplete-item";
            item.innerHTML = `<strong>${country.name}</strong> - ${country.code}`;

            item.addEventListener("click", ()=>{
                marketInput.value =
                    `${country.name} - ${country.code}`;
                suggestionBox.innerHTML = "";
            });

            suggestionBox.appendChild(item);
        });
    });

    /* KEYBOARD SUPPORT */
    marketInput.addEventListener("keydown", function(e){

        const items = suggestionBox.getElementsByClassName("autocomplete-item");

        if(e.key === "ArrowDown"){
            currentFocus++;
            addActive(items);
        }
        else if(e.key === "ArrowUp"){
            currentFocus--;
            addActive(items);
        }
        else if(e.key === "Enter"){
            e.preventDefault();
            if(currentFocus > -1 && items[currentFocus]){
                items[currentFocus].click();
            }
        }
    });

    function addActive(items){
        if(!items) return;
        removeActive(items);

        if(currentFocus >= items.length) currentFocus = 0;
        if(currentFocus < 0) currentFocus = items.length - 1;

        items[currentFocus].classList.add("autocomplete-active");
    }

    function removeActive(items){
        for(let i=0;i<items.length;i++){
            items[i].classList.remove("autocomplete-active");
        }
    }

    document.addEventListener("click", function(e){
        if(e.target !== marketInput){
            suggestionBox.innerHTML = "";
        }
    });
}

/* ================= MODAL ================= */
addBtn.onclick = ()=> modal.style.display="flex";

cancelBtn.onclick = ()=>{
   modal.style.display="none";

   document.querySelectorAll("#boxModal input, #boxModal textarea")
       .forEach(el=>el.value="");

   document.querySelectorAll("#boxModal select")
       .forEach(el=>el.selectedIndex=0);

   damagePhotoInput.value="";
   if(damagePhotoSection)
       damagePhotoSection.style.display="none";
};

/* ================= PART AUTOFILL ================= */
partInput.addEventListener("change", e=>{
   if(!PARTS_READY){
       alert("Parts DB still loading");
       return;
   }

   const pn = e.target.value.trim().toUpperCase();

   if(!PART_DATABASE[pn]){
      alert("Part number not found");
      partInput.value="";
      descInput.value="";
      return;
   }

   descInput.value = PART_DATABASE[pn];
});

/* ================= DAMAGE CALC ================= */
function getValue(id){
    return Number(document.getElementById(id)?.value) || 0;
}

function updateDamageTotals(){

    const bTotal =
        getValue("b_efm") +
        getValue("b_pfa") +
        getValue("b_wh") +
        getValue("b_hq");

    const cTotal =
        getValue("c_efm") +
        getValue("c_pfa") +
        getValue("c_wh") +
        getValue("c_hq");

    const inspected = Number(qtyInspectedInput?.value) || 0;
    const levelA = Number(levelAInput?.value) || 0;

    const damagedTotal = bTotal + cTotal;

    if(damagedTotalInput)
        damagedTotalInput.value = damagedTotal;

    if(levelA + damagedTotal !== inspected && inspected !== 0){
        if(damagedTotalInput)
            damagedTotalInput.style.border = "2px solid red";
    }else{
        if(damagedTotalInput)
            damagedTotalInput.style.border = "";
    }

    if(damagePhotoSection)
        damagePhotoSection.style.display =
            damagedTotal > 0 ? "block" : "none";

    return { bTotal, cTotal, damagedTotal };
}

/* ================= LISTENERS ================= */
[
 "b_efm","b_pfa","b_wh","b_hq",
 "c_efm","c_pfa","c_wh","c_hq",
 "levelA","qtyInspected"
].forEach(id=>{
    const el = document.getElementById(id);
    if(el) el.addEventListener("input", updateDamageTotals);
});

/* ================= SAVE ================= */
saveBtn.onclick = async ()=>{
try{
   if(!PARTS_READY){
       alert("Parts DB loading");
       return;
   }

   if(!partInput.value || !lineInput.value || !colorInput.value){
      alert("Complete required fields");
      return;
   }

   const { bTotal, cTotal, damagedTotal } = updateDamageTotals();

   const inspected = Number(qtyInspectedInput.value) || 0;
   const levelA = Number(levelAInput.value) || 0;

   if(levelA + damagedTotal !== inspected){
       alert("Level A + Damaged must equal Quantity Inspected");
       return;
   }

   const data = await getFreshBoxData();
   const id = await getNextBoxSerial();

   let damagePhotoKey = null;

   if(damagePhotoInput?.files[0]){
       damagePhotoKey = id+"_damage";
       await savePhoto(damagePhotoKey, damagePhotoInput.files[0]);
   }

   data.push({
     id,
     date:new Date().toLocaleString(),
     dateISO:new Date().toISOString(),
     shift: session.shift,
     inspector:session.name,

     color:colorInput.value,
     line:lineInput.value,
     partNumber:partInput.value,
     description:descInput.value,
     model:modelInput.value,
     rolling:rollingInput.value,

     qtyInspected:inspected,
     levelA:levelA,
     levelB:bTotal,
     levelC:cTotal,
     damagedTotal:damagedTotal,

     damageBreakdown:{
        B:{
          EFM:getValue("b_efm"),
          PFA:getValue("b_pfa"),
          WH:getValue("b_wh"),
          HQ:getValue("b_hq")
        },
        C:{
          EFM:getValue("c_efm"),
          PFA:getValue("c_pfa"),
          WH:getValue("c_wh"),
          HQ:getValue("c_hq")
        }
     },

     planQty:Number(planQtyInput.value) || 0,
     market:marketInput.value,
     spareParts:Number(sparePartsInput.value) || 0,
     comments:commentsInput.value,
     approvalStatus:"Pending",
     approvedBy:"",
     approvedRole:"",
     approvedAt:"",

     damagePhoto:damagePhotoKey
   });

   await saveBoxData(data);
   location.reload();

}catch(err){
   console.error(err);
   alert("Error saving inspection");
}
};

/* ================= VIEW SWITCH ================= */
const gridBtn = document.getElementById("gridViewBtn");
const listBtn = document.getElementById("listViewBtn");
const listContainer = document.getElementById("boxList");
const userFilter = document.getElementById("boxUserFilter");
const dateFromFilter = document.getElementById("boxDateFrom");
const dateToFilter = document.getElementById("boxDateTo");
const clearFiltersBtn = document.getElementById("clearBoxFilters");

let currentView = localStorage.getItem("boxView") || "grid";

function applyView(view){
    currentView = view;

    if(gridBtn && listBtn){
        gridBtn.classList.toggle("active", view === "grid");
        listBtn.classList.toggle("active", view === "list");
    }

    localStorage.setItem("boxView", view);

    renderBox(); // 🔥 clave
}

// Estado inicial
applyView(currentView);

if(gridBtn && listBtn){
    gridBtn.onclick = () => applyView("grid");
    listBtn.onclick = () => applyView("list");
}

/* ================= PERMISSIONS FILTER ================= */

function filterBoxByUser(data){

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

    return [];
}

function parseRecordDate(value){
    const parsed = value ? new Date(value) : null;
    return parsed && !isNaN(parsed) ? parsed : null;
}

function applyBoxFilters(data){
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

function populateBoxFilterOptions(data){
    if(userFilter){
        const current = userFilter.value;
        const users = [...new Set(data.map(rec => rec.inspector).filter(Boolean))].sort();
        userFilter.innerHTML = `<option value="">All inspectors</option>` + users.map(u => `<option value="${u}">${u}</option>`).join("");
        userFilter.value = users.includes(current) ? current : "";
    }
}

/* ================= RENDER ================= */
function renderBox(){
 const rawData = getBoxData();
 const visibleData = filterBoxByUser(rawData);
 populateBoxFilterOptions(visibleData);
 const data = applyBoxFilters(visibleData);
 if(!listContainer) return;
 listContainer.innerHTML="";

 if(data.length===0){
   listContainer.innerHTML=
     "<h2 style='text-align:center'>No box inspections yet</h2>";
   return;
 }

 const reversed=data.slice().reverse();

 if(currentView==="grid"){
   reversed.forEach((rec,index)=>{
      const realIndex=rawData.findIndex(item => item.id === rec.id);
      const card=document.createElement("div");
      card.className="rtv-card";
      card.innerHTML=
      `<strong>${rec.id}</strong><br>
       ${rec.line} • ${rec.color}<br>
       ${rec.partNumber}<br>
       Damaged: <b>${rec.damagedTotal || 0}</b><br>
       Approval: ${rec.approvalStatus === "Approved" ? "Approved" : "Pending"}`;
      card.onclick=()=>{
         localStorage.setItem("currentBox", realIndex);
         window.location.href="box-detail.html";
      };
      listContainer.appendChild(card);
   });
   return;
 }

 const table=document.createElement("table");
 table.className="rtv-table";
 table.innerHTML=
 `<thead>
   <tr>
     <th>ID</th>
     <th>Date</th>
     <th>Line</th>
     <th>Part</th>
     <th>Model</th>
     <th>Damaged</th>
     <th>Approval</th>
   </tr>
 </thead><tbody></tbody>`;

 const tbody=table.querySelector("tbody");

 reversed.forEach((rec,index)=>{
   const realIndex=rawData.findIndex(item => item.id === rec.id);
   const row=document.createElement("tr");
   row.innerHTML=
   `<td><b>${rec.id}</b></td>
    <td>${rec.date}</td>
    <td>${rec.line}</td>
   <td>${rec.partNumber}</td>
   <td>${rec.model}</td>
   <td>${rec.damagedTotal || 0}</td>
   <td>${rec.approvalStatus === "Approved" ? "Approved" : "Pending"}</td>`;

   row.onclick=()=>{
      localStorage.setItem("currentBox", realIndex);
      window.location.href="box-detail.html";
   };

   tbody.appendChild(row);
 });

 listContainer.appendChild(table);
}

renderBox();

[userFilter, dateFromFilter, dateToFilter].forEach(el => {
    el?.addEventListener("change", renderBox);
});

clearFiltersBtn?.addEventListener("click", ()=>{
    if(userFilter) userFilter.value = "";
    if(dateFromFilter) dateFromFilter.value = "";
    if(dateToFilter) dateToFilter.value = "";
    renderBox();
});

if(window.AppAccess && !window.AppAccess.canEditModule(session, "box")){
    if(addBtn) addBtn.style.display = "none";
}

/* ================= EXPORT EXCEL ================= */

const exportBtn = document.getElementById("exportBoxBtn");

if(exportBtn){
    exportBtn.addEventListener("click", exportToExcel);
}

function exportToExcel(){

    const rawData = getBoxData();
    const data = applyBoxFilters(filterBoxByUser(rawData));

    if(!data.length){
        alert("No data to export.");
        return;
    }

    const formattedData = data.map(rec => ({

        ID: rec.id,
        Date: rec.date,
        Inspector: rec.inspector,

        Line: rec.line,
        Color: rec.color,
        "Part Number": rec.partNumber,
        Description: rec.description,
        Model: rec.model,
        Rolling: rec.rolling,

        "Qty Inspected": rec.qtyInspected,
        "Level A": rec.levelA,
        "Level B": rec.levelB,
        "Level C": rec.levelC,
        "Total Damaged": rec.damagedTotal,

        /* Breakdown Level B */
        "B - EFM": rec.damageBreakdown?.B?.EFM ?? 0,
        "B - PFA": rec.damageBreakdown?.B?.PFA ?? 0,
        "B - WH":  rec.damageBreakdown?.B?.WH ?? 0,
        "B - HQ":  rec.damageBreakdown?.B?.HQ ?? 0,

        /* Breakdown Level C */
        "C - EFM": rec.damageBreakdown?.C?.EFM ?? 0,
        "C - PFA": rec.damageBreakdown?.C?.PFA ?? 0,
        "C - WH":  rec.damageBreakdown?.C?.WH ?? 0,
        "C - HQ":  rec.damageBreakdown?.C?.HQ ?? 0,

        Market: rec.market,
        "Plan Qty": rec.planQty,
        "Spare Parts": rec.spareParts,
        Comments: rec.comments
    }));

    const worksheet = XLSX.utils.json_to_sheet(formattedData);
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, "Box Inspections");

    const today = new Date();
    const fileName = `Box_Inspection_${today.getFullYear()}-${today.getMonth()+1}-${today.getDate()}.xlsx`;

    XLSX.writeFile(workbook, fileName);
}
document.addEventListener("DOMContentLoaded", () => {
    loadDropdowns();
});
