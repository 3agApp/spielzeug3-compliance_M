CREATE TABLE `product_risk_assessments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`tenantId` int NOT NULL DEFAULT 1,
	`overallRiskScore` decimal(4,1) NOT NULL,
	`riskLevel` enum('low','medium','high','critical') NOT NULL,
	`risks` json,
	`summary` text,
	`missingInfo` json,
	`modelUsed` varchar(64),
	`tokensUsed` int,
	`status` enum('pending','running','completed','failed') NOT NULL DEFAULT 'pending',
	`errorMessage` text,
	`triggeredByUserId` int,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `product_risk_assessments_id` PRIMARY KEY(`id`)
);
