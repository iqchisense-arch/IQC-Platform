/* =====================================================
   IMAGE HELPERS (GLOBAL)
===================================================== */

window.getPhotoBuffer = async function(key){

try{

if(!key) return null;

const file = await getPhoto(key);

if(!file) return null;

let blob;

if(file instanceof Blob){
blob = file;
}else if(file.data){
blob = new Blob([file.data]);
}else{
blob = new Blob([file]);
}

return await blob.arrayBuffer();

}catch(err){

console.warn("Photo load error:",err);
return null;

}

};

window.getImageBuffer = async function(path){

const res = await fetch(path);
const blob = await res.blob();

return await blob.arrayBuffer();

};


/* =====================================================
   MAIN GENERATOR
===================================================== */

async function generateRTVWord(rtv){

const {
Document, Packer, Paragraph, Table, TableRow, TableCell,
WidthType, AlignmentType, ImageRun, BorderStyle, TextRun, Header, Footer
} = window.docx;


/* ===== helper celda texto ===== */

function textCell(text,bold=false,align="left"){
return new TableCell({
children:[
new Paragraph({
alignment:AlignmentType[align.toUpperCase()],
children:[
new TextRun({
text:String(text||""),
bold,
size:20
})
]
})
]
});
}


/* ================= LOAD IMAGES ================= */

const logoBuffer = await getImageBuffer("img/hisense-word.png");

const partPhoto = await getPhotoBuffer(rtv.photos?.part);

const materialPhoto = await getPhotoBuffer(rtv.photos?.material);

const issuePhoto = await getPhotoBuffer(rtv.photos?.issue);

const vendorSectionImg = await getImageBuffer("img/vendor-section.png");


/* =================================================
   HEADER WORD REAL
================================================= */

const docHeader = new Header({

children:[

new Paragraph({
alignment:AlignmentType.CENTER,
children:[
new TextRun({
text:"Return to vendor (RTV)",
bold:true,
italics:true,
size:50
})
]
}),

new Paragraph({
children:[
new TextRun({
text:"Electrónica de México S.A. de C.V.",
size:15
})
]
}),

new Paragraph({
children:[
new ImageRun({
data:logoBuffer,
transformation:{ width:140, height:55 }
})
]
})

]

});


/* =================================================
   WORD FOOTER
================================================= */

const docFooter = new Footer({

children:[
new Paragraph({
alignment:AlignmentType.RIGHT,
children:[
new TextRun({
text:"QM-0351-R04",
size:18
})
]
})
]

});


/* ================= BORDERS ================= */

const borders={

top:{style:BorderStyle.SINGLE,size:1},
bottom:{style:BorderStyle.SINGLE,size:1},
left:{style:BorderStyle.SINGLE,size:1},
right:{style:BorderStyle.SINGLE,size:1},
insideHorizontal:{style:BorderStyle.SINGLE,size:1},
insideVertical:{style:BorderStyle.SINGLE,size:1}

};


/* =================================================
   INFO TABLE
================================================= */

const processText = rtv.process || "RTV PROCESS / RETURN TO VENDOR";

const infoTable = new Table({

width:{size:100,type:WidthType.PERCENTAGE},

borders,

rows:[

new TableRow({

children:[

textCell(processText),

textCell("Plant: P2"),

textCell("SAP reference: "+(rtv.line||"")),

textCell("Supplier: "+(rtv.vendor||"")),

textCell("LOCATION 5001",true),

textCell("Issued Date: "+(rtv.date||"")),

textCell("Control No. "+(rtv.id||""),true)

]

})

]

});


/* =================================================
   PARTS TABLE
================================================= */

const partRows=[];

partRows.push(new TableRow({
children:[

textCell("Part number",true),
textCell("Description",true),
textCell("Quantity",true),
textCell("Defect",true),
textCell("PO #",true),
textCell("PO line",true),
textCell("RMA #",true),
textCell("Debit note",true)

]
}));


for(let i=0;i<6;i++){

const p = rtv.parts[i] || {};

partRows.push(new TableRow({
children:[

textCell(p.partNumber),
textCell(p.description),
textCell(p.qty),
textCell(p.defect),
textCell(""),
textCell(""),
textCell(""),
textCell("")

]
}));

}

const partsTable = new Table({

width:{size:100,type:WidthType.PERCENTAGE},

borders,

rows:partRows

});


/* =================================================
   SIGNATURES
================================================= */

const signaturesParagraph = new Paragraph({

spacing:{ before:200, after:200 },

children:[

new TextRun({ text:"Reported By ", bold:true }),

new TextRun({ text:(rtv.inspector || "____________________")+" " }),

new TextRun({
text:"_____________________________     Checked By _____________________________    Approved By _____________________________"
})

]

});


/* =================================================
   PHOTO HELPER
================================================= */

function photoParagraph(buffer){

if(!buffer) return new Paragraph("");

return new Paragraph({

alignment:AlignmentType.CENTER,

children:[

new ImageRun({
data:buffer,
transformation:{width:260,height:180}
})

]

});

}

function fullWidthImage(buffer){

return new Paragraph({

alignment:AlignmentType.CENTER,

children:[

new ImageRun({
data:buffer,
transformation:{width:930,height:120}
})

]

});

}


/* =================================================
   FOOTER TABLE
================================================= */

const footerTable = new Table({

width:{size:100,type:WidthType.PERCENTAGE},

borders,

rows:[

new TableRow({

children:[

textCell("Part code",true),
textCell("Material photo",true),
textCell("Issue",true)

]

}),

new TableRow({

children:[

new TableCell({ children:[ photoParagraph(partPhoto) ] }),
new TableCell({ children:[ photoParagraph(materialPhoto) ] }),
new TableCell({ children:[ photoParagraph(issuePhoto) ] })

]

}),

new TableRow({

children:[

new TableCell({
columnSpan:3,
children:[ fullWidthImage(vendorSectionImg) ]
})

]

})

]

});


/* =================================================
   BUILD DOCUMENT
================================================= */

const doc = new Document({

sections:[{

properties:{ page:{ size:{orientation:"landscape"} } },

headers:{ default:docHeader },

footers:{ default:docFooter },

children:[

infoTable,
new Paragraph(" "),
partsTable,
signaturesParagraph,
footerTable

]

}]

});


const blob = await Packer.toBlob(doc);

const url = URL.createObjectURL(blob);

const a = document.createElement("a");

a.href = url;

a.download = `${rtv.id}.docx`;

a.click();

URL.revokeObjectURL(url);

}


