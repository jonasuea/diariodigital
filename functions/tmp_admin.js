const admin = require("firebase-admin");

admin.initializeApp({
  projectId: "educafacil1"
});

const db = admin.firestore();
// Override to specific database
db.settings({ databaseId: 'database' });

async function run() {
  const snapshot = await db.collection("estudantes").get();
  let found = false;
  snapshot.forEach(doc => {
    const data = doc.data();
    if (data.nome && data.nome.includes("ADENILSON")) {
      console.log("Found student:", data.nome);
      console.log("CPF do estudante:", data.cpf);
      console.log("CPF do responsável:", data.responsavel_cpf);
      console.log("Doc id:", doc.id);
      found = true;
    }
  });
  if (!found) console.log("No student ADENILSON found");
}

run().catch(console.error);
