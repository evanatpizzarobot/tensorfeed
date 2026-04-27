/**
 * Benchmark directory: drives /benchmarks/[name] leaderboard pages.
 *
 * Each entry maps a benchmark id (matching the score keys in
 * data/benchmarks.json) to editorial metadata that cannot be derived
 * from the raw scores: full prose description, scoring methodology,
 * why-it-matters, what-the-numbers-mean ranges, links to the
 * upstream paper or repository.
 *
 * The leaderboard itself is computed live from data/benchmarks.json
 * so it stays current as we ingest new model scores.
 */

import { MODEL_DIRECTORY } from './model-directory';

export interface BenchmarkPageMeta {
  /** URL slug used in /benchmarks/[name]. Matches the score key. */
  slug: string;
  /** Display name from data/benchmarks.json */
  displayName: string;
  /** SEO title (< 60 chars) */
  seoTitle: string;
  /** SEO meta description (150-160 chars) */
  seoDescription: string;
  /** Long-form description for the page hero */
  description: string;
  /** What the score range means in practice */
  scoringNotes: string;
  /** Why agents and developers care about this benchmark */
  whyItMatters: string;
  /** Upstream source URL */
  sourceUrl: string;
  /** Approximate score interpretation buckets for the FAQ */
  ranges: { range: string; meaning: string }[];
}

