import { verifyOpenApiManifest } from "./openapi-integrity.js";

const counts = await verifyOpenApiManifest(process.cwd());
console.error(`Verified Woodpecker OpenAPI manifest: ${counts.pathCount} paths, ${counts.operationCount} operations`);
