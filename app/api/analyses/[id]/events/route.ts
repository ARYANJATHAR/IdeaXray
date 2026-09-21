import { readAnalysis } from "@/src/server/analysis/read";
import { terminalStatuses } from "@/src/lib/contracts";
import { errorResponse } from "@/src/server/http/responses";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = (await params).id;
    const initial = await readAnalysis(id, false);
    const encoder = new TextEncoder();
    let stopped = false; let wake: (() => void) | undefined;
    const stop = () => { stopped = true; wake?.(); };
    request.signal.addEventListener("abort", stop, { once: true });
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const began = Date.now(); let previous = "";
        try {
          let snapshot = initial;
          controller.enqueue(encoder.encode("retry: 3000\n\n"));
          while (!stopped && Date.now() - began < 55000) {
            const signature = JSON.stringify(snapshot);
            if (signature !== previous) {
              controller.enqueue(encoder.encode("event: progress\ndata: " + signature + "\n\n")); previous = signature;
            } else controller.enqueue(encoder.encode(": heartbeat\n\n"));
            if (terminalStatuses.includes(snapshot.status)) break;
            await new Promise<void>((resolve) => { const timer = setTimeout(resolve, 1500); wake = () => { clearTimeout(timer); resolve(); }; });
            wake = undefined;
            if (!stopped) snapshot = await readAnalysis(id, false);
          }
        } catch {
          if (!stopped) controller.enqueue(encoder.encode('event: reconnect\ndata: {"message":"Progress connection interrupted. Reconnecting."}\n\n'));
        } finally {
          request.signal.removeEventListener("abort", stop);
          if (!stopped) controller.close();
        }
      },
      cancel() { stop(); request.signal.removeEventListener("abort", stop); },
    });
    return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform, private", Connection: "keep-alive", "X-Accel-Buffering": "no" } });
  } catch (error) { return errorResponse(error); }
}
