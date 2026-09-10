import { StorageDriver } from "./StorageDriver";
import { LocalStorageDriver } from "./LocalStorageDriver";

// Storage driver is selected purely by env var, so switching to an
// s3-compatible implementation later is a config change, not a rewrite.
function buildStorageDriver(): StorageDriver {
  const driver = process.env.STORAGE_DRIVER ?? "local";

  switch (driver) {
    case "local":
      return new LocalStorageDriver(process.env.STORAGE_LOCAL_PATH ?? "./storage");
    default:
      throw new Error(`Unknown STORAGE_DRIVER "${driver}". Only "local" is implemented in Phase 1.`);
  }
}

export const storage = buildStorageDriver();
