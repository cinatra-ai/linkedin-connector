import { registerLinkedInPrimitives } from "./registry";

export function createLinkedInModule() {
  return {
    registerCapabilities: registerLinkedInPrimitives,
  };
}
