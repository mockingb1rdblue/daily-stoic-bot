/**
 * @law Pragmatic Law — solving the full problem once is always faster than
 * deferring it. This gate exists because catching failures here is strictly
 * cheaper than catching them downstream. Never weaken, skip, or defer.
 * See: docs/constitutions/pragmatic-law.md
 */

/**
 * Unit tests for the philosopher voice system.
 */

import { describe, it, expect } from 'vitest';
import { VOICES, getVoice } from '../../../src/services/voices.js';

describe('VOICES registry', () => {
	it('has exactly 3 voices', () => {
		expect(Object.keys(VOICES)).toHaveLength(3);
	});

	it('contains epictetus', () => {
		expect(VOICES).toHaveProperty('epictetus');
	});

	it('contains seneca', () => {
		expect(VOICES).toHaveProperty('seneca');
	});

	it('contains marcus_aurelius', () => {
		expect(VOICES).toHaveProperty('marcus_aurelius');
	});

	it('each voice has a systemPrompt', () => {
		for (const [key, voice] of Object.entries(VOICES)) {
			expect(voice.systemPrompt, `${key} missing systemPrompt`).toBeTruthy();
			expect(typeof voice.systemPrompt).toBe('string');
			expect(voice.systemPrompt.length).toBeGreaterThan(50);
		}
	});

	it('each voice has a displayName', () => {
		for (const [key, voice] of Object.entries(VOICES)) {
			expect(voice.displayName, `${key} missing displayName`).toBeTruthy();
			expect(typeof voice.displayName).toBe('string');
		}
	});

	it('each voice has a name matching its key', () => {
		for (const [key, voice] of Object.entries(VOICES)) {
			expect(voice.name).toBe(key);
		}
	});
});

describe('getVoice', () => {
	it('returns the requested voice when it exists', () => {
		const voice = getVoice('epictetus');
		expect(voice.name).toBe('epictetus');
		expect(voice.displayName).toBe('Epictetus');
	});

	it('returns marcus_aurelius as default for null', () => {
		const voice = getVoice(null);
		expect(voice.name).toBe('marcus_aurelius');
	});

	it('returns marcus_aurelius as default for undefined', () => {
		const voice = getVoice(undefined);
		expect(voice.name).toBe('marcus_aurelius');
	});

	it('returns marcus_aurelius as default for unknown voice', () => {
		const voice = getVoice('plato');
		expect(voice.name).toBe('marcus_aurelius');
	});

	it('returns marcus_aurelius as default for empty string', () => {
		const voice = getVoice('');
		expect(voice.name).toBe('marcus_aurelius');
	});
});

describe('VOICES as choices', () => {
	it('all voice keys can be used as choice values', () => {
		const voiceKeys = Object.keys(VOICES);
		expect(voiceKeys).toHaveLength(3);
		for (const key of voiceKeys) {
			expect(VOICES[key as keyof typeof VOICES]).toHaveProperty('displayName');
			expect(VOICES[key as keyof typeof VOICES]).toHaveProperty('systemPrompt');
		}
	});
});
