CREATE TABLE `email_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`to` varchar(320) NOT NULL,
	`subject` varchar(500) NOT NULL,
	`htmlBody` text,
	`sentAt` timestamp NOT NULL DEFAULT (now()),
	`sentBy` varchar(255),
	`sentByUserId` int,
	`status` enum('sent','failed') NOT NULL DEFAULT 'sent',
	`errorMessage` text,
	`tenantId` int NOT NULL DEFAULT 1,
	CONSTRAINT `email_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `product_labelling_checks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`product_id` int NOT NULL,
	`tenant_id` varchar(64) NOT NULL DEFAULT '1',
	`check_key` varchar(64) NOT NULL,
	`label` varchar(255) NOT NULL,
	`category` varchar(64) NOT NULL DEFAULT 'general',
	`market` varchar(16) NOT NULL DEFAULT 'EU/CH',
	`is_mandatory` boolean NOT NULL DEFAULT true,
	`checked` boolean NOT NULL DEFAULT false,
	`notes` text,
	`verified_at` bigint,
	`verified_by` varchar(128),
	`created_at` bigint NOT NULL,
	`updated_at` bigint NOT NULL,
	CONSTRAINT `product_labelling_checks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `documents` ADD `include_in_ai_analysis` boolean DEFAULT true NOT NULL;