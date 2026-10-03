#!/usr/bin/env python3
"""Capture one City of Los Angeles Landbase parcel feature as exact bytes.

Local operator tool for later offline normalization. Two HTTPS GET requests go
to the explicit official layer URL: its layer metadata, then one attribute
query for the parcel lookup value. Each response body is preserved byte for
byte, with a dump of its parsed headers in received order, in an explicit,
empty, owner-only private directory with provenance, a log and SHA256SUMS.

It never rewrites JSON, normalizes, reprojects, follows a redirect, or draws a
legal-lot conclusion. Returned attributes are reported verbatim as source
attributes only. Nothing is written unless every check passes.

  --verify DIR re-checks a capture: SHA256SUMS must list every other file
  exactly once, and every digest must match.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import sys
import urllib.error
import urllib.parse
import urllib.request

VERSION = "1.0.0"
ROOT = Path(__file__).resolve().parents[2]
OFFICIAL_ORIGIN = "https://maps.lacity.org"
AGENCY = "City of Los Angeles"
USER_AGENT = f"permitpulse-program-screen-landbase-capture/{VERSION}"
LAYER_PATH = re.compile(r"^(/[A-Za-z0-9_.-]+)+/(MapServer|FeatureServer)/[0-9]{1,4}$")
FIELD = re.compile(r"^[A-Za-z_][A-Za-z0-9_]{0,63}$")
VALUE = re.compile(r"^[A-Za-z0-9._/-]+( [A-Za-z0-9._/-]+)*$")
NUMBER = re.compile(r"^[0-9]{1,20}$")
FILES = {
    "metadata_body": "layer-metadata.json",
    "metadata_headers": "layer-metadata.headers.txt",
    "geometry_body": "parcel-geometry.json",
    "geometry_headers": "parcel-geometry.headers.txt",
    "provenance": "capture-provenance.json",
    "log": "capture-log.txt",
}
SUMS = "SHA256SUMS"
NOTICE = ("Source attributes are reported verbatim as returned by the official layer. "
          "They are not legal-lot evidence: this capture draws no legal-lot conclusion.")


class CaptureError(Exception):
    pass


def sha(data):
    return hashlib.sha256(data).hexdigest()


def utc_now():
    return datetime.now(timezone.utc).isoformat(timespec="microseconds").replace("+00:00", "Z")


def checked_layer_url(url):
    parts = urllib.parse.urlsplit(url)
    if f"{parts.scheme}://{parts.netloc}" != OFFICIAL_ORIGIN or parts.query or parts.fragment:
        raise CaptureError(f"--layer-url must be an official {OFFICIAL_ORIGIN}/... layer URL without query or fragment")
    if not LAYER_PATH.match(parts.path) or any(segment in (".", "..") for segment in parts.path.split("/")):
        raise CaptureError("--layer-url must name one ArcGIS REST layer: .../MapServer/<id> or .../FeatureServer/<id>")
    return url


def checked_output_dir(path):
    directory = Path(path).absolute()
    try:
        info = directory.lstat()
    except FileNotFoundError:
        raise CaptureError(f"output directory does not exist: create it first (install -d -m 700 {directory})")
    if not stat.S_ISDIR(info.st_mode):
        raise CaptureError("output path is not a directory (symbolic links are refused)")
    if info.st_mode & 0o077 or info.st_uid != os.getuid():
        raise CaptureError("output directory must be owned by you and private (chmod 700)")
    resolved = directory.resolve()
    if resolved.is_relative_to(ROOT) and not resolved.is_relative_to(ROOT / ".private"):
        raise CaptureError("output directory is inside the repository; use a private directory outside the checkout or under ignored .private/")
    if any(resolved.iterdir()):
        raise CaptureError("output directory must be empty; captures are never overwritten")
    return resolved


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None  # urllib then raises HTTPError for the 3xx response


def http_get(url, timeout):
    request = urllib.request.Request(url, method="GET", headers={
        "Accept": "application/json", "Accept-Encoding": "identity", "User-Agent": USER_AGENT})
    started = utc_now()
    try:
        with urllib.request.build_opener(_NoRedirect).open(request, timeout=timeout) as response:
            body = response.read()
            status, reason, version = response.status, response.reason, response.version
            headers, final_url = response.getheaders(), response.geturl()
    except urllib.error.HTTPError as error:
        location = error.headers.get("Location") if error.headers else None
        raise CaptureError(f"HTTP {error.code} {error.reason} for {url}" + (f"; redirect to {location} not followed" if location else ""))
    except (urllib.error.URLError, OSError) as error:
        raise CaptureError(f"request failed for {url}: {getattr(error, 'reason', error)}")
    ended = utc_now()
    if status != 200:
        raise CaptureError(f"HTTP {status} {reason} for {url}; only 200 is accepted")
    if final_url != url:
        raise CaptureError(f"effective URL {final_url} differs from requested URL {url}")
    encodings = [value.strip().lower() for name, value in headers if name.lower() == "content-encoding"]
    if any(value not in ("", "identity") for value in encodings):
        raise CaptureError(f"response for {url} is content-encoded ({', '.join(encodings)}); exact entity bytes are required")
    if not body:
        raise CaptureError(f"empty response body for {url}")
    # Header names and values as parsed by Python http.client, in received order.
    dump = f"HTTP/{'1.1' if version == 11 else '1.0'} {status} {reason}\r\n"
    dump += "".join(f"{name}: {value}\r\n" for name, value in headers) + "\r\n"
    return {"requested_url": url, "final_url": final_url, "status": status, "reason": reason,
            "http_version": "HTTP/1.1" if version == 11 else "HTTP/1.0", "started": started, "ended": ended,
            "body": body, "headers": dump.encode("latin-1")}


def inspected_json(body, label):
    """Parse for inspection only; the preserved bytes are never re-serialized."""
    def constant(name):
        raise ValueError(name)
    try:
        value = json.loads(body.decode("utf-8"), parse_constant=constant)
    except (UnicodeDecodeError, ValueError):
        raise CaptureError(f"{label} response is not strict UTF-8 JSON")
    if not isinstance(value, dict):
        raise CaptureError(f"{label} response is not a JSON object")
    if "error" in value:
        raise CaptureError(f"{label} response is an ArcGIS error object despite HTTP 200")
    return value


def selected_feature(geometry, field, value, numeric):
    features = geometry.get("features")
    if not isinstance(features, list):
        raise CaptureError("parcel geometry response has no features array")
    if len(features) != 1:
        kind = "zero features" if not features else f"{len(features)} features"
        raise CaptureError(f"parcel geometry response has {kind}; exactly one is required (nothing written)")
    feature = features[0]
    attributes = feature.get("attributes") if isinstance(feature, dict) else None
    if not isinstance(attributes, dict) or not isinstance(feature.get("geometry"), dict):
        raise CaptureError("the returned feature lacks attributes or geometry")
    if field not in attributes:
        raise CaptureError(f"the returned feature has no {field} attribute")
    returned = attributes[field]
    matches = type(returned) is int and str(returned) == value if numeric else returned == value
    if not matches:
        raise CaptureError(f"the returned {field} attribute does not equal the lookup value")
    return feature


def crs_report(metadata, geometry, feature):
    extent = metadata.get("extent")
    return {"layer_metadata_extent": extent.get("spatialReference") if isinstance(extent, dict) else None,
            "query_response": geometry.get("spatialReference"),
            "feature_geometry": feature["geometry"].get("spatialReference")}


def write_new(path, data):
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, "wb") as handle:
        handle.write(data)


def request_record(role, response, body_name, headers_name):
    return {"role": role, "requested_url": response["requested_url"], "final_url": response["final_url"],
            "final_url_basis": "http_200_no_redirect_followed", "http_version": response["http_version"],
            "status": response["status"], "reason": response["reason"],
            "retrieval_started_utc": response["started"], "retrieval_ended_utc": response["ended"],
            "body_file": body_name, "body_bytes": len(response["body"]), "body_sha256": sha(response["body"]),
            "headers_file": headers_name, "headers_bytes": len(response["headers"]), "headers_sha256": sha(response["headers"])}


def capture_log(provenance, attributes, curves, geometry_keys):
    lines = ["PermitPulse Program Screen: City of Los Angeles Landbase parcel capture",
             f"tool: {provenance['tool']['name']} {VERSION} (sha256 {provenance['tool']['sha256']})",
             f"layer: {provenance['layer_url']}", f"lookup: {provenance['lookup']['where']}", ""]
    for request in provenance["requests"]:
        lines += [f"[{request['role']}]", f"requested URL: {request['requested_url']}",
                  f"final URL: {request['final_url']} ({request['final_url_basis']})",
                  f"HTTP status: {request['status']} {request['reason']} ({request['http_version']})",
                  f"retrieval start UTC: {request['retrieval_started_utc']}",
                  f"retrieval end UTC: {request['retrieval_ended_utc']}",
                  f"body: {request['body_file']} ({request['body_bytes']} bytes, sha256 {request['body_sha256']})",
                  f"headers: {request['headers_file']} ({request['headers_bytes']} bytes, sha256 {request['headers_sha256']})", ""]
    crs = provenance["source_crs"]
    lines += [f"features returned: {provenance['feature_count']}",
              f"source CRS (layer metadata extent): {json.dumps(crs['layer_metadata_extent'])}",
              f"source CRS (query response): {json.dumps(crs['query_response'])}",
              f"source CRS (feature geometry): {json.dumps(crs['feature_geometry'])}",
              f"geometry keys: {', '.join(geometry_keys)}"]
    if curves:
        lines.append(f"TRUE CURVES RETURNED ({', '.join(curves)}): preserved byte for byte. The pinned normalizer "
                     "refuses curves; never edit or densify this capture.")
    lines += ["", "Source attributes (verbatim, as returned):"]
    lines += [f"  {name}: {json.dumps(value, ensure_ascii=False)}" for name, value in attributes.items()]
    lines += ["", NOTICE, "Verify: sha256sum -c SHA256SUMS (inside this directory), or --verify <this directory>.", ""]
    return "\n".join(lines)


def capture(args):
    layer_url = checked_layer_url(args.layer_url)
    if not FIELD.match(args.lookup_field):
        raise CaptureError("--lookup-field must be one attribute name (letters, digits, underscore)")
    if not (NUMBER if args.lookup_numeric else VALUE).match(args.lookup_value) or len(args.lookup_value) > 64:
        raise CaptureError("--lookup-value has unsupported characters" + (" (digits only with --lookup-numeric)" if args.lookup_numeric else ""))
    directory = checked_output_dir(args.output_dir)
    where = f"{args.lookup_field} = {args.lookup_value}" if args.lookup_numeric else f"{args.lookup_field} = '{args.lookup_value}'"
    query = urllib.parse.urlencode([("where", where), ("outFields", "*"), ("returnGeometry", "true"), ("f", "json")])
    metadata_response = http_get(f"{layer_url}?f=json", args.timeout)
    geometry_response = http_get(f"{layer_url}/query?{query}", args.timeout)
    metadata = inspected_json(metadata_response["body"], "layer metadata")
    geometry = inspected_json(geometry_response["body"], "parcel geometry")
    feature = selected_feature(geometry, args.lookup_field, args.lookup_value, args.lookup_numeric)
    shape = feature["geometry"]
    curves = sorted(key for key in shape if key in ("curveRings", "curvePaths"))
    provenance = {
        "schema_version": "program-screen-la-landbase-capture-v1",
        "tool": {"name": Path(__file__).name, "version": VERSION, "sha256": sha(Path(__file__).read_bytes())},
        "agency": AGENCY, "layer_url": layer_url,
        "lookup": {"field": args.lookup_field, "value": args.lookup_value,
                   "comparison": "numeric" if args.lookup_numeric else "string", "where": where},
        "requests": [request_record("layer_metadata", metadata_response, FILES["metadata_body"], FILES["metadata_headers"]),
                     request_record("parcel_geometry", geometry_response, FILES["geometry_body"], FILES["geometry_headers"])],
        "feature_count": 1,
        "source_crs": crs_report(metadata, geometry, feature),
        "true_curves": {"present": bool(curves), "keys": curves},
        "source_attributes": feature["attributes"],
        "notice": NOTICE,
    }
    log = capture_log(provenance, feature["attributes"], curves, sorted(shape))
    outputs = {
        FILES["metadata_body"]: metadata_response["body"],
        FILES["metadata_headers"]: metadata_response["headers"],
        FILES["geometry_body"]: geometry_response["body"],
        FILES["geometry_headers"]: geometry_response["headers"],
        FILES["provenance"]: (json.dumps(provenance, indent=2, ensure_ascii=False) + "\n").encode(),
        FILES["log"]: log.encode(),
    }
    for name, data in outputs.items():
        write_new(directory / name, data)
    write_new(directory / SUMS, "".join(f"{sha(data)}  {name}\n" for name, data in sorted(outputs.items())).encode())
    print(log, end="")
    print(f"Capture written to {directory}")


def verify(path):
    directory = Path(path)
    try:
        lines = (directory / SUMS).read_text(encoding="ascii").splitlines()
    except (OSError, UnicodeDecodeError):
        raise CaptureError(f"{SUMS} is missing or unreadable")
    listed = {}
    for line in lines:
        match = re.fullmatch(r"([0-9a-f]{64}) [ *]([A-Za-z0-9._-]+)", line)
        if not match or match.group(2) in listed or match.group(2) == SUMS:
            raise CaptureError(f"malformed or duplicate {SUMS} line: {line!r}")
        listed[match.group(2)] = match.group(1)
    present = {entry.name for entry in directory.iterdir()} - {SUMS}
    for entry in directory.iterdir():
        if not stat.S_ISREG(entry.lstat().st_mode):
            raise CaptureError(f"unexpected non-regular file: {entry.name}")
    if present != set(listed) or present != set(FILES.values()):
        raise CaptureError(f"{SUMS} must list exactly every capture file; unlisted {sorted(present - set(listed))}, "
                           f"absent {sorted(set(listed) - present)}, required {sorted(set(FILES.values()) - present)}, "
                           f"unexpected {sorted(present - set(FILES.values()))}")
    for name, digest in listed.items():
        if sha((directory / name).read_bytes()) != digest:
            raise CaptureError(f"SHA-256 mismatch: {name}")
    print(f"Verified {len(listed)} files against {SUMS}; nothing unlisted.")


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--layer-url", help=f"official layer URL: {OFFICIAL_ORIGIN}/.../MapServer/<id>")
    parser.add_argument("--lookup-field", help="layer attribute that identifies the parcel, exactly as the layer names it")
    parser.add_argument("--lookup-value", help="parcel lookup value required by that attribute")
    parser.add_argument("--lookup-numeric", action="store_true", help="compare the attribute as an integer")
    parser.add_argument("--output-dir", help="existing, empty, private (chmod 700) directory outside the checkout")
    parser.add_argument("--timeout", type=float, default=60.0)
    parser.add_argument("--verify", metavar="DIR", help="verify an existing capture directory instead")
    args = parser.parse_args(argv)
    if args.verify is None:
        missing = [name for name in ("layer_url", "lookup_field", "lookup_value", "output_dir") if not getattr(args, name)]
        if missing:
            parser.error("required: " + ", ".join("--" + name.replace("_", "-") for name in missing))
    try:
        if args.verify is not None:
            verify(args.verify)
        else:
            capture(args)
    except CaptureError as error:
        print(f"capture refused: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
