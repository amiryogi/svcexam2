-- CreateTable
CREATE TABLE `users` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `username` VARCHAR(50) NOT NULL,
    `full_name` VARCHAR(120) NOT NULL,
    `email` VARCHAR(120) NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `role` ENUM('SUPER_ADMIN', 'ADMIN') NOT NULL DEFAULT 'ADMIN',
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `failed_login_count` INTEGER NOT NULL DEFAULT 0,
    `locked_until` DATETIME(3) NULL,
    `last_login_at` DATETIME(3) NULL,
    `password_changed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `totp_secret` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_username_key`(`username`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sessions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `token_hash` CHAR(64) NOT NULL,
    `csrf_token` VARCHAR(64) NOT NULL,
    `ip` VARCHAR(64) NULL,
    `user_agent` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `last_seen_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expires_at` DATETIME(3) NOT NULL,
    `revoked_at` DATETIME(3) NULL,

    UNIQUE INDEX `sessions_token_hash_key`(`token_hash`),
    INDEX `sessions_user_id_idx`(`user_id`),
    INDEX `sessions_expires_at_idx`(`expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NULL,
    `action` VARCHAR(40) NOT NULL,
    `entity` VARCHAR(40) NOT NULL,
    `entity_id` VARCHAR(64) NULL,
    `before` JSON NULL,
    `after` JSON NULL,
    `ip` VARCHAR(64) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_logs_entity_entity_id_idx`(`entity`, `entity_id`),
    INDEX `audit_logs_created_at_idx`(`created_at`),
    INDEX `audit_logs_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `school_settings` (
    `id` INTEGER NOT NULL DEFAULT 1,
    `name` VARCHAR(150) NOT NULL,
    `address` VARCHAR(255) NULL,
    `phone` VARCHAR(50) NULL,
    `email` VARCHAR(120) NULL,
    `website` VARCHAR(120) NULL,
    `neb_school_code` VARCHAR(30) NULL,
    `logo_path` VARCHAR(255) NULL,
    `prepared_by_name` VARCHAR(120) NULL,
    `checked_by_name` VARCHAR(120) NULL,
    `principal_name` VARCHAR(120) NULL,
    `principal_title` VARCHAR(80) NOT NULL DEFAULT 'Principal',
    `gradesheet_note` TEXT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `academic_years` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(20) NOT NULL,
    `start_date_ad` DATE NULL,
    `end_date_ad` DATE NULL,
    `is_current` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `academic_years_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `streams` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(20) NOT NULL,
    `name` VARCHAR(80) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `streams_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `subjects` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `grade` TINYINT NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `short_name` VARCHAR(30) NULL,
    `category` ENUM('COMPULSORY', 'OPTIONAL') NOT NULL,
    `family_code` VARCHAR(20) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `subjects_grade_family_code_key`(`grade`, `family_code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `subject_components` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `subject_id` INTEGER NOT NULL,
    `type` ENUM('TH', 'IN') NOT NULL,
    `neb_code` VARCHAR(10) NOT NULL,
    `credit_hour` DECIMAL(4, 2) NOT NULL,
    `full_mark` DECIMAL(5, 2) NOT NULL,
    `pass_percent` DECIMAL(5, 2) NOT NULL DEFAULT 35,

    UNIQUE INDEX `subject_components_neb_code_key`(`neb_code`),
    UNIQUE INDEX `subject_components_subject_id_type_key`(`subject_id`, `type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `curriculum_groups` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `stream_id` INTEGER NOT NULL,
    `grade` TINYINT NOT NULL,
    `name` VARCHAR(80) NOT NULL,
    `min_select` TINYINT NOT NULL,
    `max_select` TINYINT NOT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `curriculum_groups_stream_id_grade_name_key`(`stream_id`, `grade`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `curriculum_group_subjects` (
    `group_id` INTEGER NOT NULL,
    `subject_id` INTEGER NOT NULL,

    INDEX `curriculum_group_subjects_subject_id_idx`(`subject_id`),
    PRIMARY KEY (`group_id`, `subject_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `students` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `admission_no` VARCHAR(30) NOT NULL,
    `first_name` VARCHAR(60) NOT NULL,
    `middle_name` VARCHAR(60) NULL,
    `last_name` VARCHAR(60) NOT NULL,
    `gender` ENUM('MALE', 'FEMALE', 'OTHER') NOT NULL,
    `dob_ad` DATE NULL,
    `dob_bs` CHAR(10) NULL,
    `neb_registration_no` VARCHAR(20) NULL,
    `guardian_name` VARCHAR(120) NULL,
    `guardian_phone` VARCHAR(30) NULL,
    `phone` VARCHAR(30) NULL,
    `email` VARCHAR(120) NULL,
    `address` VARCHAR(255) NULL,
    `status` ENUM('ACTIVE', 'PASSED_OUT', 'LEFT') NOT NULL DEFAULT 'ACTIVE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `students_admission_no_key`(`admission_no`),
    UNIQUE INDEX `students_neb_registration_no_key`(`neb_registration_no`),
    INDEX `students_first_name_last_name_idx`(`first_name`, `last_name`),
    INDEX `students_deleted_at_idx`(`deleted_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `enrollments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `student_id` INTEGER NOT NULL,
    `academic_year_id` INTEGER NOT NULL,
    `grade` TINYINT NOT NULL,
    `stream_id` INTEGER NOT NULL,
    `section` VARCHAR(10) NOT NULL DEFAULT 'A',
    `roll_no` INTEGER NULL,
    `symbol_no` VARCHAR(20) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `enrollments_academic_year_id_grade_stream_id_section_idx`(`academic_year_id`, `grade`, `stream_id`, `section`),
    UNIQUE INDEX `enrollments_student_id_academic_year_id_key`(`student_id`, `academic_year_id`),
    UNIQUE INDEX `enrollments_academic_year_id_grade_section_roll_no_key`(`academic_year_id`, `grade`, `section`, `roll_no`),
    UNIQUE INDEX `enrollments_academic_year_id_grade_symbol_no_key`(`academic_year_id`, `grade`, `symbol_no`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `enrollment_subjects` (
    `enrollment_id` INTEGER NOT NULL,
    `subject_id` INTEGER NOT NULL,

    INDEX `enrollment_subjects_subject_id_idx`(`subject_id`),
    PRIMARY KEY (`enrollment_id`, `subject_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `grade_scales` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(80) NOT NULL,
    `is_default` BOOLEAN NOT NULL DEFAULT false,
    `withhold_gpa_on_ng` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `grade_scales_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `grade_bands` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `scale_id` INTEGER NOT NULL,
    `min_percent` DECIMAL(5, 2) NOT NULL,
    `letter` VARCHAR(4) NOT NULL,
    `grade_point` DECIMAL(3, 2) NOT NULL,

    INDEX `grade_bands_scale_id_idx`(`scale_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `final_grade_bands` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `scale_id` INTEGER NOT NULL,
    `min_gp` DECIMAL(3, 2) NOT NULL,
    `inclusive` BOOLEAN NOT NULL,
    `letter` VARCHAR(4) NOT NULL,

    INDEX `final_grade_bands_scale_id_idx`(`scale_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `exams` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `academic_year_id` INTEGER NOT NULL,
    `grade` TINYINT NOT NULL,
    `name` VARCHAR(80) NOT NULL,
    `type` ENUM('TERMINAL', 'SENDUP', 'FINAL') NOT NULL,
    `exam_year_bs` VARCHAR(4) NOT NULL,
    `exam_year_ad` VARCHAR(4) NOT NULL,
    `result_date_bs` CHAR(10) NULL,
    `issue_date_bs` CHAR(10) NULL,
    `status` ENUM('DRAFT', 'MARK_ENTRY', 'PUBLISHED', 'LOCKED') NOT NULL DEFAULT 'DRAFT',
    `grade_scale_id` INTEGER NOT NULL,
    `remarks` VARCHAR(500) NULL,
    `published_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `exams_academic_year_id_grade_name_key`(`academic_year_id`, `grade`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `exam_components` (
    `exam_id` INTEGER NOT NULL,
    `subject_component_id` INTEGER NOT NULL,
    `full_mark` DECIMAL(5, 2) NOT NULL,
    `pass_percent` DECIMAL(5, 2) NOT NULL,
    `included` BOOLEAN NOT NULL DEFAULT true,

    PRIMARY KEY (`exam_id`, `subject_component_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `marks` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `exam_id` INTEGER NOT NULL,
    `enrollment_id` INTEGER NOT NULL,
    `subject_component_id` INTEGER NOT NULL,
    `marks` DECIMAL(5, 2) NULL,
    `status` ENUM('PRESENT', 'ABSENT', 'WITHHELD') NOT NULL DEFAULT 'PRESENT',
    `version` INTEGER NOT NULL DEFAULT 1,
    `entered_by_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `marks_exam_id_subject_component_id_idx`(`exam_id`, `subject_component_id`),
    INDEX `marks_enrollment_id_idx`(`enrollment_id`),
    UNIQUE INDEX `marks_exam_id_enrollment_id_subject_component_id_key`(`exam_id`, `enrollment_id`, `subject_component_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `result_snapshots` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `exam_id` INTEGER NOT NULL,
    `enrollment_id` INTEGER NOT NULL,
    `payload` JSON NOT NULL,
    `gpa` DECIMAL(3, 2) NULL,
    `outcome` VARCHAR(12) NOT NULL,
    `published_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `result_snapshots_exam_id_enrollment_id_key`(`exam_id`, `enrollment_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subject_components` ADD CONSTRAINT `subject_components_subject_id_fkey` FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `curriculum_groups` ADD CONSTRAINT `curriculum_groups_stream_id_fkey` FOREIGN KEY (`stream_id`) REFERENCES `streams`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `curriculum_group_subjects` ADD CONSTRAINT `curriculum_group_subjects_group_id_fkey` FOREIGN KEY (`group_id`) REFERENCES `curriculum_groups`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `curriculum_group_subjects` ADD CONSTRAINT `curriculum_group_subjects_subject_id_fkey` FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `enrollments` ADD CONSTRAINT `enrollments_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `enrollments` ADD CONSTRAINT `enrollments_academic_year_id_fkey` FOREIGN KEY (`academic_year_id`) REFERENCES `academic_years`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `enrollments` ADD CONSTRAINT `enrollments_stream_id_fkey` FOREIGN KEY (`stream_id`) REFERENCES `streams`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `enrollment_subjects` ADD CONSTRAINT `enrollment_subjects_enrollment_id_fkey` FOREIGN KEY (`enrollment_id`) REFERENCES `enrollments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `enrollment_subjects` ADD CONSTRAINT `enrollment_subjects_subject_id_fkey` FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `grade_bands` ADD CONSTRAINT `grade_bands_scale_id_fkey` FOREIGN KEY (`scale_id`) REFERENCES `grade_scales`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `final_grade_bands` ADD CONSTRAINT `final_grade_bands_scale_id_fkey` FOREIGN KEY (`scale_id`) REFERENCES `grade_scales`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exams` ADD CONSTRAINT `exams_academic_year_id_fkey` FOREIGN KEY (`academic_year_id`) REFERENCES `academic_years`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exams` ADD CONSTRAINT `exams_grade_scale_id_fkey` FOREIGN KEY (`grade_scale_id`) REFERENCES `grade_scales`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exam_components` ADD CONSTRAINT `exam_components_exam_id_fkey` FOREIGN KEY (`exam_id`) REFERENCES `exams`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exam_components` ADD CONSTRAINT `exam_components_subject_component_id_fkey` FOREIGN KEY (`subject_component_id`) REFERENCES `subject_components`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `marks` ADD CONSTRAINT `marks_exam_id_fkey` FOREIGN KEY (`exam_id`) REFERENCES `exams`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `marks` ADD CONSTRAINT `marks_enrollment_id_fkey` FOREIGN KEY (`enrollment_id`) REFERENCES `enrollments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `marks` ADD CONSTRAINT `marks_subject_component_id_fkey` FOREIGN KEY (`subject_component_id`) REFERENCES `subject_components`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `marks` ADD CONSTRAINT `marks_entered_by_id_fkey` FOREIGN KEY (`entered_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `result_snapshots` ADD CONSTRAINT `result_snapshots_exam_id_fkey` FOREIGN KEY (`exam_id`) REFERENCES `exams`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `result_snapshots` ADD CONSTRAINT `result_snapshots_enrollment_id_fkey` FOREIGN KEY (`enrollment_id`) REFERENCES `enrollments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

