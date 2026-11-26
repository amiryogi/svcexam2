-- Terminal exams may leave out internal (practical) marks; send-up and final exams always include them.
-- Existing exams keep counting internal marks.
ALTER TABLE `exams` ADD COLUMN `include_internal` BOOLEAN NOT NULL DEFAULT true;
