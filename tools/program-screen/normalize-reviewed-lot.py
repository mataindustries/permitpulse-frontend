#!/usr/bin/env python3
"""Offline ingestion only. No downloads, CRS selection, or fallback operations."""
import argparse
import ctypes as C
from datetime import datetime, timezone
import hashlib
import json
import math
import os
from pathlib import Path
import platform
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[2]
PROFILE = ROOT / "app/src/shared/program-screen/normalization-profile.json"
PIPELINE = Path(__file__).parent / "proj/approved-pipeline.proj"


def sha(data):
    return hashlib.sha256(data).hexdigest()


def verified_file(path, expected):
    data = Path(path).read_bytes()
    if sha(data) != expected:
        raise ValueError(f"SHA-256 mismatch: {Path(path).name}")
    return data


def captured_crs(source, metadata):
    """Read captured CRS declarations; never supply a default CRS."""
    declarations = [metadata.get("extent", {}).get("spatialReference")]
    feature = source["features"][0]
    declarations += [source.get("spatialReference"), feature["geometry"].get("spatialReference")]
    stated = []
    for declaration in declarations:
        if declaration is None:
            continue
        wkid, latest = declaration.get("wkid"), declaration.get("latestWkid")
        if type(wkid) is not int or (latest is not None and type(latest) is not int):
            raise ValueError("Unreadable captured CRS")
        if wkid == 3857 and latest in (None, 3857):
            stated.append({"wkid": wkid, "latest_wkid": latest, "epsg": 3857})
        elif wkid in (102100, 102113) and latest == 3857:
            stated.append({"wkid": wkid, "latest_wkid": latest, "epsg": 3857})
        else:
            raise ValueError("Captured CRS is not the approved EPSG:3857 source")
    if not declarations[0] or not stated:
        raise ValueError("Captured layer metadata must state its CRS")
    return stated[0]


def source_rings(source, metadata, args):
    features = source.get("features")
    if not isinstance(features, list) or len(features) != 1:
        raise ValueError("The preserved response must contain exactly one selected feature")
    if metadata.get("geometryType") != "esriGeometryPolygon":
        raise ValueError("Captured metadata does not identify a polygon layer")
    feature = features[0]
    attributes = feature.get("attributes", {})
    if str(attributes.get(args.apn_field)) != args.apn or attributes.get(args.pin_field) != args.pin_value:
        raise ValueError("Captured APN/PIN do not match the explicit identifiers")
    geometry = feature.get("geometry", {})
    if "curveRings" in geometry or geometry.get("hasZ") or geometry.get("hasM"):
        raise ValueError("Only captured linear 2D rings are supported")
    rings = geometry.get("rings")
    if not isinstance(rings, list) or not 1 <= len(rings) <= 50:
        raise ValueError("Missing or excessive rings")
    if sum(len(ring) for ring in rings) > 2000:
        raise ValueError("More than 2000 positions")
    for ring in rings:
        if len(ring) < 4 or ring[0] != ring[-1]:
            raise ValueError("A ring is short or unclosed")
        for position in ring:
            if len(position) != 2 or any(type(v) not in (int, float) or not math.isfinite(v) for v in position):
                raise ValueError("Positions must be finite 2D numbers")
    return rings


def operation_area_check(rings, bbox):
    # Inverse Web Mercator for the approved source's area check only.
    west, south, east, north = bbox
    for ring in rings:
        for x, y in ring:
            lon = math.degrees(x / 6378137)
            lat = math.degrees(math.atan(math.sinh(y / 6378137)))
            if not west <= lon <= east or not south <= lat <= north:
                raise ValueError("Source geometry is outside the selected operation's area of use")


class Coordinate(C.Union):
    _fields_ = [("v", C.c_double * 4)]


class Info(C.Structure):
    _fields_ = [("major", C.c_int), ("minor", C.c_int), ("patch", C.c_int),
                ("release", C.c_char_p), ("version", C.c_char_p), ("searchpath", C.c_char_p),
                ("paths", C.POINTER(C.c_char_p)), ("path_count", C.c_size_t)]


