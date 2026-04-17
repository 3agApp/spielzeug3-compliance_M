CREATE TABLE `ai_analysis_translations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`analysis_id` int NOT NULL,
	`target_lang` varchar(8) NOT NULL,
	`translated_data` json NOT NULL,
	`created_at` bigint NOT NULL,
	CONSTRAINT `ai_analysis_translations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `risk_assessment_translations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`assessment_id` int NOT NULL,
	`target_lang` varchar(8) NOT NULL,
	`translated_data` json NOT NULL,
	`created_at` bigint NOT NULL,
	CONSTRAINT `risk_assessment_translations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `products` ADD `versionNumber` varchar(64);--> statement-breakpoint
ALTER TABLE `products` ADD `parentProductId` int;