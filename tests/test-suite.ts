/**
 * CLI Test Suite Runner for AudioLab
 * Run via `npm test` or `tsx tests/test-suite.ts`
 */

import { runTestSuite, ALL_TEST_DEFINITIONS } from '../src/tests/testDefinitions';

async function main() {
  console.log('\n======================================================');
  console.log('       🔬 AUDIOLAB TEST SUITE & ARCHITECTURE EVALUATION');
  console.log('======================================================\n');
  console.log(`Running ${ALL_TEST_DEFINITIONS.length} automated unit & integration test cases...\n`);

  const summary = await runTestSuite(undefined, (completed, total, latest) => {
    const icon = latest.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`[${completed}/${total}] ${icon} [${latest.category}] ${latest.name} (${latest.durationMs}ms)`);
    if (!latest.passed && latest.error) {
      console.log(`       ⚠️ ERROR: ${latest.error}`);
    }
  });

  console.log('\n======================================================');
  console.log('                 📊 RESUMEN DE LA SUITE');
  console.log('======================================================');
  console.log(` Total de pruebas: ${summary.total}`);
  console.log(` Exitosas:         ${summary.passed} ✅`);
  console.log(` Fallidas:         ${summary.failed} ${summary.failed > 0 ? '❌' : ''}`);
  console.log(` Tiempo total:     ${summary.durationMs}ms`);
  console.log(` Tasa de éxito:    ${((summary.passed / summary.total) * 100).toFixed(1)}%`);
  console.log('======================================================\n');

  if (summary.failed > 0) {
    console.error(`🚨 La suite finalizó con ${summary.failed} fallos.`);
    process.exit(1);
  } else {
    console.log('🎉 ¡Todas las pruebas pasaron satisfactoriamente!');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
