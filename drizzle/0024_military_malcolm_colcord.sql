CREATE TABLE `product_versions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`versionNumber` varchar(64) NOT NULL,
	`label` varchar(255),
	`notes` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `product_versions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `ai_analysis_results` ADD `productVersionId` int;--> statement-breakpoint
ALTER TABLE `documents` ADD `productVersionId` int;