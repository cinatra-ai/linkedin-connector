// The linkedin connector's `register(ctx)` server entry.
//
// Transport-registration cutover: the host no longer imports `linkedInSocialMediaConnector` — this entry
// registers the LinkedIn `SocialMediaConnector` impl behind the `social-post`
// capability at activation. The social-media facade resolves that capability
// lazily from its own serverEntry configuration, so publish routing reaches
// LinkedIn without any host (or facade) import of this package.
//
// SDK imports here are TYPE-ONLY (host-peer value-import gate): the provider
// impl travels as DATA through `ctx.capabilities`.

import "server-only";
import type { ExtensionHostContext } from "@cinatra-ai/sdk-extensions";
import { linkedInSocialMediaConnector } from "./connector";

const PACKAGE_NAME = "@cinatra-ai/linkedin-connector";

export function register(ctx: ExtensionHostContext): void {
  ctx.capabilities.registerProvider("social-post", {
    packageName: PACKAGE_NAME,
    impl: linkedInSocialMediaConnector,
  });
}
