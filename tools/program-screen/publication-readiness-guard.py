#!/usr/bin/env python3
"""Decide whether the operator may proceed toward Phase 3K publication.

Reads one saved Phase 3K `POST .../preparation/validate` response (a file
path, or standard input) and requires BOTH:

  1. data.valid === true, and
  2. present === true for every required CAL FIRE record the API reported,
     on every route. A route reporting zero required records is complete; a
     route whose required records were not reported (null) is not.

It never calls the API, derives candidates or evaluates a route: it reads only
the API's own output. Exit 0: ready. Exit 1: not ready. Exit 2: unreadable or
malformed input (fail closed).
"""
from datetime import date
import json
from pathlib import Path
import re
import sys

VALIDATION_SCHEMA = "program-screen-case-preparation-validation-v1"
DIGEST = re.compile(r"^[0-9a-f]{64}$")
# Existing Phase 3K response types and emitters in case-preparation.ts:
# HAZARD_ROUTES, CasePreparationDiagnostic, RequiredCalFireRecord,
# PreparationHazardRouteStatus, ProposedReviewSummary, CasePreparationValidation.
# These are response shapes, not authority/index pins or evaluation rules.
ROUTES = {"gov_51178", "prc_4202"}
# Match the existing z.uuid() schemas (versions 1-8, RFC variant, nil/max).
UUID = re.compile(r"(?:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}"
                  r"|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)")
LEGAL_IDENTITIES = {"parcel_is_one_legal_lot", "parcel_and_legal_lot_differ", "tied_or_multiple_lots",
                    "merger_or_resubdivision_pending_or_proposed", "not_established"}


class Malformed(Exception):
    pass


def text(value):
    return isinstance(value, str) and bool(value.strip())


def digest(value):
    return isinstance(value, str) and DIGEST.fullmatch(value) is not None


def uuid(value):
    return isinstance(value, str) and UUID.fullmatch(value) is not None


def calendar_date(value):
    if not isinstance(value, str) or not re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}", value):
        return False
    try:
        date.fromisoformat(value)
        return True
    except ValueError:
        return False


def integer(value, minimum):
    return type(value) is int and value >= minimum


def diagnostic_shape(item):
    # Optional fields stay optional; unrecognized additional fields are ignored.
    return (isinstance(item, dict) and text(item.get("code"))
            and item.get("severity") in ("error", "warning", "info")
            and ("field" not in item or text(item["field"]))
            and ("sha256" not in item or digest(item["sha256"]))
            and ("route" not in item or item["route"] in ("gov_51178", "prc_4202"))
            and ("record_numbers" not in item or (isinstance(item["record_numbers"], list)
                 and all(integer(number, 1) for number in item["record_numbers"]))))


def review_shape(item):
    return (item is None or (isinstance(item, dict) and uuid(item.get("review_id"))
            and calendar_date(item.get("reviewed_on")) and calendar_date(item.get("next_review_on"))
            and item.get("legal_lot_identity") in tuple(LEGAL_IDENTITIES) and digest(item.get("manifest_sha256"))))


def parse(raw):
    def unique(pairs):
        keys = [key for key, _ in pairs]
        if len(keys) != len(set(keys)):
            raise Malformed("duplicate JSON key")
        return dict(pairs)

    def constant(name):
        raise Malformed(f"non-standard JSON constant {name}")
    try:
        return json.loads(raw.decode("utf-8"), object_pairs_hook=unique, parse_constant=constant)
    except (UnicodeDecodeError, ValueError):
        raise Malformed("input is not UTF-8 JSON")


