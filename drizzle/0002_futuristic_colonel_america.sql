CREATE TABLE `ai_analysis_results` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`overallScore` decimal(5,2) NOT NULL,
	`documentCompletenessScore` decimal(5,2),
	`contentPlausibilityScore` decimal(5,2),
	`formalCorrectnessScore` decimal(5,2),
	`consistencyScore` decimal(5,2),
	`summary` text,
	`findings` json,
	`recommendations` json,
	`analyzedDocumentIds` json,
	`modelUsed` varchar(64),
	`tokensUsed` int,
	`status` enum('pending','running','completed','failed') NOT NULL DEFAULT 'pending',
	`errorMessage` text,
	`triggeredByUserId` int,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ai_analysis_results_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `system_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`settingKey` varchar(128) NOT NULL,
	`settingValue` text,
	`isEncrypted` boolean NOT NULL DEFAULT false,
	`updatedByUserId` int,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `system_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `system_settings_settingKey_unique` UNIQUE(`settingKey`)
);
