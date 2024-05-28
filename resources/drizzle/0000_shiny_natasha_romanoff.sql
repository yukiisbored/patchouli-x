CREATE TABLE `documents` (
	`id` text(26) PRIMARY KEY NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`url` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`favicon` text,
	`title` text,
	`description` text,
	`keywords` text DEFAULT '[]',
	`published_at` integer,
	`image` text,
	`content` text,
	`author` text,
	`authorUrl` text
);
