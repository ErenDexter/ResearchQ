import { describe, expect, it } from 'vitest';
import { findSimilarTitles, titleTokens, topCoAuthorPairs } from './research-intelligence';

function bruteForce(items: { id: string; title: string }[], threshold = 0.85) {
	const sets = items.map((p) => new Set(titleTokens(p.title)));
	const pairs: string[] = [];
	for (let i = 0; i < items.length; i++) {
		for (let j = i + 1; j < items.length; j++) {
			const a = sets[i];
			const b = sets[j];
			if (a.size === 0 || b.size === 0) continue;
			const inter = [...a].filter((t) => b.has(t)).length;
			if (inter / (a.size + b.size - inter) >= threshold - 1e-9)
				pairs.push(`${items[i].id}-${items[j].id}`);
		}
	}
	return pairs.sort();
}

describe('findSimilarTitles', () => {
	it('finds near-duplicate titles', () => {
		const items = [
			{ id: 'a', title: 'Auditing hiring algorithms for gender bias in large firms today' },
			{ id: 'b', title: 'Auditing Hiring Algorithms for Gender Bias in Large Firms Today!' },
			{ id: 'c', title: 'A completely different paper about credit scoring' }
		];
		const result = findSimilarTitles(items);
		expect(result).toHaveLength(1);
		expect(result[0]).toMatchObject({ paper1: { id: 'a' }, paper2: { id: 'b' }, similarity: 1 });
	});

	it('handles non-Latin titles', () => {
		expect(titleTokens('Алгоритмический аудит систем найма')).toHaveLength(4);
		const result = findSimilarTitles([
			{ id: 'a', title: 'Алгоритмический аудит систем найма' },
			{ id: 'b', title: 'Алгоритмический аудит систем найма.' }
		]);
		expect(result).toHaveLength(1);
	});

	it('matches a brute-force comparison on random titles', () => {
		const vocab =
			'alpha beta gamma delta epsilon zeta theta kappa lambda sigma omega audit bias model data'.split(
				' '
			);
		let seed = 42;
		const rand = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
		const items = Array.from({ length: 300 }, (_, i) => ({
			id: String(i),
			title: Array.from(
				{ length: 3 + Math.floor(rand() * 8) },
				() => vocab[Math.floor(rand() * vocab.length)]
			).join(' ')
		}));
		for (const threshold of [0.85, 0.6]) {
			const fast = findSimilarTitles(items, threshold)
				.map((d) => `${d.paper1.id}-${d.paper2.id}`)
				.sort();
			expect(fast).toEqual(bruteForce(items, threshold));
		}
	});
});

describe('topCoAuthorPairs', () => {
	it('counts each pair once per paper', () => {
		expect(topCoAuthorPairs([['A', 'B', 'A'], ['B', 'A'], ['C']], 5)).toEqual([
			{ author1: 'A', author2: 'B', sharedPapers: 2 }
		]);
	});
});
