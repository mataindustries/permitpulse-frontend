#!/usr/bin/python3
"""Offline, pinned native FileGDB decode. Never reproject, round, or repair.

Output is an intermediate NDJSON stream. The TypeScript index builder checks
every native attribute/FID and canonicalizes round-trippable doubles; it pins
the final record bytes and validity state. No runtime GDAL dependency.
"""
import argparse
import hashlib
import json
import re
from pathlib import Path
import zipfile
from osgeo import gdal, ogr

ARCHIVE_SHA = "736fa5231c70b844550784cd13c8d414c239cf9573c9cae6139554ef0bf464b6"
METADATA_SHA = "1bbf01d7df12ebaf60376c95a23305dcfc63d81d49e3661ac4395c17591bfbbb"
LAYER = "FHSALRA25_v1_All"


def export(archive, output):
    gdal.UseExceptions()
    if gdal.VersionInfo() != "3100300" or (ogr.GetGEOSVersionMajor(), ogr.GetGEOSVersionMinor(), ogr.GetGEOSVersionMicro()) != (3, 13, 1):
        raise ValueError("Requires reviewed GDAL 3.10.3 / GEOS 3.13.1")
    archive = Path(archive).resolve()
    if hashlib.sha256(archive.read_bytes()).hexdigest() != ARCHIVE_SHA:
        raise ValueError("Official archive SHA-256 differs")
    with zipfile.ZipFile(archive) as z:
        if z.testzip() is not None:
            raise ValueError("Archive CRC mismatch")
    ds = gdal.OpenEx(f"/vsizip/{archive}/FHSZLRA25_1_All.gdb", gdal.OF_VECTOR, open_options=["LIST_ALL_TABLES=YES"])
    items = ds.GetLayerByName("GDB_Items")
    selected = [f for f in items if f.GetField("Name") == LAYER]
    if len(selected) != 1 or selected[0].GetFID() != 3:
        raise ValueError("Active metadata-to-layer association differs")
    xml = re.search(rb"<metadata\b.*?</metadata>", selected[0].GetField("Documentation").encode("utf-8"), re.S).group(0)
    if hashlib.sha256(xml).hexdigest() != METADATA_SHA:
        raise ValueError("Active metadata XML differs")
    layer = ds.GetLayerByName(LAYER)
    if layer.GetFeatureCount() != 9752 or layer.GetSpatialRef().GetAuthorityCode(None) != "3310":
        raise ValueError("Layer count/CRS differs")
    gdal.PushErrorHandler("CPLQuietErrorHandler")
    counts = {}
    with open(output, "w", encoding="utf-8", newline="\n") as stream:
        for f in layer:
            geometry = f.GetGeometryRef()
            validity = "unreadable" if geometry is None or geometry.IsEmpty() else "valid" if geometry.IsValid() else "invalid"
            linear = geometry is not None and geometry.GetGeometryType() in (ogr.wkbMultiPolygon, ogr.wkbPolygon)
            state = "unreadable" if validity == "unreadable" or (validity == "valid" and not linear) else validity
            coordinates = []
            extent = None
            if geometry is not None and not geometry.IsEmpty():
                if geometry.GetCoordinateDimension() != 2:
                    raise ValueError("Unexpected source dimensionality")
                envelope = geometry.GetEnvelope()
                extent = [envelope[0], envelope[2], envelope[1], envelope[3]]
                if linear:
                    for polygon in ([geometry] if geometry.GetGeometryType() == ogr.wkbPolygon else geometry):
                        coordinates.append([[[ring.GetX(i), ring.GetY(i)] for i in range(ring.GetPointCount())] for ring in polygon])
            label = f.GetField("FHSZ_Description")
            row = {"fid": f.GetFID(), "label": label, "code": f.GetField("FHSZ"), "area": f.GetField("SRA"), "state": state, "source_validity": validity, "native_wkb": None if linear or geometry is None else bytes(geometry.ExportToIsoWkb(ogr.wkbNDR)).hex(), "extent": extent, "coordinates": coordinates}
            stream.write(json.dumps(row, separators=(",", ":"), allow_nan=False) + "\n")
            if validity != "valid":
                counts[label] = counts.get(label, 0) + 1
    gdal.PopErrorHandler()
    if counts != {"Very High": 11, "High": 20, "Moderate": 70, "NonWildland": 18}:
        raise ValueError(f"Validity inventory differs: {counts}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("archive")
    parser.add_argument("output")
    args = parser.parse_args()
    export(args.archive, args.output)
