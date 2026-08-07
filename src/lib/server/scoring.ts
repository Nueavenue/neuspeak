// src/lib/server/scoring.ts
import { openai, JUDGE_MODEL } from './openai';

export interface BattleScore {
	/** 0-100 overall score — this becomes the battle's points. */
	overall: number;
	fluency: number;
	vocabulary: number;
	grammar: number;
	/** One short, encouraging sentence with a concrete tip. */
	feedback: string;
}

const JUDGE_SYSTEM_PROMPT = `You are the judge for NeuSpeak's "voice battle" game, a fun way for English learners to practice speaking.
You are given the transcript of something a learner said aloud, plus how long they spoke.
Score it 0-100 in each category:
- fluency: pacing, natural phrasing, hesitation/filler-word patterns implied by the transcript
- vocabulary: word choice and variety for the apparent proficiency level
- grammar: correctness of tenses, articles, word order, agreement
- overall: your holistic score for this attempt (does not have to be the average of the others)
Very short, empty, or nonsensical transcripts should score low across the board.
Respond with ONLY a compact JSON object, no prose, no markdown fences:
{"fluency": number, "vocabulary": number, "grammar": number, "overall": number, "feedback": string}
"feedback" must be one short, encouraging sentence (max 20 words) with exactly one concrete, specific tip.`;

function clampScore(value: unknown): number {
	const n = Number(value);
	if (!Number.isFinite(n)) return 0;
	return Math.max(0, Math.min(100, Math.round(n)));
}

/**
 * Grades a spoken utterance for the voice battle leaderboard. Uses Chat
 * Completions (not Responses) purely because `response_format: json_object`
 * for structured output is the simplest reliable option for this
 * text-in/text-out judging task — no audio modality involved.
 */
export async function scoreBattle(transcript: string, durationMs: number): Promise<BattleScore> {
	const seconds = Math.max(0, Math.round(durationMs / 100) / 10);

	const completion = await openai.chat.completions.create({
		model: JUDGE_MODEL,
		response_format: { type: 'json_object' },
		messages: [
			{ role: 'system', content: JUDGE_SYSTEM_PROMPT },
			{
				role: 'user',
				content: `Transcript: "${transcript}"\nSpoken duration: ${seconds}s`
			}
		]
	});

	const raw = completion.choices[0]?.message?.content ?? '{}';

	let parsed: Record<string, unknown> = {};
	try {
		parsed = JSON.parse(raw);
	} catch (err) {
		console.error('scoreBattle: failed to parse judge JSON', raw, err);
	}

	const fluency = clampScore(parsed.fluency);
	const vocabulary = clampScore(parsed.vocabulary);
	const grammar = clampScore(parsed.grammar);
	const overallRaw = parsed.overall;

	return {
		fluency,
		vocabulary,
		grammar,
		overall: overallRaw !== undefined ? clampScore(overallRaw) : clampScore((fluency + vocabulary + grammar) / 3),
		feedback:
			typeof parsed.feedback === 'string' && parsed.feedback.trim()
				? parsed.feedback.trim()
				: 'Nice attempt — keep practicing to build momentum!'
	};
}
