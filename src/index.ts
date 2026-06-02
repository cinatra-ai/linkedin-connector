// Consumers import the settings page from
// `@cinatra-ai/linkedin-connector/settings-page` directly.
export { createLinkedInModule } from "./mcp/module";
export { registerLinkedInPrimitives } from "./mcp/registry";
export { createLinkedInPrimitiveHandlers } from "./mcp/handlers";

// Provider-neutral SocialMediaConnector implementation. Registered with the
// @cinatra-ai/social-media-connector facade at boot via
// `src/lib/register-social-providers.ts`.
export { linkedInSocialMediaConnector } from "./connector";
