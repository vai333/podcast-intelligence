// Builds the point clouds off the main thread, so the page stays responsive while they are generated.
import { buildShapes } from "./shapes";

self.onmessage = (e: MessageEvent<{ count: number }>) => {
  const shapes = buildShapes(e.data.count);
  const buffers = Object.values(shapes).flatMap((c) => [c.pos.buffer, c.nrm.buffer]);
  (self as unknown as Worker).postMessage(shapes, buffers);
};