def normalize(rings, profile, pipeline, paths):
    for key in tuple(os.environ):
        if key.startswith("PROJ_"):
            del os.environ[key]
    data = paths["proj_db"].parent
    # Make even a native current-directory lookup resolve inside the pinned data path.
    os.chdir(data)
    os.environ.update(PROJ_NETWORK="OFF", PROJ_DATA=str(data),
                      PROJ_SKIP_READ_USER_WRITABLE_DIRECTORY="YES", PROJ_ONLY_BEST_DEFAULT="ON")
    # Preload the exact pinned TIFF library, so its SONAME cannot resolve to a different installation.
    C.CDLL(str(paths["libtiff"]), mode=C.RTLD_GLOBAL)
    lib = C.CDLL(str(paths["libproj"]))

    def bind(name, result, arguments):
        fn = getattr(lib, name)
        fn.restype, fn.argtypes = result, arguments
        return fn

    ptr, text = C.c_void_p, C.c_char_p
    info = bind("proj_info", Info, [])()
    if info.version.decode() != profile["implementation"]["version"]:
        raise ValueError("Unexpected PROJ version")
    ctx = bind("proj_context_create", ptr, [])()
    close_ctx = bind("proj_context_destroy", None, [ptr])
    destroy = bind("proj_destroy", ptr, [ptr])
    operation = None
    try:
        bind("proj_context_set_search_paths", None, [ptr, C.c_int, C.POINTER(text)])(ctx, 1, (text * 1)(str(data).encode()))
        if not bind("proj_context_set_database_path", C.c_int, [ptr, text, C.POINTER(text), C.POINTER(text)])(ctx, str(paths["proj_db"]).encode(), None, None):
            raise ValueError("Pinned database cannot be opened")
        bind("proj_context_set_enable_network", C.c_int, [ptr, C.c_int])(ctx, 0)
        if bind("proj_context_is_network_enabled", C.c_int, [ptr])(ctx):
            raise ValueError("PROJ networking must be disabled")
        # Explicit operation only. Never call proj_create_crs_to_crs or an operation selector here.
        operation = bind("proj_create", ptr, [ptr, text])(ctx, pipeline)
        if not operation:
            raise ValueError("The approved pipeline is unavailable; no fallback is allowed")
        transform = bind("proj_trans", Coordinate, [ptr, C.c_int, Coordinate])
        error = bind("proj_errno", C.c_int, [ptr])
        output = []
        for ring in rings:
            transformed = []
            for x, y in ring:
                coordinate = Coordinate()
                coordinate.v[:] = (x, y, 0, 0)
                result = transform(operation, 1, coordinate)  # PJ_FWD
                if error(operation) or not all(math.isfinite(v) for v in result.v[:2]):
                    raise ValueError("Approved transformation failed; no fallback is allowed")
                transformed.append(list(result.v[:2]))
            output.append(transformed)
        return output
    finally:
        if operation:
            destroy(operation)
        close_ctx(ctx)


def atomic_write(path, data):
    with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as temporary:
        temporary.write(data)
        name = temporary.name
    os.replace(name, path)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ("source", "source-sha256", "metadata", "metadata-sha256", "apn", "pin-value", "output-dir", "proj-prefix", "tiff-prefix"):
        parser.add_argument("--" + name, required=True)
    parser.add_argument("--apn-field", default="APN")
    parser.add_argument("--pin-field", default="PIN")
    args = parser.parse_args()
    directory = Path(args.output_dir).resolve()
    # Verify source bytes FIRST, before parsing any geometry or loading PROJ.
    source_bytes = verified_file(args.source, args.source_sha256)
    metadata_bytes = verified_file(args.metadata, args.metadata_sha256)
    profile_bytes = PROFILE.read_bytes()
    profile = json.loads(profile_bytes)
    implementation = profile["implementation"]
    if platform.python_version() != implementation["python_version"] or sys.platform != "linux" or platform.machine() != "x86_64":
        raise ValueError("The pinned Python/platform implementation is required")
    if sha(Path(__file__).read_bytes()) != implementation["normalizer_sha256"]:
        raise ValueError("The normalizer implementation does not match its pin")
    pipeline = verified_file(PIPELINE, profile["operation"]["pipeline_sha256"])
    bases = {"proj": Path(args.proj_prefix), "tiff": Path(args.tiff_prefix), "system": Path("/")}
    paths = {}
    for resource in profile["resources"]:
        path = (bases[resource["base"]] / resource["path"]).resolve()
        data = verified_file(path, resource["sha256"])
        if len(data) != resource["bytes"]:
            raise ValueError("Pinned resource length mismatch")
        paths[resource["id"]] = path
    # The data directory may not contain any other grid or auxiliary database.
    expected = {"proj.db", "us_noaa_cshpgn.tif"}
    for path in paths["proj_db"].parent.iterdir():
        if path.suffix.lower() in (".tif", ".tiff", ".gsb", ".gtx", ".las", ".los", ".db") and path.name not in expected:
            raise ValueError("An unpinned grid/database is present")
    source, metadata = json.loads(source_bytes), json.loads(metadata_bytes)
    if source.get("TEST_ONLY") is not True and directory.is_relative_to(ROOT) and not directory.is_relative_to(ROOT / ".private"):
        raise ValueError("Real case normalization outputs must stay outside the public repository or under .private")
    rings = source_rings(source, metadata, args)
    crs = captured_crs(source, metadata)
    operation_area_check(rings, profile["operation"]["bbox"])
    output = {"schema_version": "program-screen-lot-geometry-v1", "crs": "EPSG:3310", "type": "Polygon",
              "coordinates": normalize(rings, profile, pipeline, paths)}
    normalized = (json.dumps(output, ensure_ascii=False, allow_nan=False, separators=(",", ":")) + "\n").encode()
    receipt = {"schema_version": "program-screen-normalization-receipt-v1", "profile_id": profile["profile_id"],
               "profile_sha256": sha(profile_bytes), "implementation": implementation,
               "source": {"sha256": sha(source_bytes), "metadata_sha256": sha(metadata_bytes), "crs": crs},
               "target": {"crs_epsg": 3310, "sha256": sha(normalized), "bytes": len(normalized), "serialization": profile["serialization"]},
               "operation": profile["operation"], "resources": profile["resources"], "network_enabled": False,
               "normalized_at_utc": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")}
    directory.mkdir(parents=True, exist_ok=True)
    atomic_write(directory / "normalized.json", normalized)
    atomic_write(directory / "normalization-receipt.json", (json.dumps(receipt, indent=2) + "\n").encode())
    print(json.dumps({"normalized_bytes": len(normalized), "normalized_sha256": sha(normalized), "profile_sha256": sha(profile_bytes)}))


if __name__ == "__main__":
    try:
        main()
    except (ValueError, KeyError, TypeError, OSError) as error:
        sys.exit(f"Normalization refused: {error}")
