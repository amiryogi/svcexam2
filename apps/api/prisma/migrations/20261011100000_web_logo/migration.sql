-- Separate colour logo for the website; the existing logo stays the black & white grade sheet logo.
ALTER TABLE `school_settings` ADD COLUMN `web_logo_path` VARCHAR(255) NULL;
