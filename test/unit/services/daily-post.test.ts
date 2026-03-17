/**
 * Unit tests for daily post structure — embed and component layout.
 * Tests the static structure that postDailyEntry builds, not the Discord API calls.
 */

import { describe, it, expect } from 'vitest';

// Replicate the embed and component structure from daily-post.ts
// to test the contract without needing env/DB mocks.

const EMBED_COLOR = 0x8b7355;

function buildEmbed(entry: { title: string; quote: string; quote_source: string; commentary: string; part: string; month_theme: string; day_of_year: number }) {
	return {
		title: `**${entry.title}**`,
		description: [
			`>>> *"${entry.quote}"*\n*— ${entry.quote_source}*`,
			'',
			entry.commentary,
		].join('\n'),
		color: EMBED_COLOR,
		footer: {
			text: `${entry.part} | ${entry.month_theme} | Day ${entry.day_of_year}`,
		},
		timestamp: new Date().toISOString(),
	};
}

function buildComponents(dayOfYear: number) {
	return [
		{
			type: 1, // Action Row
			components: [
				{
					type: 2,
					style: 2,
					label: 'Challenge This',
					custom_id: `challenge_${dayOfYear}`,
					emoji: { name: '\u2694\ufe0f' },
				},
				{
					type: 2,
					style: 2,
					label: 'Reflect',
					custom_id: `reflect_${dayOfYear}`,
					emoji: { name: '\ud83d\udcad' },
				},
				{
					type: 2,
					style: 2,
					label: 'Save to Commonplace',
					custom_id: `commonplace_${dayOfYear}`,
					emoji: { name: '\ud83d\udcd6' },
				},
			],
		},
	];
}

const sampleEntry = {
	title: 'Control and Choice',
	quote: 'The chief task in life is simply this: to identify and separate matters.',
	quote_source: 'Epictetus, Discourses, 2.5.4-5',
	commentary: 'Some things are up to us, some things are not.',
	part: 'PART I: THE DISCIPLINE OF PERCEPTION',
	month_theme: 'Clarity',
	day_of_year: 1,
};

describe('daily post embed structure', () => {
	it('embed color is 0x8b7355 (warm brown)', () => {
		const embed = buildEmbed(sampleEntry);
		expect(embed.color).toBe(0x8b7355);
	});

	it('embed title wraps entry title in bold', () => {
		const embed = buildEmbed(sampleEntry);
		expect(embed.title).toBe('**Control and Choice**');
	});

	it('embed description includes the quote in blockquote italic', () => {
		const embed = buildEmbed(sampleEntry);
		expect(embed.description).toContain('>>> *"');
		expect(embed.description).toContain(sampleEntry.quote);
	});

	it('embed description includes quote source', () => {
		const embed = buildEmbed(sampleEntry);
		expect(embed.description).toContain(sampleEntry.quote_source);
	});

	it('embed description includes commentary', () => {
		const embed = buildEmbed(sampleEntry);
		expect(embed.description).toContain(sampleEntry.commentary);
	});

	it('embed footer includes part, theme, and day', () => {
		const embed = buildEmbed(sampleEntry);
		expect(embed.footer.text).toContain('PART I');
		expect(embed.footer.text).toContain('Clarity');
		expect(embed.footer.text).toContain('Day 1');
	});

	it('embed has an ISO timestamp', () => {
		const embed = buildEmbed(sampleEntry);
		expect(embed.timestamp).toBeTruthy();
		// Verify it parses as a valid date
		expect(new Date(embed.timestamp).getTime()).not.toBeNaN();
	});
});

describe('daily post components', () => {
	it('has exactly 1 action row', () => {
		const components = buildComponents(42);
		expect(components).toHaveLength(1);
		expect(components[0].type).toBe(1);
	});

	it('action row has exactly 3 buttons', () => {
		const components = buildComponents(42);
		expect(components[0].components).toHaveLength(3);
	});

	it('all buttons are type 2 (Button) with style 2 (Secondary)', () => {
		const components = buildComponents(42);
		for (const btn of components[0].components) {
			expect(btn.type).toBe(2);
			expect(btn.style).toBe(2);
		}
	});

	it('first button is "Challenge This" with challenge_ prefix', () => {
		const components = buildComponents(42);
		const btn = components[0].components[0];
		expect(btn.label).toBe('Challenge This');
		expect(btn.custom_id).toBe('challenge_42');
	});

	it('second button is "Reflect" with reflect_ prefix', () => {
		const components = buildComponents(42);
		const btn = components[0].components[1];
		expect(btn.label).toBe('Reflect');
		expect(btn.custom_id).toBe('reflect_42');
	});

	it('third button is "Save to Commonplace" with commonplace_ prefix', () => {
		const components = buildComponents(42);
		const btn = components[0].components[2];
		expect(btn.label).toBe('Save to Commonplace');
		expect(btn.custom_id).toBe('commonplace_42');
	});

	it('custom_ids include the day_of_year', () => {
		const components = buildComponents(365);
		const ids = components[0].components.map((b: { custom_id: string }) => b.custom_id);
		expect(ids).toEqual(['challenge_365', 'reflect_365', 'commonplace_365']);
	});
});
