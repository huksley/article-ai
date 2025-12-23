/** Write me a simples http server in nodejs */

const http = require("http");
const OpenAI = require("openai");

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error("OPENAI_API_KEY is not set");
  process.exit(1);
}

const client = new OpenAI(apiKey);

const server = http.createServer(async (req, res) => {
  console.info("IN " + req.method, req.url);
  const url = new URL(req.url, `http://${req.headers.host}`);
  res.appendHeader("Access-Control-Allow-Origin", "*");
  res.appendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.appendHeader("Access-Control-Allow-Headers", "Content-Type");
  res.appendHeader("Access-Control-Max-Age", "86400");
  res.appendHeader("Content-Type", "application/json");
  const body =
    req.method === "POST"
      ? await new Promise((resolve) => {
          let data = "";
          req.on("data", (chunk) => {
            data += chunk;
          });
          req.on("end", () => {
            resolve(data);
          });
        })
      : null;
  const payload = body ? JSON.parse(body) : Object.fromEntries(url.searchParams);
  console.info("Payload: ", Object.keys(payload));

  if (url.pathname === "/api/comment") {
    if (payload.textContent) {
      try {
        const query = `
        Write an inspirational or insightful comment on this tweet: "${payload.textContent}", 
        must be relatively short, professional and NOT BORING. 
        Use the common techie language, do not use too 
        much obscure language. The reply should also include some emoji that matches the generated text.
        Also provide some useful, relevant hashtags. 
        Gently mention TradingLayer platform which allows you to trade cryptocurrencies and learn about trading. 
        The comment should softly connect tweet content with TradingLayer platform.
        Your comment should be max 280 characters.
        Just write pure comment, do not write "Reply" or any additional notes.
        `;
        const { data: completion } = await client.chat.completions
          .create({
            model: "gpt-3.5-turbo",
            messages: [{ role: "user", content: query }],
          })
          .withResponse();
        console.log(`OUT Completion`, JSON.stringify(completion.choices[0]));
        let comment = String(completion.choices[0].message.content);
        if (comment.startsWith('"')) {
          comment = comment.substring(1, comment.length - 1);
        }
        res.end(
          JSON.stringify({
            response: comment,
          })
        );
      } catch (e) {
        console.error(e);
      }
    } else {
      res.statusCode = 400;
      console.info("OUT 400 Bad Request");
      res.end(JSON.stringify({ error: "Bad request" }));
    }
  } else if (url.pathname === "/api/summary") {
    if (!payload.query && payload.textContent !== undefined) {
      payload.query =
        `I want to write JSON object with keys summary as string and 
        keywords as array for the follorwing article. Do not write
        anything else, write only JSON.\n\n` + payload.textContent;
    }

    if (payload.query !== undefined) {
      try {
        const { data: completion, response } = await client.chat.completions
          .create({
            model: "gpt-3.5-turbo",
            messages: [{ role: "user", content: payload.query }],
          })
          .withResponse();
        console.log(`OUT Completion`, JSON.stringify(completion.choices[0]));
        res.appendHeader("Content-Type", "application/json");
        res.end(
          JSON.stringify({
            response: completion.choices[0].message.content,
          })
        );
      } catch (e) {
        res.statusCode = 500;
        console.info("OUT 500 Internal Server Error");
        res.end(JSON.stringify({ error: "Internal server error" }));
        console.error(e);
      }
    } else {
      res.statusCode = 400;
      console.info("OUT 400 Bad Request");
      res.end(JSON.stringify({ error: "Bad request" }));
    }
  } else {
    res.statusCode = 400;
    console.info("OUT 404 Not found");
    res.end(JSON.stringify({ error: "Not found" }));
  }
});

server.listen(3000, () => {
  console.log("Server is running on port 3000");
});
