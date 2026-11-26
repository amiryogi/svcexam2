-- "Conducted in" year becomes optional: when empty it is derived from the academic year.
ALTER TABLE `exams` MODIFY `exam_year_bs` VARCHAR(4) NULL,
    MODIFY `exam_year_ad` VARCHAR(4) NULL;
