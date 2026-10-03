#!/usr/bin/env python3
"""Offline checks for the Phase 3M operator tools; fictional TEST-ONLY data only.

CAP1-CAP8 drive capture-la-landbase-parcel.py in process against a loopback
HTTP server (its official origin is replaced for this process only; nothing
reaches an external host). READY1-READY14 run publication-readiness-guard.py
as a subprocess. Prints PASS/FAIL per check and exits nonzero on any failure.
"""
import contextlib
import hashlib
import http.server
import importlib.util
import io
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import threading

sys.dont_write_bytecode = True  # loading the tools in process must not write __pycache__ into the checkout
HERE = Path(__file__).resolve().parent
LAYER = "/arcgis/rest/services/TEST_ONLY/Fictional_Parcels/MapServer/0"
PIN = "TEST-ONLY-PIN-3M"
# Deliberately irregular bytes (spacing, key order, escapes, 1.50, no final LF)
# so any re-serialization would change them.
METADATA = (b'{"TEST_ONLY" : true, "name":"Fictional Parcels (TEST-ONLY)","geometryType":"esriGeometryPolygon",\n'
            b' "extent":{"xmin":-13189100.0,"ymin":4033900.0,"xmax":-13188900.0,"ymax":4034100.0,'
            b'"spatialReference":{"wkid":102100,"latestWkid":3857}},"note":"caf\\u00e9 1.50"}')
FEATURE = ('{"attributes":{"PIN":"%s","APN":"0000000000","TRACT":"TEST-ONLY-TRACT","LOT":"0"},'
           '"geometry":{"rings":[[[-13189000.0,4034000.0],[-13188980.0,4034000.0],[-13188980.0,4034020.0],'
           '[-13189000.0,4034020.0],[-13189000.0,4034000.0]]]}}')
CURVED = ('{"attributes":{"PIN":"%s"},"geometry":{"curveRings":[[[-13189000.0,4034000.0],'
          '{"c":[[-13188980.0,4034020.0],[-13188985.0,4034005.0]]},[-13189000.0,4034000.0]]]}}')
LEGAL_IDENTITIES = ("legal_lot_identity", "parcel_is_one_legal_lot", "parcel_and_legal_lot_differ",
                    "tied_or_multiple_lots", "merger_or_resubdivision_pending_or_proposed", "not_established")


def geometry_body(*features):
    return ('{"TEST_ONLY":true,  "displayFieldName":"PIN","spatialReference":{"wkid":102100,"latestWkid":3857},\n'
            '"features":[' + ",".join(feature % PIN for feature in features) + "]}\n").encode()


class Server(http.server.BaseHTTPRequestHandler):
    routes = {}
    requests = []

    def do_GET(self):
        Server.requests.append(self.path)
        path, _, query = self.path.partition("?")
        status, body = Server.routes.get("metadata" if path == LAYER and query == "f=json" else
                                         "geometry" if path == LAYER + "/query" else "", (404, b"{}"))
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("X-Test-Only", "fictional loopback response")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        pass


def load(name):
    spec = importlib.util.spec_from_file_location(name.replace("-", "_"), HERE / name)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def run(module, argv):
    out, err = io.StringIO(), io.StringIO()
    with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
        try:
            code = module.main(argv)
        except SystemExit as exit:
            code = exit.code if isinstance(exit.code, int) else 1
    return code, out.getvalue(), err.getvalue()


