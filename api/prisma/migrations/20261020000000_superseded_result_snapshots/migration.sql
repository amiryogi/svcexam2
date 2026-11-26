-- Unpublishing an exam used to delete its result snapshots, losing what was on grade sheets already
-- handed out. They are now moved here first, so every issued version stays on record.
CREATE TABLE `superseded_result_snapshots` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `exam_id` INTEGER NOT NULL,
    `enrollment_id` INTEGER NOT NULL,
    `payload` JSON NOT NULL,
    `gpa` DECIMAL(3, 2) NULL,
    `outcome` VARCHAR(12) NOT NULL,
    `published_at` DATETIME(3) NOT NULL,
    `superseded_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `reason` VARCHAR(500) NULL,

    INDEX `superseded_result_snapshots_exam_id_enrollment_id_idx`(`exam_id`, `enrollment_id`),
    INDEX `superseded_result_snapshots_enrollment_id_idx`(`enrollment_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `superseded_result_snapshots` ADD CONSTRAINT `superseded_result_snapshots_exam_id_fkey` FOREIGN KEY (`exam_id`) REFERENCES `exams`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `superseded_result_snapshots` ADD CONSTRAINT `superseded_result_snapshots_enrollment_id_fkey` FOREIGN KEY (`enrollment_id`) REFERENCES `enrollments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
