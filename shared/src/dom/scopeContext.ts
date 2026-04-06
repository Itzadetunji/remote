import type { DomScope } from "./types";

/** Stable key for one chat session in one Cursor window (CDP target). */
export function makeScopeKey(scope: DomScope): string {
	return `${scope.targetId}::${scope.composerId || "unknown"}`;
}
