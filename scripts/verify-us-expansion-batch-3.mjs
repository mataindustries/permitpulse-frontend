import { runBatchVerification, US_EXPANSION_BATCHES } from './verify-us-expansion-shared.mjs';

async function main() {
  const result = await runBatchVerification('batch3', US_EXPANSION_BATCHES.batch3);
  if (!result.ok) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
