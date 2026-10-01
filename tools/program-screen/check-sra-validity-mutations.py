#!/usr/bin/python3
"""Kill targeted topology bypasses in a disposable copy; never edit the checkout."""
import argparse
import json
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATASET = "src/shared/program-screen/overlay-dataset.ts"
LOT = "src/shared/program-screen/lot-overlay.ts"
TEST = "tests/program-screen-sra-validity-3h.test.ts"


def run(destination):
    destination = Path(destination).resolve()
    if not str(destination).startswith("/tmp/") or destination.exists():
        raise ValueError("Use a new disposable directory under /tmp")
    app = destination / "app"
    app.mkdir(parents=True)
    for folder in ("src", "tests"):
        shutil.copytree(ROOT / "app" / folder, app / folder)
    shutil.copyfile(ROOT / "app/tsconfig.json", app / "tsconfig.json")
    for folder in ("node_modules", "fixtures"):
        (app / folder).symlink_to(ROOT / "app" / folder, target_is_directory=True)
    (destination / "docs").symlink_to(ROOT / "docs", target_is_directory=True)
    (app / "package.json").write_text('{"type":"module"}\n')
    (app / "vitest.mutations.config.mts").write_text(
        'import { defineConfig } from "vitest/config";\n'
        'export default defineConfig({define:{"import.meta.env.MODE":"\\"test\\"","import.meta.env.PROD":"false"},'
        'test:{environment:"node"}});\n'
    )
    baseline = {file: (app / file).read_text() for file in (DATASET, LOT)}
    mutations = [
        ("allow_missing_validity", LOT, 'entry.geometry_state !== "valid"',
         'entry.geometry_state !== undefined && entry.geometry_state !== "valid"'),
        ("allow_invalid_geometry", LOT, 'entry.geometry_state !== "valid"',
         'entry.geometry_state === undefined || entry.geometry_state === "unreadable"'),
        ("allow_unreadable_geometry", LOT, 'entry.geometry_state !== "valid"',
         'entry.geometry_state === undefined || entry.geometry_state === "invalid"'),
        ("ignore_validity_record_hash", DATASET, 'proof.record_number !== entry.record_number || proof.geometry_sha256 !== entry.content_sha256',
         'proof.record_number !== entry.record_number'),
        ("ignore_geometry_content_hash", DATASET, 'record.content.length !== entry.content_bytes || (await sha256Bytes(record.content)) !== entry.content_sha256',
         'record.content.length !== entry.content_bytes'),
        ("ignore_index_pin", DATASET, 'if (pin.index_sha256 !== indexSha256)', 'if (false)'),
        ("exclude_unknown_extents", DATASET, '(entry.extent === null && entry.geometry_state !== "valid")', 'false'),
        ("poison_unrelated_lots", DATASET,
         'entry.extent[0] <= box[2] &&\n      entry.extent[2] >= box[0] &&\n      entry.extent[1] <= box[3] &&\n      entry.extent[3] >= box[1]', 'true'),
    ]
    outcomes = []

    def verify(name, expected_failure):
        report = destination / f"{name}.json"
        result = subprocess.run([
            str(ROOT / "app/node_modules/.bin/vitest"), "run", "--config", "vitest.mutations.config.mts", TEST,
            "-t", "Phase 3H synthetic topology safety requirements", "--reporter=json", f"--outputFile={report}",
        ], cwd=app, capture_output=True, text=True, timeout=120)
        (destination / f"{name}.log").write_text(result.stdout + result.stderr)
        if not report.exists():
            raise ValueError(f"{name}: tooling failed, not a killed mutation")
        data = json.loads(report.read_text())
        failed = [a for suite in data["testResults"] for a in suite["assertionResults"] if a["status"] == "failed"]
        if expected_failure:
            # Vitest uses Error (rather than AssertionError) when an expected
            # rejection unexpectedly resolves. That is an expectation failure,
            # while transform errors and arbitrary runtime exceptions are not.
            def assertion_failure(messages):
                return any("AssertionError" in m or ("instead of rejecting" in m and "__VITEST_REJECTS__" in m) for m in messages)
            if result.returncode == 0 or not failed or any(not assertion_failure(a["failureMessages"]) for a in failed):
                raise ValueError(f"{name}: survived or failed for a non-assertion reason")
        elif result.returncode != 0 or not data["success"]:
            raise ValueError(f"{name}: baseline failed; inspect {name}.log")
        return len(failed), data["numPassedTests"]

    _, passed = verify("baseline", False)
    print(f"Baseline: {passed} tests passed", flush=True)
    for name, file, old, new in mutations:
        for path, content in baseline.items():
            (app / path).write_text(content)
        if baseline[file].count(old) != 1:
            raise ValueError(f"{name}: mutation target is not unique")
        (app / file).write_text(baseline[file].replace(old, new))
        failures, _ = verify(name, True)
        outcomes.append({"mutation": name, "result": "killed", "assertion_failures": failures})
        print(f"{name}: killed ({failures} assertion failures)", flush=True)
    for path, content in baseline.items():
        (app / path).write_text(content)
    _, restored = verify("restored", False)
    (destination / "results.json").write_text(json.dumps({"baseline_passes": passed, "restored_passes": restored, "mutations": outcomes}, indent=2) + "\n")
    print(f"Restored baseline: {restored} tests passed; all {len(outcomes)} mutations killed", flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    run(args.output)