export const BENCHMARK_DIRECTORY: BenchmarkPageMeta[] = [
  {
    slug: 'swe_bench',
    displayName: 'SWE-bench',
    seoTitle: 'SWE-bench Leaderboard: AI Models on Real Code Tasks',
    seoDescription:
      'Live SWE-bench leaderboard for major AI models. Real-world software engineering tasks from GitHub issues. Pricing per model and rankings updated weekly on TensorFeed.',
    description:
      'SWE-bench evaluates language models on their ability to resolve real GitHub issues from popular Python repositories. The model is given an issue description and the repository state, and must produce a patch that resolves the issue and passes the project\'s existing test suite. SWE-bench is the benchmark that most closely tracks "useful for autonomous coding agents" because the tasks are not toy problems, the success criteria is the project\'s actual tests, and the input footprint forces the model to reason over real-world code at scale.',
    scoringNotes:
      'Scores are reported as resolution rate (% of issues correctly patched). The headline number on TensorFeed is the SWE-bench Verified subset, the human-validated tasks where the test suite has been confirmed to be a fair signal. Anything above 60% as of 2026 represents a genuinely useful coding agent; the very top of the leaderboard is approaching 75-80%.',
    whyItMatters:
      'If you are building a coding agent, this is the benchmark that matters most. Models with high SWE-bench scores produce patches that compile, pass tests, and respect existing patterns in the codebase. Models with low SWE-bench scores produce code that looks plausible but breaks the build.',
    sourceUrl: 'https://www.swebench.com',
    ranges: [
      { range: '70%+', meaning: 'Frontier-class. Genuinely useful coding agent territory.' },
      { range: '50-70%', meaning: 'Production-ready for assisted coding workflows.' },
      { range: '30-50%', meaning: 'Useful for narrow tasks but not autonomous agents.' },
      { range: '< 30%', meaning: 'Plausible-looking code that often does not work.' },
    ],
  },
  {
    slug: 'mmlu_pro',
    displayName: 'MMLU-Pro',
    seoTitle: 'MMLU-Pro Leaderboard: AI Model General Knowledge Rankings',
    seoDescription:
      'Live MMLU-Pro leaderboard for major AI models. General knowledge and reasoning across 57 subjects. Updated weekly with pricing per model on TensorFeed.',
    description:
      'MMLU-Pro is the harder successor to the original MMLU benchmark. It tests general knowledge and reasoning across 57 subjects (math, physics, law, medicine, philosophy, etc.) using multiple-choice questions designed to require multi-step reasoning rather than memorization. MMLU-Pro is the standard "is this model smart" benchmark for general-purpose use cases.',
    scoringNotes:
      'Scores are reported as % of questions answered correctly. The chance baseline is roughly 25% (4-choice). The 2026 frontier sits above 90%, with the strongest models in the mid-90s. A 5-point gap on MMLU-Pro is meaningful; a 1-point gap is within noise.',
    whyItMatters:
      'For general chat assistants, research synthesis, and any workload where the model needs broad knowledge plus reasoning, MMLU-Pro is the best single proxy for capability. Models that lead MMLU-Pro almost always lead other reasoning benchmarks too.',
    sourceUrl: 'https://huggingface.co/datasets/TIGER-Lab/MMLU-Pro',
    ranges: [
      { range: '90%+', meaning: 'Frontier reasoning. Comparable to PhD-level human performance.' },
      { range: '80-90%', meaning: 'Strong general assistant. Production-ready for most knowledge tasks.' },
      { range: '60-80%', meaning: 'Useful for everyday queries, weak on harder reasoning.' },
      { range: '< 60%', meaning: 'Below the threshold for reliable knowledge work.' },
    ],
  },
  {
    slug: 'human_eval',
    displayName: 'HumanEval',
    seoTitle: 'HumanEval Leaderboard: AI Models on Python Code Generation',
    seoDescription:
      'Live HumanEval leaderboard for major AI models. Python code generation and problem solving. Updated weekly with pricing on TensorFeed.',
    description:
      'HumanEval is OpenAI\'s original code generation benchmark: 164 hand-written Python programming problems, each with a function signature, docstring, and unit tests. The model must produce a function body that passes all the tests. HumanEval is the simplest, most-cited code benchmark and remains a useful capability floor.',
    scoringNotes:
      'Scores are pass@1: percentage of problems where the model\'s first attempt passes all tests. The 2026 frontier is above 95%, which means the benchmark is approaching saturation. A 1-point gap at the top is within noise; the more meaningful signal is now SWE-bench.',
    whyItMatters:
      'HumanEval is a fast, cheap proxy for "can the model generate correct Python from a docstring." It is no longer a frontier-level differentiator (most strong models score above 90%) but it is still the easiest sanity check for whether a model is even in the conversation for code work.',
    sourceUrl: 'https://github.com/openai/human-eval',
    ranges: [
      { range: '95%+', meaning: 'Saturation. Essentially solves the benchmark.' },
      { range: '85-95%', meaning: 'Strong code generation across common patterns.' },
      { range: '70-85%', meaning: 'Useful for assisted coding, makes more mistakes.' },
      { range: '< 70%', meaning: 'Not recommended for production code work.' },
    ],
  },
  {
    slug: 'gpqa_diamond',
    displayName: 'GPQA Diamond',
    seoTitle: 'GPQA Diamond Leaderboard: AI Models on Graduate Science',
    seoDescription:
      'Live GPQA Diamond leaderboard for major AI models. Graduate-level physics, chemistry, and biology questions. Updated on TensorFeed with pricing per model.',
    description:
      'GPQA Diamond is the hardest subset of the Graduate-level Physics and Quantum questions benchmark. The 198 questions in the Diamond subset have been verified by domain experts to be difficult even for PhDs in the relevant field. Scoring well on GPQA Diamond requires multi-step scientific reasoning, not just memorization.',
    scoringNotes:
      'The chance baseline is 25% (4-choice). Random guessing scores ~25%, expert non-specialists score ~34%, expert specialists score ~65%. The 2026 frontier hits ~80% on the strongest reasoning models. The gap between this and MMLU-Pro is the gap between "knows facts" and "can reason from facts under pressure."',
    whyItMatters:
      'GPQA Diamond is the benchmark that separates models that have memorized scientific content from models that can reason scientifically. For research agents, technical writing, and any workload involving multi-step inference over unfamiliar domains, GPQA Diamond predicts capability better than MMLU-Pro.',
    sourceUrl: 'https://github.com/idavidrein/gpqa',
    ranges: [
      { range: '70%+', meaning: 'Above expert-specialist level. Frontier reasoning.' },
      { range: '50-70%', meaning: 'Strong scientific reasoning, comparable to expert non-specialists.' },
      { range: '30-50%', meaning: 'Better than chance, weak on multi-step inference.' },
      { range: '< 30%', meaning: 'At or near chance baseline for the benchmark.' },
    ],
  },
  {
    slug: 'math',
    displayName: 'MATH',
    seoTitle: 'MATH Benchmark Leaderboard: AI Models on Competition Math',
    seoDescription:
      'Live MATH benchmark leaderboard for major AI models. Competition-level mathematics problems. Updated weekly with pricing per model on TensorFeed.',
    description:
      'The MATH benchmark consists of 12,500 competition-level mathematics problems sourced from AMC, AIME, and Putnam-style competitions. Each problem requires multi-step algebraic, geometric, or combinatorial reasoning, and the answer must match exactly (no partial credit). MATH is one of the toughest standardized math benchmarks for LLMs.',
    scoringNotes:
      'Scores are exact-match accuracy on the test set. As of 2026 the frontier is in the mid-90s, but the variance between problem categories is high: most models do well on AMC-level algebra and worse on AIME-level combinatorics or proof-style problems.',
    whyItMatters:
      'MATH performance correlates strongly with multi-step reasoning capability in general. Models that can carry algebraic state through 5-10 steps on MATH problems tend to be the same models that can carry argumentative state through long agent workflows. If your agent does any quantitative work, MATH is a useful proxy.',
    sourceUrl: 'https://github.com/hendrycks/math',
    ranges: [
      { range: '90%+', meaning: 'Frontier. Solves most competition-level problems.' },
      { range: '70-90%', meaning: 'Strong on AMC-level, struggles on AIME/Putnam.' },
      { range: '40-70%', meaning: 'Useful for routine math but unreliable on multi-step problems.' },
      { range: '< 40%', meaning: 'Weak general math; unreliable for quantitative tasks.' },
    ],
  },
];

export function getAllBenchmarkSlugs(): string[] {
  return BENCHMARK_DIRECTORY.map(b => b.slug);
}

export function getBenchmarkBySlug(slug: string): BenchmarkPageMeta | null {
  return BENCHMARK_DIRECTORY.find(b => b.slug === slug) ?? null;
}

/**
 * Map a benchmark display name from data/benchmarks.json back to the
 * MODEL_DIRECTORY slug so leaderboard rows can link to /models/[slug].
 */
export function getModelSlugByBenchmarkName(benchmarkName: string): string | null {
  const match = MODEL_DIRECTORY.find(m => m.benchmarkName.toLowerCase() === benchmarkName.toLowerCase());
  return match ? match.slug : null;
}
