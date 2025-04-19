import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { server } from "./server.js";
import { log } from "./utils/logger.js";

(async () => {
    await server.connect(new StdioServerTransport());
    log.info("MCP‑transcriber ready");
})();
