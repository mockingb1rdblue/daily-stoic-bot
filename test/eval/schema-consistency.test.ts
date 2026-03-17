/**
 * Schema/code consistency evaluation.
 * Verifies that the SQL schema, TypeScript interfaces, and source code are in sync.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const schemaPath = resolve(__dirname, '../../schema.sql');
const schema = readFileSync(schemaPath, 'utf-8');

/** Extract table names from CREATE TABLE statements */
function extractTableNames(sql: string): string[] {
	const regex = /CREATE TABLE IF NOT EXISTS (\w+)/g;
	const tables: string[] = [];
	let match;
	while ((match = regex.exec(sql)) !== null) {
		tables.push(match[1]);
	}
	return tables;
}

/** Extract column names from a CREATE TABLE block */
function extractColumns(sql: string, tableName: string): string[] {
	const tableRegex = new RegExp(
		`CREATE TABLE IF NOT EXISTS ${tableName}\\s*\\(([^;]+?)\\);`,
		's',
	);
	const tableMatch = tableRegex.exec(sql);
	if (!tableMatch) return [];

	const body = tableMatch[1];
	const columns: string[] = [];
	for (const line of body.split('\n')) {
		const trimmed = line.trim();
		// Skip empty lines, FOREIGN KEY, and index-related lines
		if (!trimmed || trimmed.startsWith('FOREIGN') || trimmed.startsWith('CREATE') || trimmed.startsWith(')')) {
			continue;
		}
		const colMatch = /^(\w+)\s+(INTEGER|TEXT|REAL)/.exec(trimmed);
		if (colMatch) {
			columns.push(colMatch[1]);
		}
	}
	return columns;
}

describe('schema tables exist', () => {
	const tables = extractTableNames(schema);

	it('entries table exists', () => {
		expect(tables).toContain('entries');
	});

	it('guild_config table exists', () => {
		expect(tables).toContain('guild_config');
	});

	it('user_contexts table exists', () => {
		expect(tables).toContain('user_contexts');
	});

	it('evening_threads table exists', () => {
		expect(tables).toContain('evening_threads');
	});

	it('responses table exists', () => {
		expect(tables).toContain('responses');
	});

	it('virtue_polls table exists', () => {
		expect(tables).toContain('virtue_polls');
	});

	it('obstacle_reframes table exists', () => {
		expect(tables).toContain('obstacle_reframes');
	});

	it('unsent_letters table exists', () => {
		expect(tables).toContain('unsent_letters');
	});
});

describe('guild_config has schedule columns', () => {
	const columns = extractColumns(schema, 'guild_config');

	it('has morning_hour_utc column', () => {
		expect(columns).toContain('morning_hour_utc');
	});

	it('has evening_hour_utc column', () => {
		expect(columns).toContain('evening_hour_utc');
	});

	it('has poll_hour_utc column', () => {
		expect(columns).toContain('poll_hour_utc');
	});

	it('has timezone_label column', () => {
		expect(columns).toContain('timezone_label');
	});

	it('has guild_id column', () => {
		expect(columns).toContain('guild_id');
	});

	it('has category_id column', () => {
		expect(columns).toContain('category_id');
	});

	it('has channel_reflections column', () => {
		expect(columns).toContain('channel_reflections');
	});

	it('has channel_discussion column', () => {
		expect(columns).toContain('channel_discussion');
	});

	it('has channel_commonplace column', () => {
		expect(columns).toContain('channel_commonplace');
	});

	it('has setup_by column', () => {
		expect(columns).toContain('setup_by');
	});
});

describe('entries table matches StoicEntry interface', () => {
	const columns = extractColumns(schema, 'entries');

	/** Fields from the StoicEntry interface in src/db/entries.ts */
	const interfaceFields = [
		'id',
		'day_of_year',
		'date',
		'month',
		'day',
		'title',
		'quote',
		'quote_source',
		'commentary',
		'part',
		'month_theme',
		'created_at',
	];

	it('every StoicEntry interface field has a matching schema column', () => {
		for (const field of interfaceFields) {
			expect(columns, `Missing column for StoicEntry.${field}`).toContain(field);
		}
	});

	it('schema has no extra columns beyond the interface', () => {
		for (const col of columns) {
			expect(interfaceFields, `Extra schema column: ${col}`).toContain(col);
		}
	});
});

describe('user_contexts table matches UserContext interface', () => {
	const columns = extractColumns(schema, 'user_contexts');

	const interfaceFields = ['user_id', 'context_text', 'preferred_voice', 'created_at', 'updated_at'];

	it('every UserContext interface field has a matching schema column', () => {
		for (const field of interfaceFields) {
			expect(columns, `Missing column for UserContext.${field}`).toContain(field);
		}
	});
});

describe('tables referenced in code exist in schema', () => {
	const tables = extractTableNames(schema);

	/** Tables queried in the codebase (from reading the source files) */
	const referencedTables = [
		'entries',
		'guild_config',
		'user_contexts',
		'evening_threads',
		'responses',
		'virtue_polls',
		'obstacle_reframes',
		'unsent_letters',
	];

	it('all code-referenced tables exist in schema', () => {
		for (const table of referencedTables) {
			expect(tables, `Table ${table} referenced in code but missing from schema`).toContain(table);
		}
	});
});
