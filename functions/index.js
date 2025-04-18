const functions = require("firebase-functions");
const admin = require("firebase-admin");
const fetch = require("node-fetch"); // Caso queira chamar APIs externas no futuro

admin.initializeApp();

exports.smartResponse = functions.https.onRequest(async (req, res) => {
  const { question } = req.body;

  if (!question) {
    return res.status(400).send('Pergunta não enviada.');
  }

  // Exemplo simples de inteligência: responder diferente dependendo da pergunta
  let answer = "";

  if (question.includes("login")) {
    answer = "Parece que você está com problemas de login. Verifique sua autenticação no Firebase Auth!";
  } else if (question.includes("redirecionamento")) {
    answer = "Redirecionamento no Next.js depende se você usa App Router ou Pages Router!";
  } else {
    answer = "Não entendi sua dúvida... poderia reformular?";
  }

  // Em um cenário real, aqui você poderia integrar com APIs de IA externas (tipo chamar o ChatGPT ou Gemini)

  res.json({ answer });
});
