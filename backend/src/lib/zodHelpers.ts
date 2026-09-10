import { z } from "zod";

// Frontend forms submit "" for an untouched optional field rather than
// omitting the key entirely — treat blank strings as "not provided" instead
// of failing validation (or persisting empty strings into the database).
const blankToUndefined = (value: unknown) => (value === "" ? undefined : value);

export const optionalString = z.preprocess(blankToUndefined, z.string().optional());
export const optionalEmail = z.preprocess(blankToUndefined, z.string().email().optional());
export const optionalUrl = z.preprocess(blankToUndefined, z.string().url().optional());