def main():
    os.environ["no_proxy"] = os.environ["NO_PROXY"] = "127.0.0.1"
    capture = load("capture-la-landbase-parcel.py")
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Server)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    capture.OFFICIAL_ORIGIN = f"http://127.0.0.1:{server.server_port}"
    layer_url = capture.OFFICIAL_ORIGIN + LAYER
    work = Path(tempfile.mkdtemp(prefix="permitpulse-3m-operator-checks-"))
    results = []

    def check(name, test):
        try:
            test()
            results.append((name, True, ""))
        except Exception as error:  # any crash is a failed check, never a pass
            results.append((name, False, f"{type(error).__name__}: {error}"))

    def scenario(geometry, metadata=METADATA, status=200):
        Server.routes = {"metadata": (200, metadata), "geometry": (status, geometry)}
        Server.requests = []
        output = Path(tempfile.mkdtemp(dir=work))
        code, out, err = run(capture, ["--layer-url", layer_url, "--lookup-field", "PIN", "--lookup-value", PIN, "--output-dir", str(output)])
        return code, out, err, output

    good = {}

    def successful():
        if not good:
            code, out, err, output = scenario(geometry_body(FEATURE))
            assert code == 0, err
            good.update(out=out, output=output)
        return good["out"], good["output"]

    def cap1():
        code, _, err, output = scenario(geometry_body())
        assert code != 0 and "zero features" in err and "exactly one" in err, (code, err)
        assert not any(output.iterdir()), "nothing may be written"

    def cap2():
        code, _, err, output = scenario(geometry_body(FEATURE, FEATURE))
        assert code != 0 and "2 features" in err and "exactly one" in err, (code, err)
        assert not any(output.iterdir()), "nothing may be written"

    def cap3():
        _, output = successful()
        assert (output / "parcel-geometry.json").read_bytes() == geometry_body(FEATURE)

    def cap4():
        _, output = successful()
        assert (output / "layer-metadata.json").read_bytes() == METADATA

    def cap5():
        _, output = successful()
        provenance = json.loads((output / "capture-provenance.json").read_text())
        metadata, geometry = provenance["requests"]
        assert metadata["requested_url"] == metadata["final_url"] == layer_url + "?f=json"
        assert geometry["requested_url"].startswith(layer_url + "/query?where=PIN+%3D+%27TEST-ONLY-PIN-3M%27&outFields=")
        assert geometry["final_url"] == geometry["requested_url"]
        for request, body, headers in [(metadata, "layer-metadata.json", "layer-metadata.headers.txt"),
                                       (geometry, "parcel-geometry.json", "parcel-geometry.headers.txt")]:
            assert request["status"] == 200 and request["retrieval_started_utc"] <= request["retrieval_ended_utc"]
            assert request["retrieval_started_utc"].endswith("Z") and request["retrieval_ended_utc"].endswith("Z")
            dump = (output / headers).read_bytes()
            assert dump.startswith(b"HTTP/1.0 200 OK\r\n") and b"X-Test-Only: fictional loopback response\r\n" in dump
            received = [line.split(": ", 1) for line in dump.decode("latin-1").split("\r\n")[1:-2]]
            assert [name for name, _ in received] == ["Server", "Date", "Content-Type", "X-Test-Only", "Content-Length"]
            assert received[0][1] == f"{Server.server_version} {Server.sys_version}" and received[1][1]
            assert received[2:] == [["Content-Type", "application/json; charset=utf-8"],
                                    ["X-Test-Only", "fictional loopback response"],
                                    ["Content-Length", str(len((output / body).read_bytes()))]]
            assert request["headers_bytes"] == len(dump) and request["body_bytes"] == len((output / body).read_bytes())
            assert request["headers_sha256"] == hashlib.sha256(dump).hexdigest()
            assert request["body_sha256"] == hashlib.sha256((output / body).read_bytes()).hexdigest()
        assert provenance["source_crs"]["layer_metadata_extent"] == {"wkid": 102100, "latestWkid": 3857}
        assert provenance["source_crs"]["query_response"] == {"wkid": 102100, "latestWkid": 3857}
        log = (output / "capture-log.txt").read_text()
        assert all(request["requested_url"] in log and request["retrieval_started_utc"] in log for request in (metadata, geometry))
        assert "HTTP status: 200 OK" in log and 'source CRS (query response): {"wkid": 102100, "latestWkid": 3857}' in log

    def cap6():
        _, output = successful()
        lines = (output / "SHA256SUMS").read_text().splitlines()
        listed = {line[66:]: line[:64] for line in lines}
        files = {entry.name for entry in output.iterdir()} - {"SHA256SUMS"}
        assert set(listed) == files and len(lines) == len(files) == 6, (sorted(listed), sorted(files))
        assert all(hashlib.sha256((output / name).read_bytes()).hexdigest() == digest for name, digest in listed.items())
        if shutil.which("sha256sum"):
            assert subprocess.run(["sha256sum", "--check", "--strict", "SHA256SUMS"], cwd=output, capture_output=True).returncode == 0
        assert run(capture, ["--verify", str(output)])[0] == 0
        tampered = Path(tempfile.mkdtemp(dir=work)) / "copy"
        shutil.copytree(output, tampered)
        (tampered / "parcel-geometry.json").write_bytes(geometry_body(FEATURE) + b" ")
        assert run(capture, ["--verify", str(tampered)])[0] != 0
        (tampered / "parcel-geometry.json").write_bytes(geometry_body(FEATURE))
        (tampered / "capture-log.txt").unlink()
        assert run(capture, ["--verify", str(tampered)])[0] != 0
        (tampered / "capture-log.txt").write_bytes((output / "capture-log.txt").read_bytes())
        (tampered / "unlisted.txt").write_bytes(b"TEST-ONLY")
        assert run(capture, ["--verify", str(tampered)])[0] != 0
        with (tampered / "SHA256SUMS").open("a") as sums:
            sums.write(f"{hashlib.sha256(b'TEST-ONLY').hexdigest()}  unlisted.txt\n")
        assert run(capture, ["--verify", str(tampered)])[0] != 0

    def cap7():
        out, output = successful()
        log = (output / "capture-log.txt").read_text()
        provenance = (output / "capture-provenance.json").read_text()
        section = log.split("Source attributes (verbatim, as returned):\n", 1)[1]
        for line in ('  PIN: "TEST-ONLY-PIN-3M"', '  APN: "0000000000"', '  TRACT: "TEST-ONLY-TRACT"', '  LOT: "0"'):
            assert line in section, line
        assert json.loads(provenance)["source_attributes"]["APN"] == "0000000000"
        assert capture.NOTICE in log and capture.NOTICE in out
        for text in (out, log, provenance):
            assert not any(token in text for token in LEGAL_IDENTITIES)

    def cap8():
        base = ["--layer-url", layer_url, "--lookup-field", "PIN", "--lookup-value", PIN]
        Server.routes, Server.requests = {"metadata": (200, METADATA), "geometry": (200, geometry_body(FEATURE))}, []
        code, _, err = run(capture, base)
        assert code != 0 and "--output-dir" in err, (code, err)
        code, _, err = run(capture, base + ["--output-dir", str(work / "absent")])
        assert code != 0 and "does not exist" in err, (code, err)
        inside = capture.ROOT / "tools/program-screen/test-only-3m-capture-output"
        inside.mkdir(mode=0o700)
        try:
            code, _, err = run(capture, base + ["--output-dir", str(inside)])
            assert code != 0 and "inside the repository" in err and not any(inside.iterdir()), (code, err)
        finally:
            shutil.rmtree(inside)
        shared = Path(tempfile.mkdtemp(dir=work))
        shared.chmod(0o755)
        code, _, err = run(capture, base + ["--output-dir", str(shared)])
        assert code != 0 and "chmod 700" in err, (code, err)
        assert Server.requests == [], "no request may be made before the output directory is accepted"

    def supplementary_http_failure():
        code, _, err, output = scenario(geometry_body(FEATURE), status=500)
        assert code != 0 and "HTTP 500" in err and not any(output.iterdir()), (code, err)
        code, _, err, output = scenario(b'{"error":{"code":400,"message":"TEST-ONLY"}}')
        assert code != 0 and "ArcGIS error" in err and not any(output.iterdir()), (code, err)

    def supplementary_true_curves():
        code, out, err, output = scenario(geometry_body(CURVED))
        assert code == 0, err
        assert (output / "parcel-geometry.json").read_bytes() == geometry_body(CURVED)
        assert json.loads((output / "capture-provenance.json").read_text())["true_curves"] == {"present": True, "keys": ["curveRings"]}
        assert "TRUE CURVES RETURNED (curveRings)" in out

    for name, test in [("CAP1 zero features -> nonzero exit, nothing written", cap1),
                       ("CAP2 multiple features -> nonzero exit, nothing written", cap2),
                       ("CAP3 geometry body byte-identical to the mocked HTTP body", cap3),
                       ("CAP4 metadata body byte-identical", cap4),
                       ("CAP5 headers and provenance recorded", cap5),
                       ("CAP6 SHA256SUMS lists every file and verifies; tampering detected", cap6),
                       ("CAP7 identifiers reported only as source attributes", cap7),
                       ("CAP8 missing, absent, in-repository or shared output directory -> fail", cap8),
                       ("CAP supplementary: HTTP failure and ArcGIS error object refused", supplementary_http_failure),
                       ("CAP supplementary: true curves preserved and reported", supplementary_true_curves)]:
        check(name, test)
    server.shutdown()

    def guard(payload, as_file=False):
        raw = payload if isinstance(payload, bytes) else json.dumps(payload).encode()
        if as_file:
            path = work / "validate-response.json"
            path.write_bytes(raw)
            return subprocess.run([sys.executable, str(HERE / "publication-readiness-guard.py"), str(path)], capture_output=True, text=True)
        return subprocess.run([sys.executable, str(HERE / "publication-readiness-guard.py")], input=raw, capture_output=True)

    def output(result):
        text = result.stdout + result.stderr
        return text if isinstance(text, str) else text.decode()

    def record(number, present):
        return {"record_number": number, "content_sha256": f"{number:064x}", "content_bytes": 1000 + number,
                "geometry_state": "valid", "present": present}

    def route(name, records, index="present"):
        return {"route": name, "authority_source_id": f"test-only-{name}", "index_sha256": "e" * 64,
                "index": index, "required_records": records}

    def validation(valid=True, routes=None, diagnostics=()):
        # Complete emitted Phase 3K shape; all values are fictional TEST-ONLY.
        return {"ok": True, "data": {"schema_version": "program-screen-case-preparation-validation-v1",
                "case_id": "00000000-0000-4000-8000-000000000000", "as_of": "2026-10-01", "valid": valid,
                "expected_revision_current": True,
                "review": {"review_id": "00000000-0000-5000-8000-000000000000", "reviewed_on": "2026-10-01",
                           "next_review_on": "2026-10-30", "legal_lot_identity": "not_established", "manifest_sha256": "a" * 64},
                "diagnostics": list(diagnostics),
                "hazard_routes": routes if routes is not None else [route("gov_51178", [record(1, True)]), route("prc_4202", [])]}}

    def ready1():
        result = guard(validation(False, diagnostics=[{"code": "FILE_MISSING", "severity": "error"}]))
        assert result.returncode == 1 and "NOT READY" in output(result) and "data.valid is false" in output(result)
        assert "FILE_MISSING" in output(result)

    def ready2():
        result = guard(validation(routes=[route("gov_51178", [record(1, True), record(2, False), record(3, True)]), route("prc_4202", [])]))
        text = output(result)
        assert result.returncode == 1 and "NOT READY" in text and "1 of 3 required" in text, text
        assert f"record 2  record-{2:064x}.bin" in text and f"{1:064x}" not in text and f"{3:064x}" not in text

    def ready3():
        result = guard(validation(routes=[route("gov_51178", [record(n, n == 5) for n in range(1, 6)]), route("prc_4202", [])]))
        text = output(result)
        assert result.returncode == 1 and "4 of 5 required" in text, text
        assert all(f"record {n}  record-{n:064x}.bin" in text for n in range(1, 5)) and f"{5:064x}" not in text

    def ready4():
        result = guard(validation(routes=[route("gov_51178", [record(1, True), record(2, True)]),
                                          route("prc_4202", [record(7, True)])]), as_file=True)
        assert result.returncode == 0 and output(result).startswith("READY:"), output(result)

    def ready5():
        result = guard(validation(routes=[route("gov_51178", []), route("prc_4202", [])]))
        assert result.returncode == 0 and "gov_51178: 0 required" in output(result), output(result)
        result = guard(validation(routes=[route("gov_51178", []), route("prc_4202", [record(4, True)])]))
        assert result.returncode == 0, output(result)

    def ready6():
        base = json.dumps(validation())
        cases = [b"", b"not json", b"[]", b"\xff\xfe", json.dumps({"ok": False, "error": {"code": "FORBIDDEN"}}).encode(),
                 json.dumps({"ok": True}).encode(), json.dumps(validation()["data"]).encode(),
                 base.replace('"valid": true', '"valid": "true"').encode(),
                 base.replace('"valid": true', '"valid": true, "valid": false').encode(),
                 base.replace('"valid": true', '"valid": NaN').encode(),
                 base.replace("program-screen-case-preparation-validation-v1", "program-screen-case-preparation-status-v1").encode(),
                 json.dumps(validation(routes=[])).encode()]
        broken = [lambda r: r.pop("route"), lambda r: r.pop("required_records"), lambda r: r.update(index="unknown"),
                  lambda r: r.update(required_records="none"), lambda r: r.update(index="missing"),
                  lambda r: r["required_records"][0].update(present="true"),
                  lambda r: r["required_records"][0].update(present=None),
                  lambda r: r["required_records"][0].pop("present"),
                  lambda r: r["required_records"][0].update(record_number=True),
                  lambda r: r["required_records"][0].update(content_sha256="A" * 64),
                  lambda r: r.update(index="missing", required_records=[]),
                  lambda r: r["required_records"][0].update(content_sha256=int("1" * 64)),
                  lambda r: r["required_records"][0].update(content_sha256="e" * 64 + "\n"),
                  lambda r: r["required_records"][0].update(content_sha256=" " + "e" * 64),
                  lambda r: r.update(required_records=[17]), lambda r: r.update(required_records=[None])]
        for mutate in broken:
            document = validation()
            mutate(document["data"]["hazard_routes"][0])
            cases.append(json.dumps(document).encode())
        duplicate = validation(routes=[route("gov_51178", []), route("gov_51178", [])])
        cases.append(json.dumps(duplicate).encode())
        for raw in cases:
            result = guard(raw)
            assert result.returncode == 2 and "MALFORMED INPUT" in output(result), (raw[:120], result.returncode, output(result))

    def ready7():
        a_ok, b_missing = route("gov_51178", [record(1, True)]), route("prc_4202", [record(8, True), record(9, False)])
        for routes in ([a_ok, b_missing], [b_missing, a_ok]):
            text = output(result := guard(validation(routes=routes)))
            assert result.returncode == 1 and "prc_4202: 1 of 2" in text and "gov_51178:" not in text, text
        both_missing = [route("gov_51178", [record(2, False)]), route("prc_4202", [record(3, False)])]
        text = output(result := guard(validation(routes=both_missing)))
        assert result.returncode == 1 and "gov_51178: 1 of 1" in text and "prc_4202: 1 of 1" in text, text
        for index in ("missing", "present"):
            unavailable = route("prc_4202", None, index=index)
            if index == "missing":
                unavailable["index_sha256"] = None  # unresolved route is also an emitted shape
            text = output(result := guard(validation(routes=[a_ok, unavailable])))
            assert result.returncode == 1 and "prc_4202: required CAL FIRE records were not reported" in text, text

    def refuse(document):
        result = guard(document)
        assert result.returncode == 2 and not output(result).startswith("READY:"), (result.returncode, output(result))

    def ready8():
        # The whole response is complete, including both emitted routes and the
        # proposed review summary. An ordinary candidate loop may yield no SRA records.
        document = validation()
        document["data"]["diagnostics"] = [{"code": "LEGAL_IDENTITY_NOT_ESTABLISHED", "severity": "info",
                                            "field": "legal_lot_identity"}]
        result = guard(document, as_file=True)
        assert result.returncode == 0 and output(result).startswith("READY:") and "prc_4202: 0 required" in output(result), output(result)

    def ready9():
        document = validation()
        document["data"]["hazard_routes"][1].pop("authority_source_id")
        refuse(document)
        for value in (None, 17, True, "", " ", [], {}):
            document = validation()
            document["data"]["hazard_routes"][1]["authority_source_id"] = value
            refuse(document)
        document = validation()
        document["data"]["hazard_routes"][0].pop("authority_source_id")
        refuse(document)

    def ready10():
        document = validation()
        document["data"]["hazard_routes"][1].pop("index_sha256")
        refuse(document)
        for value in (None, 17, True, "", "e" * 63, "E" * 64, "e" * 64 + "\n", " " + "e" * 64, [], {}):
            document = validation()
            document["data"]["hazard_routes"][1]["index_sha256"] = value
            refuse(document)
        document = validation()
        document["data"]["hazard_routes"][0].pop("index_sha256")
        refuse(document)

    def ready11():
        document = validation()
        document["data"]["hazard_routes"][0]["required_records"][0].pop("content_bytes")
        refuse(document)
        for value in (None, True, -1, 1.5, "1001", [], {}):
            document = validation()
            document["data"]["hazard_routes"][0]["required_records"][0]["content_bytes"] = value
            refuse(document)

    def ready12():
        document = validation()
        document["data"]["hazard_routes"][0]["required_records"][0].pop("geometry_state")
        refuse(document)
        for value in (True, 17, "unknown", "", [], {}):
            document = validation()
            document["data"]["hazard_routes"][0]["required_records"][0]["geometry_state"] = value
            refuse(document)

    def ready13():
        for value in ([17], [None], ["warning"], [{}], [{"code": "TEST_ONLY"}], [{"severity": "info"}],
                      [{"code": 17, "severity": "info"}], [{"code": "TEST_ONLY", "severity": "fatal"}], {}, None):
            document = validation()
            document["data"]["diagnostics"] = value
            refuse(document)
        for field, value in (("field", 17), ("sha256", 17), ("sha256", "e" * 64 + "\n"), ("route", []),
                             ("route", "unknown"), ("record_numbers", [True]), ("record_numbers", [0]),
                             ("record_numbers", [1.5]), ("record_numbers", "1")):
            refuse(validation(diagnostics=[{"code": "TEST_ONLY", "severity": "info", field: value}]))

    def ready14():
        complete = validation()
        for field in complete["data"]:
            document = validation()
            document["data"].pop(field)
            refuse(document)
        for field, value in (("case_id", 17), ("case_id", "not-a-uuid"),
                             ("case_id", "00000000-0000-f000-8000-000000000000"),
                             ("case_id", "00000000-0000-4000-2000-000000000000"), ("as_of", "2026-02-30"),
                             ("as_of", 17), ("expected_revision_current", "true"), ("review", []),
                             ("review", {}), ("hazard_routes", {}), ("hazard_routes", [None, None])):
            document = validation()
            document["data"][field] = value
            refuse(document)
        for field in complete["data"]["review"]:
            document = validation()
            document["data"]["review"].pop(field)
            refuse(document)
        for field, value in (("review_id", 17), ("review_id", "not-a-uuid"),
                             ("review_id", "00000000-0000-f000-8000-000000000000"),
                             ("review_id", "00000000-0000-5000-2000-000000000000"), ("reviewed_on", "2026-13-01"),
                             ("next_review_on", None), ("legal_lot_identity", []), ("legal_lot_identity", "unknown"),
                             ("manifest_sha256", 17), ("manifest_sha256", "e" * 64 + "\n")):
            document = validation()
            document["data"]["review"][field] = value
            refuse(document)
        for routes in ([complete["data"]["hazard_routes"][0]], [17, {}],
                       [route("gov_51178", []), route("unknown", [])],
                       [route("gov_51178", []), route("prc_4202", []), route("unknown", [])]):
            refuse(validation(routes=routes))
        for number in (0, -1, 1.5):
            document = validation()
            document["data"]["hazard_routes"][0]["required_records"][0]["record_number"] = number
            refuse(document)
        # Optional additions and the nullable/zero/invalid states emitted by
        # Phase 3K stay accepted; none creates a new semantic readiness gate.
        for state in ("valid", "invalid", "unreadable", None):
            document = validation(diagnostics=[{"code": "TEST_ONLY", "severity": "info", "field": "legal_lot_identity",
                                              "sha256": "a" * 64, "route": "gov_51178", "record_numbers": [1], "future": 17}])
            document["future"] = document["data"]["future"] = document["data"]["review"]["future"] = 17
            document["data"]["expected_revision_current"] = False
            record_item = document["data"]["hazard_routes"][0]["required_records"][0]
            record_item.update(content_bytes=0, geometry_state=state, future=17)
            document["data"]["hazard_routes"][0]["future"] = 17
            result = guard(document)
            assert result.returncode == 0 and output(result).startswith("READY:"), output(result)
        document = validation()
        document["data"]["review"] = None
        assert guard(document).returncode == 0

    for name, test in [("READY1 valid=false -> refuse", ready1),
                       ("READY2 valid=true + one required record missing -> refuse", ready2),
                       ("READY3 valid=true + several missing -> refuse", ready3),
                       ("READY4 valid=true + every required record present -> allow", ready4),
                       ("READY5 route with zero required records -> allow", ready5),
                       ("READY6 malformed JSON or shape -> fail closed (exit 2)", ready6),
                       ("READY7 multiple routes are all checked", ready7),
                       ("READY8 complete legitimate zero-candidate route -> allow", ready8),
                       ("READY9 zero-candidate route missing/malformed authority_source_id -> refuse", ready9),
                       ("READY10 zero-candidate route missing/malformed index_sha256 -> refuse", ready10),
                       ("READY11 required record missing/malformed content_bytes -> refuse", ready11),
                       ("READY12 required record missing/malformed geometry_state -> refuse", ready12),
                       ("READY13 diagnostics=[17] or malformed diagnostic fields -> refuse", ready13),
                       ("READY14 complete response shape and optional emitted states", ready14)]:
        check(name, test)
    shutil.rmtree(work)
    for name, passed, detail in results:
        print(("PASS: " if passed else "FAIL: ") + name + ("" if passed else f"\n      {detail}"))
    failed = sum(not passed for _, passed, _ in results)
    print(f"{len(results) - failed} / {len(results)} operator-tool checks passed; fictional data only, no external network.")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
