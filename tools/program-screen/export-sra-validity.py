#!/usr/bin/python3
"""Offline SRA topology inventory, bound to the original shapefile bytes.

GDAL/GEOS only determines validity. No repair, reprojection, linearization,
buffering, snapping, simplification or source rewrite is performed. The full
manifest is deterministic, contains every feature, and is pinned separately
from the original capture. Runtime needs neither Python nor GDAL/GEOS.
"""
import argparse
import hashlib
import json
import struct
import zipfile
from collections import Counter
from pathlib import Path
from osgeo import gdal, ogr

ARCHIVE_SHA = "e744eb8eb7895157f4025109f29ff5312180a52fdb4648ff9fe9328edf4db3b2"
EXTRACTED_SHA = "a85ff7eecf0f8ffa80d7dd8dcdc727a9dde42979fb3b7b8d5614b7a47a6b5a8a"
LAYER = "FHSZSRA_23_3"


def export(archive, output):
    gdal.UseExceptions()
    if gdal.VersionInfo() != "3100300" or (ogr.GetGEOSVersionMajor(), ogr.GetGEOSVersionMinor(), ogr.GetGEOSVersionMicro()) != (3, 13, 1):
        raise ValueError("Requires pinned GDAL 3.10.3 / GEOS 3.13.1")
    archive = Path(archive).resolve()
    if hashlib.sha256(archive.read_bytes()).hexdigest() != ARCHIVE_SHA:
        raise ValueError("Official SRA archive SHA-256 differs")
    with zipfile.ZipFile(archive) as z:
        if z.testzip() is not None:
            raise ValueError("SRA archive CRC mismatch")
        members = {suffix: z.read(LAYER + "." + suffix) for suffix in ("shp", "shx", "dbf", "prj")}
    shp, shx = members["shp"], members["shx"]
    records = []
    for at in range(100, len(shx), 8):
        offset, length = (n * 2 for n in struct.unpack_from(">ii", shx, at))
        number, words = struct.unpack_from(">ii", shp, offset)
        if number != len(records) + 1 or words * 2 != length or offset + 8 + length > len(shp):
            raise ValueError("Original shapefile record/index association differs")
        records.append(shp[offset + 8:offset + 8 + length])
    ds = gdal.OpenEx(f"/vsizip/{archive}/{LAYER}.shp", gdal.OF_VECTOR, allowed_drivers=["ESRI Shapefile"])
    layer = ds.GetLayer(0)
    if layer.GetName() != LAYER or layer.GetFeatureCount() != len(records) or len(records) != 18423 or layer.GetSpatialRef().GetAuthorityCode(None) != "3310":
        raise ValueError("SRA layer/count/CRS differs")
    features, totals, classes, invalid_classes = [], Counter(), Counter(), Counter()
    for i, feature in enumerate(layer):
        if feature.GetFID() != i:
            raise ValueError("GDAL FID is not associated with its original shapefile record")
        label = feature.GetField("FHSZ_Descr")
        if label not in ("Very High", "High", "Moderate"):
            raise ValueError("Unexpected SRA semantic class")
        geometry = feature.GetGeometryRef()
        messages = []
        gdal.PushErrorHandler(lambda _kind, _number, message: messages.append(message))
        try:
            if geometry is None or geometry.IsEmpty():
                state, diagnostic = "unreadable", "Missing or empty source geometry"
            else:
                before = bytes(geometry.ExportToIsoWkb(ogr.wkbNDR))
                state = "valid" if geometry.IsValid() else "invalid"
                if before != bytes(geometry.ExportToIsoWkb(ogr.wkbNDR)):
                    raise ValueError("Validity determination altered decoded geometry")
                diagnostic = "; ".join(messages) if state == "invalid" and messages else None
        finally:
            gdal.PopErrorHandler()
        totals[state] += 1
        classes[label] += 1
        if state == "invalid":
            invalid_classes[label] += 1
        features.append({"record_number": i + 1, "fid": i, "label": label,
                         "geometry_sha256": hashlib.sha256(records[i]).hexdigest(),
                         "state": state, "diagnostic": diagnostic})
    counts = {"features": len(features), "states": dict(sorted(totals.items())),
              "classes": dict(sorted(classes.items())), "invalid_classes": dict(sorted(invalid_classes.items()))}
    if counts != {"features": 18423, "states": {"invalid": 233, "valid": 18190},
                  "classes": {"High": 5824, "Moderate": 4188, "Very High": 8411},
                  "invalid_classes": {"High": 70, "Moderate": 24, "Very High": 139}}:
        raise ValueError(f"SRA validity inventory differs; stop for review: {counts}")
    manifest = {
        "schema_version": "program-screen-sra-validity-v1",
        "tool": {"name": "GDAL/OGR IsValid (GEOS)", "gdal_version": "3.10.3", "geos_version": "3.13.1", "exporter_version": "1.0.0"},
        "source": {"source_id": "calfire-fhszsra-23-3-data", "archive_sha256": ARCHIVE_SHA,
                   "sha256_extracted": EXTRACTED_SHA, "layer": LAYER, "crs_epsg": 3310, "class_field": "FHSZ_Descr",
                   "members": {k: hashlib.sha256(v).hexdigest() for k, v in members.items()}},
        "counts": counts,
        "features": features,
    }
    content = (json.dumps(manifest, separators=(",", ":"), allow_nan=False) + "\n").encode()
    Path(output).write_bytes(content)
    print(json.dumps({"counts": counts, "manifest_sha256": hashlib.sha256(content).hexdigest()}, sort_keys=True))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive")
    parser.add_argument("output")
    args = parser.parse_args()
    export(args.archive, args.output)
