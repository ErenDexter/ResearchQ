import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { reviewMethodologies, methodologyPhases } from '$lib/server/db/schema';
import { sql } from 'drizzle-orm';
import { numeric } from '$lib/server/db/helpers';

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
			// Literal outer table name: drizzle renders ${reviewMethodologies.id} unqualified, which would bind to methodology_phases.id
			phaseCount: numeric(sql`(SELECT COUNT(*) FROM methodology_phases WHERE methodology_phases.methodology_id = review_methodologies.id)`)
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
	const { domain, phases } = body;
	const name = typeof body.name === 'string' ? body.name.trim() : '';
	const description = typeof body.description === 'string' ? body.description.trim() : '';
	const type = typeof body.type === 'string' ? body.type.trim() : '';

	if (!name || !description || !type) {
		return json({ error: 'name, description, and type are required' }, { status: 400 });
	}
	if (phases !== undefined && (!Array.isArray(phases) || phases.some((p) => typeof p?.name !== 'string' || !p.name.trim()))) {
		return json({ error: 'phases must be a list of objects with a name' }, { status: 400 });
	}

	const [method] = await db
		.insert(reviewMethodologies)
		.values({
			name,
			description,
			type,
			domain: typeof domain === 'string' && domain ? domain : 'general',
			isBuiltIn: false
		})
		.returning();

	// Insert phases if provided
	if (Array.isArray(phases)) {
		for (let i = 0; i < phases.length; i++) {
			const phase = phases[i];
			await db.insert(methodologyPhases).values({
				methodologyId: method.id,
				name: phase.name.trim(),
				description: phase.description || '',
				position: i,
				expectedOutputs: JSON.stringify(Array.isArray(phase.expectedOutputs) ? phase.expectedOutputs : [])
			});
		}
	}

	return json({ method }, { status: 201 });
};
