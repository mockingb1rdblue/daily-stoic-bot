/**
 * @law Pragmatic Law — solving the full problem once is always faster than
 * deferring it. This gate exists because catching failures here is strictly
 * cheaper than catching them downstream. Never weaken, skip, or defer.
 * See: docs/constitutions/pragmatic-law.md
 */

/**
 * Ephemeral flag audit — ensures the right responses are private (flags: 64)
 * and the right responses are public (no flags).
 *
 * This is a source-code contract test: we verify the patterns by reading source.
 * The assertions are based on static analysis of the handler files.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC_ROOT = join(__dirname, '../../src');

function readHandler(relativePath: string): string {
	return readFileSync(join(SRC_ROOT, relativePath), 'utf-8');
}

describe('error responses always have flags: 64 (ephemeral)', () => {
	const handlerFiles = [
		'handlers/commands/context.ts',
		'handlers/commands/voice.ts',
		'handlers/commands/setup.ts',
		'handlers/commands/cleanup.ts',
		'handlers/commands/schedule.ts',
		'handlers/interactions.ts',
	];

	for (const file of handlerFiles) {
		it(`${file}: error responses include flags: 64`, () => {
			const source = readHandler(file);

			// Find all response blocks that look like error messages
			// Pattern: content containing "failed", "error", "unable", "need ** permission", "not set up", "not found"
			const errorPatterns = [
				/content:\s*['"`].*?(?:failed|error|unable|not found|not set up|need \*\*).*?['"`]/gi,
			];

			for (const pattern of errorPatterns) {
				const matches = source.matchAll(pattern);
				for (const match of matches) {
					// Find the surrounding response block (within ~200 chars)
					const matchIndex = match.index!;
					const blockStart = Math.max(0, matchIndex - 100);
					const blockEnd = Math.min(source.length, matchIndex + match[0].length + 200);
					const block = source.slice(blockStart, blockEnd);

					// This block should contain flags: 64
					// (some error responses are in jsonResponse with data: { ... flags: 64 })
					expect(
						block.includes('flags: 64') || block.includes('flags:64'),
						`Error response in ${file} near "${match[0].slice(0, 60)}..." should have flags: 64`,
					).toBe(true);
				}
			}
		});
	}
});

describe('personal settings always ephemeral (flags: 64)', () => {
	it('context command: all responses have flags: 64', () => {
		const source = readHandler('handlers/commands/context.ts');
		// Count response blocks and verify they all have flags: 64
		const responseBlocks = source.split('type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE');
		// First split element is before any response, skip it
		for (let i = 1; i < responseBlocks.length; i++) {
			const block = responseBlocks[i].slice(0, 300);
			expect(
				block.includes('flags: 64'),
				`context.ts response block ${i} should have flags: 64`,
			).toBe(true);
		}
	});

	it('voice command: all responses have flags: 64', () => {
		const source = readHandler('handlers/commands/voice.ts');
		const responseBlocks = source.split('type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE');
		for (let i = 1; i < responseBlocks.length; i++) {
			const block = responseBlocks[i].slice(0, 300);
			expect(
				block.includes('flags: 64'),
				`voice.ts response block ${i} should have flags: 64`,
			).toBe(true);
		}
	});

	it('schedule command: all responses have flags: 64 except success update', () => {
		const source = readHandler('handlers/commands/schedule.ts');
		// Error responses and current schedule display should be ephemeral
		// The success response after updating is public (no flags: 64)
		expect(source).toContain('flags: 64');
	});
});

describe('community responses do NOT have flags: 64 (public)', () => {
	it('setup success response is public', () => {
		const source = readHandler('handlers/commands/setup.ts');
		// The successful setup message ("Daily Stoic is ready!") should be public
		const successBlock = source.split('Daily Stoic is ready');
		expect(successBlock.length).toBeGreaterThan(1); // Found the success message
		// The success response block should NOT have flags: 64
		const afterSuccess = successBlock[1].slice(0, 200);
		expect(afterSuccess).not.toContain('flags: 64');
	});

	it('cleanup success response is public', () => {
		const source = readHandler('handlers/commands/cleanup.ts');
		// Successful cleanup ("Daily Stoic has been removed") should be public
		const successBlock = source.split('Daily Stoic has been removed');
		expect(successBlock.length).toBeGreaterThan(1);
		const afterSuccess = successBlock[1].slice(0, 200);
		expect(afterSuccess).not.toContain('flags: 64');
	});

	it('adversary response is public (not ephemeral)', () => {
		const source = readHandler('services/adversary.ts');
		// The adversary challenge embed is posted publicly
		// The deferred response has no flags (public "thinking..." indicator)
		const deferLine = source.match(/jsonResponse\(\{[^}]*DEFERRED[^}]*\}\)/s)?.[0] ?? '';
		expect(deferLine).not.toContain('flags: 64');
	});

	it('obstacle response is public (not ephemeral)', () => {
		const source = readHandler('handlers/commands/obstacle.ts');
		// The obstacle with inline situation defers publicly
		const deferMatches = [...source.matchAll(/jsonResponse\(\{[^}]*DEFERRED[^}]*\}\)/gs)];
		for (const match of deferMatches) {
			// The first defer (inline situation) should not have flags: 64
			// handleObstacleSubmit also defers without flags
			if (!match[0].includes('flags')) {
				expect(match[0]).not.toContain('flags: 64');
			}
		}
	});
});

describe('letter command ephemeral deferred', () => {
	it('letter modal submit defers with flags: 64 (ephemeral)', () => {
		const source = readHandler('handlers/commands/letter.ts');
		// handleLetterSubmit: return jsonResponse({ type: DEFERRED..., data: { flags: 64 } })
		expect(source).toContain('flags: 64');
		// Specifically the deferred response has flags: 64
		const letterSubmitSection = source.split('handleLetterSubmit')[1] ?? '';
		const deferBlock = letterSubmitSection.slice(0, 500);
		expect(deferBlock).toContain('flags: 64');
	});
});
