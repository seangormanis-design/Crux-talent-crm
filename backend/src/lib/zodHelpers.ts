import { z } from "zod";

// Frontend forms submit "" for an untouched optional field rather than
// omitting the key entirely — treat blank strings as "not provided" instead
// of failing validation (or persisting empty strings into the database).
const blankToUndefined = (value: unknown) => (value === "" ? undefined : value);

export const optionalString = z.preprocess(blankToUndefined, z.string().optional());
export const optionalEmail = z.preprocess(blankToUndefined, z.string().email().optional());
export const optionalUrl = z.preprocess(blankToUndefined, z.string().url().optional());

// A blank date field means "clear this date" (persist null), which is a
// different intent from omitting the field entirely (leave unchanged) —
// so blank maps to null here, not undefined.
const blankToNull = (value: unknown) => (value === "" ? null : value);
export const nullableDate = z.preprocess(blankToNull, z.coerce.date().nullable().optional());
