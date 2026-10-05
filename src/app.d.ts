// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		interface PageData {
			/** Project selected in the sidebar (set by the root layout load). */
			currentProjectId?: string | null;
		}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
