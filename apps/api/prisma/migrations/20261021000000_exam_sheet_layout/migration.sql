-- Terminal exams can print A5 result sheets (grades only or marks only) instead of the official
-- A4 grade sheet. Existing exams keep the official sheet.
ALTER TABLE `exams` ADD COLUMN `sheet_layout` ENUM('OFFICIAL', 'A5_GRADES', 'A5_MARKS') NOT NULL DEFAULT 'OFFICIAL';
