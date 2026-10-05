/**
 * Screening-decision vocabulary shared by the UI, exports and review outputs.
 *
 * `isRelevant` is tri-state: true (included), false (excluded) or null
 * (not screened yet). `relevanceSource` records who made the decision.
 */

export type ScreeningDecision = 'included' | 'excluded' | 'not_screened';

export function screeningDecision(isRelevant: boolean | null | undefined): ScreeningDecision {
	if (isRelevant === true) return 'included';
	if (isRelevant === false) return 'excluded';
	return 'not_screened';
}

export const SCREENING_DECISION_LABELS: Record<ScreeningDecision, string> = {
	included: 'Included',
	excluded: 'Excluded',
	not_screened: 'Not screened'
};

const SOURCE_LABELS: Record<string, string> = {
	ai: 'AI screening',
	ai_fallback: 'Kept by default (AI output unusable)',
	auto_include: 'Kept without AI screening',
	manual: 'Manual decision'
};

/** Human-readable label for who made a screening decision. */
export function screeningSourceLabel(source: string | null | undefined): string {
	// Decisions made before provenance was recorded have no source.
	return (source && SOURCE_LABELS[source]) || 'Not recorded';
}

/** One-line rationale for a study-selection table. */
export function screeningReason(
	isRelevant: boolean | null | undefined,
	source: string | null | undefined
): string {
	const decision = screeningDecision(isRelevant);
	if (decision === 'not_screened') return 'Awaiting screening';
	switch (source) {
		case 'ai':
			return decision === 'included'
				? 'AI screening: meets relevance criteria'
				: 'AI screening: does not meet relevance criteria';
		case 'ai_fallback':
			return 'Included by default: AI screening output was unusable — verify manually';
		case 'auto_include':
			return 'Included without AI screening (filter skipped for this search)';
		case 'manual':
			return decision === 'included' ? 'Manually included' : 'Manually excluded';
		default:
			return decision === 'included'
				? 'Meets relevance criteria'
				: 'Does not meet relevance criteria';
	}
}
