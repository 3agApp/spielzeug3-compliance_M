CREATE TABLE `tenants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(64) NOT NULL,
	`name` varchar(255) NOT NULL,
	`plan` enum('starter','professional','enterprise') NOT NULL DEFAULT 'starter',
	`modulesEnabled` json NOT NULL DEFAULT ('["compliance"]'),
	`isActive` boolean NOT NULL DEFAULT true,
	`logoUrl` text,
	`primaryColor` varchar(7) DEFAULT '#C8102E',
	`contactEmail` varchar(320),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tenants_id` PRIMARY KEY(`id`),
	CONSTRAINT `tenants_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `complianceRole` enum('supplier','internal_employee','compliance_manager','administrator','super_admin') DEFAULT 'internal_employee';--> statement-breakpoint
ALTER TABLE `products` ADD `tenantId` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `publicUuid` varchar(36);--> statement-breakpoint
ALTER TABLE `products` ADD `qrCodeUrl` text;--> statement-breakpoint
ALTER TABLE `products` ADD `qrCodeSvgUrl` text;--> statement-breakpoint
ALTER TABLE `products` ADD `sealEnabledAt` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `tenantId` int DEFAULT 1;--> statement-breakpoint
ALTER TABLE `products` ADD CONSTRAINT `products_publicUuid_unique` UNIQUE(`publicUuid`);