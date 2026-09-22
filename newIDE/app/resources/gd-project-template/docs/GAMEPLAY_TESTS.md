# Gameplay tests

The root `tests.settings` manifest identifies the actual tests. Test bodies live directly in `tests/*.js`; results do not belong in that directory. A new project has no passing-test evidence until tests have been authored and run.

Before editing tests, read the [gameplay-test reference](../skills/gdevelop-project-files/references/gameplay-test-harness.md) and the generated harness declarations as directed by the [project skill](../skills/gdevelop-project-files/SKILL.md).

Run authored tests from the GDevelop Gameplay Tests interface, or use MCP after source validation, commit and successful reload:

1. Call `run_gameplay_tests` with the exact scheme-free `tests.settings` file selector, or omit `file` to run all tests.
2. Poll `get_gameplay_test_results` with the returned `operation_id` until terminal status.
3. Treat only `status: completed` with `summary.all_passed: true` as a passing batch.

Use isolated save slots when testing persistence. Record the source revision, selected tests, actual results and limitations in `artifacts/verification/<task-or-version>/`. Visual inspection and gameplay-state assertions are separate evidence; state which was performed.
