import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { reviewMethodologies, methodologyPhases } from '$lib/server/db/schema';
import { eq, desc, sql } from 'drizzle-orm';

export const GET: RequestHandler = async ({ url }) => {
	const type = url.searchParams.get('type') || '';
	const domain = url.searchParams.get('domain') || '';

	const methods = await db
		.select({
			id: reviewMethodologies.id,
			name: reviewMethodologies.name,
			description: reviewMethodologies.description,
			type: reviewMethodologies.type,
			domain: reviewMethodologies.domain,
			isBuiltIn: reviewMethodologies.isBuiltIn,
			createdAt: reviewMethodologies.createdAt,
			phaseCount: sql<number>`(SELECT COUNT(*) FROM methodology_phases WHERE methodology_id = ${reviewMethodologies.id})`
		})
		.from(reviewMethodologies)
		.orderBy(reviewMethodologies.name);

	let filtered = methods;
	if (type) filtered = filtered.filter((m) => m.type === type);
	if (domain) filtered = filtered.filter((m) => m.domain === domain);

	return json({ methods: filtered });
};

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const { name, description, type, domain, phases } = body;

	if (!name || !description || !type) {
		return json({ error: 'name, description, and type are required' }, { status: 400 });
	}

	const [method] = await db
		.insert(reviewMethodologies)
		.values({
			name: name.trim(),
			description: description.trim(),
			type,
			domain: domain || 'general',
			isBuiltIn: false
		})
		.returning();

	// Insert phases if provided
	if (Array.isArray(phases)) {
		for (let i = 0; i < phases.length; i++) {
			const phase = phases[i];
			await db.insert(methodologyPhases).values({
				methodologyId: method.id,
				name: phase.name,
				description: phase.description || '',
				position: i,
				expectedOutputs: JSON.stringify(phase.expectedOutputs || [])
			});
		}
	}

	return json({ method }, { status: 201 });
};