/* =====================================================
   EMAIL GENERATOR
===================================================== */

function openRTVEmail(rtv){

const INTERNAL_RTV_TEAM = [

"ofelia.jimenez@hisense.com",
"william.barreto@hisense.com",
"carmen.estrada@hisense.com",
"ruben.hernandez@hisense.com",
"jose.garcia@hisense.com",
"qiuchunguang@hisense.com",
"samuelgomez@hisense.com"

];

const session = window.AppSession?.get() || JSON.parse(localStorage.getItem("loggedUser"));

const senderName = session?.name || "Quality Team";

const subject = `RTV ${rtv.id} – ${rtv.vendor}`;

let partsText="";

rtv.parts.forEach(p=>{
partsText += `• ${p.partNumber} (${p.qty} pcs)\n`;
});

const body = `
Dear team,

Please find attached the RTV document for supplier return.

RTV: ${rtv.id}
Vendor: ${rtv.vendor}
Date: ${rtv.date}

Parts:
${partsText}

Please review and proceed with the supplier return.

Best regards,
${senderName}
Quality Department
Hisense Mexico
`;

const COREMAIL_RTV_URL = "https://mail.hisense.com/coremail/XT/index.jsp?sid=JAEzlYRRQPlTQFUYgzyUFWNZXBHoJUGR#mail.list|%7B%22fid%22%3A1%7D";
const draftText = `To: ${INTERNAL_RTV_TEAM.join("; ")}
Subject: ${subject}
${body}`;

localStorage.setItem("lastRTVEmailDraft", JSON.stringify({
to: INTERNAL_RTV_TEAM.join("; "),
subject,
body,
createdAt: new Date().toISOString()
}));

if(navigator.clipboard?.writeText){
navigator.clipboard.writeText(draftText).catch(err => console.warn("RTV draft clipboard copy failed:", err));
}

window.open(COREMAIL_RTV_URL,"_blank");

}
