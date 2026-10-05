/**
 * Client-side access to the project selected in the sidebar.
 *
 * The root layout's server load resolves the current project (from the
 * project cookie, falling back to the newest active project) and exposes it
 * as `currentProjectId` in page data, so it is available as soon as a page
 * mounts — no waiting for a client-side fetch.
 */
import { page } from '$app/state';
import { PROJECT_COOKIE } from './project-cookie';

const LEGACY_STORAGE_KEY = 'currentProjectId';

export function getProjectId(): string {
	return page.data.currentProjectId ?? '';
}

/** Persists the selection for subsequent server loads and API calls. */
export function setProjectId(id: string): void {
	document.cookie = `${PROJECT_COOKIE}=${encodeURIComponent(id)}; path=/; max-age=31536000; samesite=lax`;
	try {
		localStorage.removeItem(LEGACY_STORAGE_KEY);
	} catch {
		// storage unavailable — nothing to clean up
	}
}

/**
 * Older versions kept the selection in localStorage only. Returns that id
 * (once) if no cookie has been set yet, so the layout can migrate it.
 */
export function takeLegacyProjectId(): string | null {
	if (document.cookie.split('; ').some((c) => c.startsWith(`${PROJECT_COOKIE}=`))) return null;
	try {
		const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
		localStorage.removeItem(LEGACY_STORAGE_KEY);
		return legacy;
	} catch {
		return null;
	}
}
