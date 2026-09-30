#!/usr/bin/env python3
"""Sequential Phase 3G guard mutations; restore every original byte in finally.

Run after the baseline suite passes. Results include assertion failures, not
only a nonzero tool exit. No mutant is retained, committed, or repinned.
"""
import argparse
import json
import os
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[2]
APP = ROOT / "app"
GATE = APP / "src/shared/program-screen/authority-gate.ts"
INDEX = APP / "src/shared/program-screen/overlay-dataset.ts"
LOT = APP / "src/shared/program-screen/lot-overlay.ts"
CAPTURE = APP / "src/shared/program-screen/source-capture.ts"
NATIVE = APP / "src/shared/program-screen/filegdb-capture.ts"
HTTP = APP / "src/shared/program-screen/http-capture.ts"
RUNTIME_TEST = "tests/program-screen-lra-overlay-3g.test.ts"
PACKAGE_TEST = "tests/program-screen-lra-package-3g.test.ts"
HTTP_TEST = "tests/program-screen-http-capture-3g.test.ts"


def replace_once(before, after):
    def mutate(text):
        if text.count(before) != 1:
            raise ValueError(f"Mutation target not unique: {before}")
        return text.replace(before, after, 1)
    return mutate


def ignore_route(text):
    start = text.index("    const basis = qualifiers.statutory_basis;")
    end = text.index("    // Phase 3E: whether the map covers the lot", start)
    return text[:start] + "    // TEST-ONLY MUTANT: statutory route checks removed.\n" + text[end:]


def ignore_metadata_identity(text):
    start = text.index("  if (physical !== LRA_LAYER.toUpperCase()")
    end = text.index("\n", start)
    return text[:start] + '  if (false) fail("metadata-to-layer identity differs");' + text[end:]


MUTANTS = [
    ("ignore_invalid_candidate", LOT, replace_once("if (invalid.length > 0)", "if (false && invalid.length > 0)"), "relevant invalid geometry"),
    ("invalid_elsewhere_blocks_entire_state", LOT, replace_once("const invalid = candidates.filter", "const invalid = view.entries().filter"), "ignores invalid geometry elsewhere"),
    ("allow_partial_coverage", GATE, replace_once('if (computed.lot_within_features !== "whole_lot")', 'if (computed.lot_within_features === "none")'), "partial coverage"),
    ("any_very_high_instead_of_whole", GATE, replace_once("classes.every((cls) => cls === hazardClass)", "classes.some((cls) => cls === hazardClass)"), "mixed Very High / High YES"),
    ("trust_manual_class", GATE, replace_once("const classes = computed.classes_on_lot.map((label) => pack.overlay.class_labels[label]);", "const classes = [qualifiers.hazard_class];"), "manual class"),
    ("ignore_statutory_basis", GATE, ignore_route, "LRA package masquerading as PRC"),
    ("ignore_index_sha256", INDEX, replace_once("if (pin.index_sha256 !== indexSha256)", "if (false && pin.index_sha256 !== indexSha256)"), "index hash bypass"),
    ("ignore_record_sha256", INDEX, replace_once("record.content.length !== entry.content_bytes || (await sha256Bytes(record.content)) !== entry.content_sha256", "record.content.length !== entry.content_bytes"), "record hash bypass"),
    ("ignore_original_archive_sha256", CAPTURE, replace_once("if ((await sha256HexBytes(files.original)) !== metadata.sha256_original)", "if (false && (await sha256HexBytes(files.original)) !== metadata.sha256_original)"), "rejects archive hash mutation", PACKAGE_TEST),
    ("ignore_active_metadata_xml_sha256", NATIVE, replace_once("if (metadataHash !== LRA_METADATA_SHA256)", "if (false && metadataHash !== LRA_METADATA_SHA256)"), "rejects native metadata_xml mutation", PACKAGE_TEST),
    ("ignore_metadata_to_layer_identity", NATIVE, ignore_metadata_identity, "rejects native metadata_to_layer mutation", PACKAGE_TEST),
    ("ignore_response_header_sha256", HTTP, replace_once("bytes.length !== capture.response_headers.bytes || await digest(bytes) !== capture.response_headers.sha256", "bytes.length !== capture.response_headers.bytes"), "rejects edited original header text", HTTP_TEST),
]


def run(output):
    output = Path(output).resolve()
    output.mkdir(parents=True, exist_ok=True)
    originals = {mutation[1]: mutation[1].read_bytes() for mutation in MUTANTS}
    results = []
    env = {**os.environ, "WRANGLER_LOG_PATH": str(output / "wrangler.log")}
    baseline = subprocess.run(["npm", "test", "--", RUNTIME_TEST, PACKAGE_TEST, HTTP_TEST], cwd=APP, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    (output / "baseline.log").write_text(baseline.stdout)
    if baseline.returncode or "58 passed" not in baseline.stdout:
        raise ValueError("Mutation baseline did not pass all 58 current overlay/package/HTTP tests")
    try:
        for name, path, mutate, test, *suite in MUTANTS:
            path.write_text(mutate(originals[path].decode("utf-8")))
            try:
                result = subprocess.run(["npm", "test", "--", suite[0] if suite else RUNTIME_TEST, "-t", test], cwd=APP, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
                (output / f"{name}.log").write_text(result.stdout)
                killed = result.returncode != 0 and " FAIL " in result.stdout and "AssertionError" in result.stdout
                results.append({"mutation": name, "test": test, "result": "killed" if killed else "SURVIVED_OR_TOOL_ERROR"})
                print(json.dumps(results[-1]), flush=True)
            finally:
                path.write_bytes(originals[path])
    finally:
        for path, original in originals.items():
            path.write_bytes(original)
        (output / "results.json").write_text(json.dumps(results, indent=2) + "\n")
    if any(r["result"] != "killed" for r in results):
        raise ValueError("A mutation survived or failed without the intended assertion")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True)
    run(parser.parse_args().output)
