import fs from "node:fs";

function replaceInFile(file, replacements) {
  let content = fs.readFileSync(file, "utf8");
  let changed = false;

  for (const [from, to] of replacements) {
    if (content.includes(from)) {
      content = content.replaceAll(from, to);
      changed = true;
      console.log(`OK ${file}: reemplazado -> ${from.slice(0, 80).replace(/\n/g, " ")}`);
    } else {
      console.log(`AVISO ${file}: no encontré -> ${from.slice(0, 80).replace(/\n/g, " ")}`);
    }
  }

  if (changed) {
    fs.writeFileSync(file, content, "utf8");
  }
}

replaceInFile("supabase/functions/whatsapp-webhook/index.ts", [
  [
    `inbox: existingRes.data.assigned_to ? "vendedor" : "sin_atender",`,
    `inbox: existingRes.data.assigned_to ? "vendedor" : "general",`
  ],
  [
    `inbox: "sin_atender",`,
    `inbox: "general",`
  ],
  [
    `  fireAndForgetLiveNosAutoReply({
    conversationId,
    inboundMessageId,
    oportunidadId,
    source: "whatsapp-webhook"
  });

  fireAndForgetCandeReply({
    conversationId,
    inboundMessageId,
    oportunidadId,
    source: "whatsapp-webhook"
  });`,
    `  fireAndForgetCandeReply({
    conversationId,
    inboundMessageId,
    oportunidadId,
    source: "whatsapp-webhook"
  });`
  ],
  [
    `fireAndForgetLiveNosAutoReply({
    conversationId,
    inboundMessageId,
    oportunidadId,
    source: "whatsapp-webhook"
  });

  fireAndForgetCandeReply({
    conversationId,
    inboundMessageId,
    oportunidadId,
    source: "whatsapp-webhook"
  });`,
    `fireAndForgetCandeReply({
    conversationId,
    inboundMessageId,
    oportunidadId,
    source: "whatsapp-webhook"
  });`
  ]
]);

replaceInFile("src/modules/comunicaciones/LiveNosPanel.tsx", [
  [
    `inbox: "colaboracion",
        estado_gestion: "colaboracion",
        updated_at: new Date().toISOString()`,
    `inbox: selectedConversation.assigned_to ? "vendedor" : "general",
        estado_gestion: "colaboracion",
        updated_at: new Date().toISOString()`
  ],
  [
    `inbox: selectedConversation.assigned_to ? "vendedor" : "sin_atender",
          estado_gestion: selectedConversation.assigned_to ? "en_gestion" : "sin_atender",
          updated_at: new Date().toISOString()`,
    `inbox: selectedConversation.assigned_to ? "vendedor" : "general",
          estado_gestion: selectedConversation.assigned_to ? "en_gestion" : "sin_atender",
          updated_at: new Date().toISOString()`
  ],
  [
    `const [activeInbox, setActiveInbox] = useState<InboxKey>("en_gestion");`,
    `const [activeInbox, setActiveInbox] = useState<InboxKey>("sin_atender");`
  ]
]);

console.log("");
console.log("Listo. Revisá con:");
console.log("grep -n 'sin_atender\\|colaboracion\\|fireAndForgetLiveNosAutoReply' supabase/functions/whatsapp-webhook/index.ts src/modules/comunicaciones/LiveNosPanel.tsx");
