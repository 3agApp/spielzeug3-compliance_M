CREATE TABLE `api_sync_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`direction` enum('import','export') NOT NULL,
	`endpoint` varchar(512),
	`relatedEntityType` varchar(64),
	`relatedEntityId` int,
	`status` enum('success','error','pending') NOT NULL DEFAULT 'pending',
	`requestPayload` json,
	`responsePayload` json,
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `api_sync_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `approval_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`action` enum('submitted','approved','rejected','clarification_requested','completed','reopened','updated') NOT NULL,
	`fromStatus` varchar(64),
	`toStatus` varchar(64),
	`performedByUserId` int,
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `approval_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`entityType` varchar(64) NOT NULL,
	`entityId` int,
	`action` varchar(128) NOT NULL,
	`performedByUserId` int,
	`payloadSnapshot` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `batch_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`batchNumber` varchar(128) NOT NULL,
	`goodsReceiptDate` timestamp,
	`recordedByUserId` int,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `batch_records_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `comments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`userId` int NOT NULL,
	`userRole` varchar(64),
	`commentText` text NOT NULL,
	`visibilityInternalOnly` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `comments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`documentType` enum('test_report','declaration_of_conformity','manual','certificate','product_image','safety_image','regulatory_document','other') NOT NULL,
	`fileName` varchar(512) NOT NULL,
	`fileUrl` text NOT NULL,
	`fileKey` varchar(512),
	`mimeType` varchar(128),
	`fileSizeBytes` int,
	`version` int NOT NULL DEFAULT 1,
	`expiryDate` timestamp,
	`uploadedByUserId` int,
	`uploadedByRole` varchar(64),
	`reviewStatus` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`reviewNote` text,
	`reviewedByUserId` int,
	`reviewedAt` timestamp,
	`uploadedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `missing_requirements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`requirementType` enum('test_report','declaration_of_conformity','manual','certificate','product_image','safety_image','regulatory_document','safety_text','warning_text','age_grading','material_information','usage_restrictions','safety_instructions','additional_notes') NOT NULL,
	`required` boolean NOT NULL DEFAULT true,
	`isMissing` boolean NOT NULL DEFAULT true,
	`sourceSystem` varchar(64) DEFAULT 'manual',
	`note` text,
	`status` enum('missing','provided','under_review','approved','rejected') NOT NULL DEFAULT 'missing',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `missing_requirements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`type` enum('open_items','submitted','review_required','clarification_requested','approved','rejected','completed','sync_success','sync_failed') NOT NULL,
	`title` varchar(255) NOT NULL,
	`message` text,
	`relatedProductId` int,
	`isRead` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `product_safety_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`safetyText` text,
	`warningText` text,
	`ageGrading` varchar(64),
	`materialInformation` text,
	`usageRestrictions` text,
	`safetyNotes` text,
	`safetyImages` json,
	`submittedByUserId` int,
	`lastUpdatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `product_safety_entries_id` PRIMARY KEY(`id`),
	CONSTRAINT `product_safety_entries_productId_unique` UNIQUE(`productId`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`internalArticleNumber` varchar(128),
	`supplierArticleNumber` varchar(128),
	`orderNumber` varchar(128),
	`productName` varchar(512) NOT NULL,
	`ean` varchar(32),
	`brand` varchar(128),
	`supplierId` int NOT NULL,
	`imageUrl` text,
	`status` enum('open','in_progress','submitted','under_review','clarification_needed','approved','rejected','completed') NOT NULL DEFAULT 'open',
	`completenessScore` decimal(5,2) DEFAULT '0.00',
	`assignedSupplierUserId` int,
	`assignedInternalUserId` int,
	`submittedAt` timestamp,
	`reviewedAt` timestamp,
	`approvedAt` timestamp,
	`rejectedAt` timestamp,
	`completedAt` timestamp,
	`kontorId` varchar(128),
	`sourceLastSyncAt` timestamp,
	`lastUpdatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `products_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `requirement_types` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(64) NOT NULL,
	`labelDe` varchar(255) NOT NULL,
	`labelEn` varchar(255) NOT NULL,
	`category` enum('document','data') NOT NULL,
	`required` boolean NOT NULL DEFAULT true,
	`active` boolean NOT NULL DEFAULT true,
	`sortOrder` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `requirement_types_id` PRIMARY KEY(`id`),
	CONSTRAINT `requirement_types_key_unique` UNIQUE(`key`)
);
--> statement-breakpoint
CREATE TABLE `suppliers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`supplierCode` varchar(64) NOT NULL,
	`name` varchar(255) NOT NULL,
	`address` text,
	`country` varchar(64),
	`email` varchar(320),
	`phone` varchar(64),
	`active` boolean NOT NULL DEFAULT true,
	`kontorId` varchar(128),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `suppliers_id` PRIMARY KEY(`id`),
	CONSTRAINT `suppliers_supplierCode_unique` UNIQUE(`supplierCode`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `complianceRole` enum('supplier','internal_employee','compliance_manager','administrator') DEFAULT 'internal_employee';--> statement-breakpoint
ALTER TABLE `users` ADD `languagePreference` enum('de','en') DEFAULT 'de' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `supplierId` int;--> statement-breakpoint
ALTER TABLE `users` ADD `active` boolean DEFAULT true NOT NULL;