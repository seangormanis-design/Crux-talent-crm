-- Enforce at most one incoming link per person: a person can only ever
-- be pointed at (linkedPersonId) by one other record at a time.
CREATE UNIQUE INDEX "people_linkedPersonId_key" ON "people"("linkedPersonId");
