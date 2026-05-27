CREATE TABLE `supplier_check_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`checkId` int NOT NULL,
	`supplierId` int NOT NULL,
	`regulationCode` varchar(64) NOT NULL,
	`regulationName` varchar(255) NOT NULL,
	`jurisdiction` enum('eu','de','ch','international') NOT NULL,
	`status` enum('fulfilled','partially_fulfilled','not_fulfilled','not_applicable','unclear') NOT NULL,
	`criticality` enum('critical','high','medium','low','info') NOT NULL,
	`finding` text NOT NULL,
	`evidence` text,
	`recommendation` text,
	`legalRisk` text,
	`chRisk` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `supplier_check_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `supplier_website_checks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`supplierId` int NOT NULL,
	`websiteUrl` varchar(512) NOT NULL,
	`status` enum('pending','running','completed','failed') NOT NULL DEFAULT 'pending',
	`scrapedSummary` text,
	`overallScore` int,
	`euScore` int,
	`deScore` int,
	`chScore` int,
	`analysisResult` json,
	`triggeredByUserId` int,
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `supplier_website_checks_id` PRIMARY KEY(`id`)
);
