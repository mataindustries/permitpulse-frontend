#!/usr/bin/env python3
"""Offline verification of the pinned normalizer; uses TEST-ONLY captures."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[2]
FIXTURES = ROOT / "app/fixtures/program-screen/phase-3f-test-only"
NORMALIZER = ROOT / "tools/program-screen/normalize-reviewed-lot.py"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--proj-prefix", required=True)
    parser.add_argument("--tiff-prefix", required=True)
    args = parser.parse_args()
    profile = json.loads((ROOT / "app/src/shared/program-screen/normalization-profile.json").read_text())
    checks = []
    with tempfile.TemporaryDirectory(prefix="permitpulse-test-only-normalization-") as directory:
        directory = Path(directory)
        def command(source, metadata, output, proj_prefix=None, source_sha=None, cwd=None, metadata_sha=None, environment=None, normalizer=NORMALIZER):
            argv = ["python", str(normalizer), "--source", str(source), "--source-sha256", source_sha or hashlib.sha256(source.read_bytes()).hexdigest(),
                    "--metadata", str(metadata), "--metadata-sha256", metadata_sha or hashlib.sha256(metadata.read_bytes()).hexdigest(), "--apn", "0000000001", "--pin-value", "TEST-ONLY-PIN-3F",
                    "--output-dir", str(output), "--proj-prefix", str(proj_prefix or args.proj_prefix), "--tiff-prefix", args.tiff_prefix]
            return subprocess.run(argv, capture_output=True, text=True, cwd=cwd, env=environment)

        for name, source, expected in [("LA", "test-only-source.json", "test-only-lot-phase-3f-normalized.json"), ("SRA", "test-only-sra-source.json", "test-only-lot-phase-3f-normalized-sra.json"), ("partial", "test-only-partial-source.json", "test-only-lot-phase-3f-normalized-partial.json")]:
            for run in [1, 2]:
                result = command(FIXTURES / source, FIXTURES / "test-only-metadata.json", directory / f"{name}-{run}")
                assert result.returncode == 0, result.stderr
            first = (directory / f"{name}-1/normalized.json").read_bytes()
            assert first == (directory / f"{name}-2/normalized.json").read_bytes()
            assert first == (ROOT / "app/fixtures/program-screen/test-only-lot-geometries" / expected).read_bytes()
            receipts = [json.loads((directory / f"{name}-{run}/normalization-receipt.json").read_text()) for run in [1, 2]]
            assert receipts[0]["target"] == receipts[1]["target"]
            assert receipts[0]["normalized_at_utc"] != receipts[1]["normalized_at_utc"]
            assert all(receipt["test_only"] is True and receipt["network_enabled"] is False for receipt in receipts)
            checks.append(f"{name}: two independent outputs identical to pinned fixture, SHA-256 {hashlib.sha256(first).hexdigest()}")

        # A source hash mismatch must win even when native resources are unavailable.
        result = command(FIXTURES / "test-only-source.json", FIXTURES / "test-only-metadata.json", directory / "bad-source", directory / "no-proj", "0" * 64)
        assert result.returncode != 0 and "SHA-256 mismatch: test-only-source.json" in result.stderr
        checks.append("source bytes verified first")

        result = command(FIXTURES / "test-only-source.json", FIXTURES / "test-only-metadata.json", directory / "bad-metadata", metadata_sha="0" * 64)
        assert result.returncode != 0 and "SHA-256 mismatch: test-only-metadata.json" in result.stderr
        checks.append("layer metadata bytes verified")

        metadata = json.loads((FIXTURES / "test-only-metadata.json").read_text())
        metadata["extent"]["spatialReference"] = {"wkid": 3310}
        changed = directory / "wrong-crs.json"; changed.write_text(json.dumps(metadata))
        result = command(FIXTURES / "test-only-source.json", changed, directory / "wrong-crs")
        assert result.returncode != 0 and "approved EPSG:3857" in result.stderr
        checks.append("captured wrong CRS refused")

        isolated = directory / "isolated-proj"
        shutil.copytree(args.proj_prefix, isolated)
        grid = isolated / "share/proj/us_noaa_cshpgn.tif"
        grid.unlink()
        result = command(FIXTURES / "test-only-source.json", FIXTURES / "test-only-metadata.json", directory / "missing-grid", isolated)
        assert result.returncode != 0 and "us_noaa_cshpgn.tif" in result.stderr
        checks.append("missing preferred grid refused without fallback")
        grid.write_bytes(b"TEST-ONLY incorrect grid bytes")
        result = command(FIXTURES / "test-only-source.json", FIXTURES / "test-only-metadata.json", directory / "changed-grid", isolated)
        assert result.returncode != 0 and "SHA-256 mismatch" in result.stderr
        checks.append("changed preferred grid refused without fallback")

        # Restore the approved grid before independently mutating other resource links.
        grid.write_bytes((Path(args.proj_prefix) / "share/proj/us_noaa_cshpgn.tif").read_bytes())
        for resource_id in ["proj_db", "proj_ini", "libproj"]:
            resource = next(item for item in profile["resources"] if item["id"] == resource_id)
            path = isolated / resource["path"]
            original = path.read_bytes(); path.write_bytes(original + b"TEST-ONLY resource mutation")
            result = command(FIXTURES / "test-only-source.json", FIXTURES / "test-only-metadata.json", directory / resource_id, isolated)
            assert result.returncode != 0 and "SHA-256 mismatch" in result.stderr
            assert not (directory / resource_id / "normalized.json").exists()
            path.write_bytes(original)
            checks.append(f"changed {resource_id} refused before transformation")

        # A separate tool copy mutates only the pipeline, retaining every other pin.
        tool_root = directory / "tool-copy"
        for relative in ["tools/program-screen/normalize-reviewed-lot.py", "tools/program-screen/proj/approved-pipeline.proj", "app/src/shared/program-screen/normalization-profile.json"]:
            target = tool_root / relative; target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes((ROOT / relative).read_bytes())
        pipeline = tool_root / "tools/program-screen/proj/approved-pipeline.proj"
        pipeline.write_bytes(pipeline.read_bytes().replace(b"+x=-0.991", b"+x=-0.992"))
        result = command(FIXTURES / "test-only-source.json", FIXTURES / "test-only-metadata.json", directory / "pipeline-mutation", normalizer=tool_root / "tools/program-screen/normalize-reviewed-lot.py")
        assert result.returncode != 0 and "SHA-256 mismatch: approved-pipeline.proj" in result.stderr
        checks.append("changed operation pipeline refused before transformation")

        # Reproduce the review defect: an ELF with changed bytes and the same SONAME
        # must not be loaded while the receipt claims the system library's hash.
        loader = directory / "loader-override"; loader.mkdir()
        sqlite = next(item for item in profile["resources"] if item["id"] == "libsqlite3")
        (loader / "libsqlite3.so.0").write_bytes(Path(sqlite["path"]).read_bytes() + b"TEST-ONLY altered library")
        environment = os.environ.copy(); environment["LD_LIBRARY_PATH"] = str(loader)
        result = command(FIXTURES / "test-only-source.json", FIXTURES / "test-only-metadata.json", directory / "loaded-library-mutation", environment=environment)
        assert result.returncode != 0 and "loader overrides" in result.stderr
        assert not (directory / "loaded-library-mutation/normalized.json").exists()
        checks.append("native loader override cannot misstate the resource hash")

        environment = os.environ.copy(); environment["PROJ_NETWORK"] = "ON"
        result = command(FIXTURES / "test-only-source.json", FIXTURES / "test-only-metadata.json", directory / "network-override", environment=environment)
        assert result.returncode == 0, result.stderr
        assert json.loads((directory / "network-override/normalization-receipt.json").read_text())["network_enabled"] is False
        checks.append("inherited network setting cannot enable PROJ networking")

        # A malicious current-directory grid cannot shadow the selected pinned grid.
        (directory / "us_noaa_cshpgn.tif").write_bytes(b"TEST-ONLY incorrect current-directory grid")
        result = command(FIXTURES / "test-only-source.json", FIXTURES / "test-only-metadata.json", directory / "isolated-cwd", cwd=directory)
        assert result.returncode == 0, result.stderr
        assert (directory / "isolated-cwd/normalized.json").read_bytes() == (directory / "LA-1/normalized.json").read_bytes()
        checks.append("unpinned current-directory resource cannot shadow the grid")

        source = json.loads((FIXTURES / "test-only-source.json").read_text()); source["TEST_ONLY"] = False
        changed = directory / "test-only-private-source.json"; changed.write_text(json.dumps(source))
        forbidden = ROOT / "tools/program-screen/test-only-forbidden-private-output"
        try:
            result = command(changed, FIXTURES / "test-only-metadata.json", forbidden)
            assert result.returncode != 0 and "outside the public repository" in result.stderr
            assert not forbidden.exists()
        finally:
            if forbidden.exists(): shutil.rmtree(forbidden)
        checks.append("unmarked case output cannot enter the public repository")
        assert profile["network_enabled"] is False
    for check in checks:
        print("PASS:", check)
    print(f"{len(checks)} offline checks passed; no network resources fetched.")


if __name__ == "__main__":
    main()
