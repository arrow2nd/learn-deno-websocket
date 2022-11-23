import { serve } from "server";

type Chat = {
  emoji: string;
  text: string;
};

const PORT = 3000;
const html = Deno.readTextFileSync("./index.html");
const sockets: Map<string, WebSocket> = new Map();

// deno-lint-ignore require-await
async function server(req: Request): Promise<Response> {
  const notFoundResponse = new Response("Not Found", { status: 404 });
  const { pathname } = new URL(req.url);

  if (req.method !== "GET") {
    return notFoundResponse;
  }

  if (pathname === "/") {
    return new Response(html, {
      status: 200,
      headers: { "content-type": "text/html" },
    });
  }

  if (pathname === "/chat") {
    const emoji = getEmoji();
    if (!emoji) {
      return new Response("Too many users", { status: 500 });
    }

    const { socket, response } = Deno.upgradeWebSocket(req);

    socket.onmessage = ({ data }: MessageEvent<string>) => {
      broadcast({ emoji, text: data });
    };

    socket.onclose = () => {
      sockets.delete(emoji);
      console.log(`disconnected: ${emoji}`);
      broadcast({ emoji, text: "[ disconnected ]" });
    };

    sockets.set(emoji, socket);
    console.log(`connected: ${emoji}`);

    return response;
  }

  return notFoundResponse;
}

function getEmoji(): string | undefined {
  const MIN = 128512;
  const MAX = 128592;

  for (let codePoint = MIN; codePoint <= MAX; codePoint++) {
    const emoji = String.fromCodePoint(codePoint);
    if (!sockets.has(emoji)) {
      return emoji;
    }
  }

  return;
}

async function broadcast(data: Chat): Promise<void> {
  if (data.text === "") {
    return;
  }

  await Promise.all(
    [...sockets.values()].map((s) => s.send(JSON.stringify(data))),
  );
}

serve(server, { port: PORT });
