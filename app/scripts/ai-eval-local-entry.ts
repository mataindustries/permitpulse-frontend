import {
  formatLocalAiReviewEvaluation,
  runLocalAiReviewEvaluation,
} from "../src/shared/ai-review/run-local-eval";

const summary = runLocalAiReviewEvaluation();

console.log(formatLocalAiReviewEvaluation(summary));

if (summary.fail_count > 0) {
  process.exitCode = 1;
}
