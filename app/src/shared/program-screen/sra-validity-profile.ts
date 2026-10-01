/** Mechanical SRA topology pins, derived offline; no authority or review record. */
export const sraValidityProfile = {
  "schema_version": "program-screen-sra-validity-profile-v1",
  "index_version": "1.1.0",
  "index_sha256": "224fafb7015bca3e93704e88ca212510f9f099bb50538bc211cc7494cfef7ada",
  "tool": {
    "name": "GDAL/OGR IsValid (GEOS)",
    "gdal_version": "3.10.3",
    "geos_version": "3.13.1",
    "exporter_version": "1.0.0"
  },
  "archive_sha256": "e744eb8eb7895157f4025109f29ff5312180a52fdb4648ff9fe9328edf4db3b2",
  "validity_manifest_sha256": "e9dbf7df79f10bbe632bf57cd6ea727821ac993cad217efeea298d3bfcbb4b3c",
  "counts": {
    "features": 18423,
    "states": { "invalid": 233, "valid": 18190 },
    "classes": { "High": 5824, "Moderate": 4188, "Very High": 8411 },
    "invalid_classes": { "High": 70, "Moderate": 24, "Very High": 139 }
  }
} as const;