def blockers(document):
    """Every reason not to publish, from the validate response alone."""
    if not isinstance(document, dict) or document.get("ok") is not True or not isinstance(document.get("data"), dict):
        raise Malformed("not a successful Phase 3K response envelope { ok: true, data }")
    data = document["data"]
    if data.get("schema_version") != VALIDATION_SCHEMA:
        raise Malformed(f"data.schema_version is not {VALIDATION_SCHEMA}")
    valid, diagnostics, routes = data.get("valid"), data.get("diagnostics"), data.get("hazard_routes")
    if (not uuid(data.get("case_id")) or not calendar_date(data.get("as_of"))
            or type(valid) is not bool or type(data.get("expected_revision_current")) is not bool
            or "review" not in data or not review_shape(data["review"])):
        raise Malformed("data lacks the Phase 3K case/date, validation flags or nullable review summary")
    if not isinstance(diagnostics, list) or not all(diagnostic_shape(item) for item in diagnostics):
        raise Malformed("data.diagnostics is not an array of Phase 3K diagnostic objects")
    if not isinstance(routes, list) or len(routes) != len(ROUTES):
        raise Malformed("data.hazard_routes must report both Phase 3K routes")
    found = []
    if valid is not True:
        errors = sorted({str(item.get("code")) for item in diagnostics if isinstance(item, dict) and item.get("severity") == "error"})
        found.append(f"data.valid is false (error diagnostics: {', '.join(errors) or 'none listed'})")
    seen = set()
    for route in routes:
        name = route.get("route") if isinstance(route, dict) else None
        if (not isinstance(name, str) or name not in ROUTES or name in seen
                or not text(route.get("authority_source_id")) or route.get("index") not in ("present", "missing")):
            raise Malformed("a hazard route lacks a unique Phase 3K name, authority_source_id or present/missing index")
        if ("index_sha256" not in route or not (digest(route["index_sha256"])
                or (route["index_sha256"] is None and route["index"] == "missing"))):
            raise Malformed(f"{name}: index_sha256 is missing or inconsistent with its index")
        seen.add(name)
        if "required_records" not in route:
            raise Malformed(f"{name}: required_records is missing")
        records = route["required_records"]
        if records is None:
            found.append(f"{name}: required CAL FIRE records were not reported (index {route['index']}); "
                         "upload the pinned index and validate again")
            continue
        if not isinstance(records, list) or route["index"] == "missing":
            raise Malformed(f"{name}: required_records is not a list consistent with its index")
        missing = []
        for record in records:
            if (not isinstance(record, dict) or not integer(record.get("record_number"), 1)
                    or not digest(record.get("content_sha256")) or not integer(record.get("content_bytes"), 0)
                    or "geometry_state" not in record or record["geometry_state"] not in ("valid", "invalid", "unreadable", None)
                    or type(record.get("present")) is not bool):
                raise Malformed(f"{name}: a required record lacks the Phase 3K number, digest, bytes, geometry_state or boolean present")
            if record["present"] is not True:
                missing.append(record)
        if missing:
            found.append(f"{name}: {len(missing)} of {len(records)} required CAL FIRE records missing:\n"
                         + "\n".join(f"    record {item['record_number']}  record-{item['content_sha256']}.bin" for item in missing))
    return found, {route["route"]: len(route["required_records"] or []) for route in routes}


def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    if len(argv) > 1 or (argv and argv[0].startswith("-") and argv[0] != "-"):
        print("usage: publication-readiness-guard.py [validate-response.json | -]", file=sys.stderr)
        return 2
    try:
        raw = sys.stdin.buffer.read() if not argv or argv[0] == "-" else Path(argv[0]).read_bytes()
        found, counts = blockers(parse(raw))
    except (Malformed, OSError) as error:
        print(f"MALFORMED INPUT: {error}. Refusing (fail closed); do not publish.")
        return 2
    if found:
        print("NOT READY: do not publish.")
        for item in found:
            print(f"- {item}")
        print("Resolve each item (PUT .../calfire/records/<sha256> for a missing record), validate again, "
              "and re-run this guard on the new response.")
        return 1
    print("READY: data.valid is true and every required CAL FIRE record is present ("
          + "; ".join(f"{name}: {count} required" for name, count in counts.items()) + ").")
    return 0


if __name__ == "__main__":
    sys.exit(main())
