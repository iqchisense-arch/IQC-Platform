/* =====================================================
   RTV EMAIL DRAFT HELPER
===================================================== */

(function(){
const COREMAIL_RTV_URL = "https://mail.hisense.com/coremail/XT/index.jsp?sid=JAEzlYRRQPlTQFUYgzyUFWNZXBHoJUGR#mail.list|%7B%22fid%22%3A1%7D";

const INTERNAL_RTV_TEAM = [
"ofelia.jimenez@hisense.com",
"william.barreto@hisense.com",
"carmen.estrada@hisense.com",
"ruben.hernandez@hisense.com",
"jose.garcia@hisense.com",
"qiuchunguang@hisense.com",
"samuelgomez@hisense.com"
];

function getSenderName(){
const session = window.AppSession?.get() || JSON.parse(localStorage.getItem("loggedUser") || "null");
return session?.name || "Quality Team";
}

function buildRTVEmailDraft(rtv){
const senderName = getSenderName();
const subject = `RTV ${rtv.id} - ${rtv.vendor}`;

let partsText = "";
(rtv.parts || []).forEach(p => {
partsText += `- ${p.partNumber} (${p.qty} pcs)\n`;
});

const body = `Dear team,

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
Hisense Mexico`;

return {
to: INTERNAL_RTV_TEAM.join("; "),
subject,
body,
clipboardText: `To: ${INTERNAL_RTV_TEAM.join("; ")}
Subject: ${subject}

${body}`
};
}

async function copyRTVDraftToClipboard(draft){
localStorage.setItem("lastRTVEmailDraft", JSON.stringify({
to: draft.to,
subject: draft.subject,
body: draft.body,
createdAt: new Date().toISOString()
}));

try{
if(navigator.clipboard?.writeText){
await navigator.clipboard.writeText(draft.clipboardText);
return true;
}

const textArea = document.createElement("textarea");
textArea.value = draft.clipboardText;
textArea.setAttribute("readonly", "");
textArea.style.position = "fixed";
textArea.style.left = "-9999px";
document.body.appendChild(textArea);
textArea.select();
const copied = document.execCommand("copy");
document.body.removeChild(textArea);
return copied;
}catch(err){
console.warn("RTV draft clipboard copy failed:", err);
return false;
}
}

window.buildRTVEmailDraft = buildRTVEmailDraft;

window.openRTVEmail = async function(rtv, options = {}){
const draft = buildRTVEmailDraft(rtv);
const mailWindow = window.open(COREMAIL_RTV_URL, "_blank");
const copied = await copyRTVDraftToClipboard(draft);

if(options.notify){
const copyStatus = copied ? "El borrador del correo se copio al portapapeles." : "El borrador del correo se guardo en este navegador.";
const fileStatus = options.attachmentGenerated ? "El archivo Word del RTV tambien se descargo." : "Adjunta manualmente el archivo Word del RTV.";
alert(`${copyStatus}\n${fileStatus}\n\nCoremail se abrio. Pega el borrador en un correo nuevo y adjunta el documento RTV.`);
}

return Boolean(mailWindow);
};
})();
