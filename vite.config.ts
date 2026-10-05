import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

// Extra hostnames the dev server should accept (comma-separated), e.g. a tunnel or dev domain.
const extraHosts = (process.env.ALLOWED_HOSTS ?? '')
	.split(',')
	.map((h) => h.trim())
	.filter(Boolean);

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	server: {
		allowedHosts: ['.diploi.app', '.diploi.me', ...extraHosts],
		port: process.env.PORT ? Number(process.env.PORT) : undefined
	},
	test: {
		include: ['src/**/*.test.ts'],
		environment: 'node',
		setupFiles: ['src/test/setup.ts']
	}
});
