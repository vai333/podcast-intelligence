CREATE TABLE "api_usage" (
	"day" date NOT NULL,
	"key" text NOT NULL,
	"amount" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "api_usage_day_key_pk" PRIMARY KEY("day","key")
);
--> statement-breakpoint
CREATE TABLE "briefs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"week_start" date NOT NULL,
	"week_end" date NOT NULL,
	"payload" jsonb NOT NULL,
	"narrative" text DEFAULT '' NOT NULL,
	"coverage" jsonb NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"email_message_id" text,
	CONSTRAINT "briefs_week_start_unique" UNIQUE("week_start")
);
--> statement-breakpoint
CREATE TABLE "cron_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"outcome" text,
	"summary" jsonb
);
--> statement-breakpoint
CREATE TABLE "episode_guests" (
	"episode_id" uuid NOT NULL,
	"guest_id" uuid NOT NULL,
	"role" text NOT NULL,
	CONSTRAINT "episode_guests_episode_id_guest_id_role_pk" PRIMARY KEY("episode_id","guest_id","role")
);
--> statement-breakpoint
CREATE TABLE "episode_sponsors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"episode_id" uuid NOT NULL,
	"sponsor_id" uuid NOT NULL,
	"product" text,
	"placement" text NOT NULL,
	"evidence" text NOT NULL,
	"timestamp_seconds" integer,
	"source" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "episode_topics" (
	"episode_id" uuid NOT NULL,
	"topic_id" uuid NOT NULL,
	"weight" real DEFAULT 1 NOT NULL,
	CONSTRAINT "episode_topics_episode_id_topic_id_pk" PRIMARY KEY("episode_id","topic_id")
);
--> statement-breakpoint
CREATE TABLE "episodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"show_id" uuid NOT NULL,
	"youtube_video_id" text,
	"spotify_episode_id" text,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"published_at" timestamp with time zone NOT NULL,
	"duration_seconds" integer,
	"youtube_url" text,
	"spotify_url" text,
	"canonical_key" text NOT NULL,
	"analysis_depth" text DEFAULT 'video' NOT NULL,
	"status" text DEFAULT 'discovered' NOT NULL,
	"status_note" text,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "episodes_youtube_video_id_unique" UNIQUE("youtube_video_id"),
	CONSTRAINT "episodes_spotify_episode_id_unique" UNIQUE("spotify_episode_id")
);
--> statement-breakpoint
CREATE TABLE "extractions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"episode_id" uuid NOT NULL,
	"model" text NOT NULL,
	"raw_json" jsonb NOT NULL,
	"confidence" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "extractions_episode_id_unique" UNIQUE("episode_id")
);
--> statement-breakpoint
CREATE TABLE "guest_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guest_id" uuid NOT NULL,
	"alias" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"canonical_name" text NOT NULL,
	"normalized_key" text NOT NULL,
	"title_or_company" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "guests_canonical_name_unique" UNIQUE("canonical_name"),
	CONSTRAINT "guests_normalized_key_unique" UNIQUE("normalized_key")
);
--> statement-breakpoint
CREATE TABLE "ingestion_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"level" text NOT NULL,
	"scope" text NOT NULL,
	"ref_id" text,
	"ref_label" text,
	"message" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"locked_at" timestamp with time zone,
	"run_after" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "login_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key_hash" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "login_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "login_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "search_cache" (
	"key" text PRIMARY KEY NOT NULL,
	"payload" jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"youtube_channel_id" text,
	"youtube_uploads_playlist_id" text,
	"youtube_handle" text,
	"youtube_subscribers" integer,
	"spotify_show_id" text,
	"artwork_url" text,
	"description" text DEFAULT '' NOT NULL,
	"rss_url" text,
	"active_from" timestamp with time zone NOT NULL,
	"active_to" timestamp with time zone,
	"last_seen_published_at" timestamp with time zone,
	"last_discovered_at" timestamp with time zone,
	"last_error" text,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sponsor_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sponsor_id" uuid NOT NULL,
	"alias" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sponsors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"canonical_name" text NOT NULL,
	"normalized_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sponsors_canonical_name_unique" UNIQUE("canonical_name"),
	CONSTRAINT "sponsors_normalized_key_unique" UNIQUE("normalized_key")
);
--> statement-breakpoint
CREATE TABLE "topic_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"topic_id" uuid NOT NULL,
	"alias" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "topics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"canonical_label" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "topics_canonical_label_unique" UNIQUE("canonical_label")
);
--> statement-breakpoint
CREATE TABLE "view_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"episode_id" uuid NOT NULL,
	"views" integer NOT NULL,
	"likes" integer,
	"comments" integer,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "episode_guests" ADD CONSTRAINT "episode_guests_episode_id_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "episode_guests" ADD CONSTRAINT "episode_guests_guest_id_guests_id_fk" FOREIGN KEY ("guest_id") REFERENCES "public"."guests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "episode_sponsors" ADD CONSTRAINT "episode_sponsors_episode_id_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "episode_sponsors" ADD CONSTRAINT "episode_sponsors_sponsor_id_sponsors_id_fk" FOREIGN KEY ("sponsor_id") REFERENCES "public"."sponsors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "episode_topics" ADD CONSTRAINT "episode_topics_episode_id_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "episode_topics" ADD CONSTRAINT "episode_topics_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "episodes" ADD CONSTRAINT "episodes_show_id_shows_id_fk" FOREIGN KEY ("show_id") REFERENCES "public"."shows"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extractions" ADD CONSTRAINT "extractions_episode_id_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_aliases" ADD CONSTRAINT "guest_aliases_guest_id_guests_id_fk" FOREIGN KEY ("guest_id") REFERENCES "public"."guests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsor_aliases" ADD CONSTRAINT "sponsor_aliases_sponsor_id_sponsors_id_fk" FOREIGN KEY ("sponsor_id") REFERENCES "public"."sponsors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_aliases" ADD CONSTRAINT "topic_aliases_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "view_snapshots" ADD CONSTRAINT "view_snapshots_episode_id_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "episode_guests_guest_idx" ON "episode_guests" USING btree ("guest_id");--> statement-breakpoint
CREATE INDEX "episode_sponsors_episode_idx" ON "episode_sponsors" USING btree ("episode_id");--> statement-breakpoint
CREATE INDEX "episode_sponsors_sponsor_idx" ON "episode_sponsors" USING btree ("sponsor_id");--> statement-breakpoint
CREATE INDEX "episode_topics_topic_idx" ON "episode_topics" USING btree ("topic_id");--> statement-breakpoint
CREATE INDEX "episodes_show_published_idx" ON "episodes" USING btree ("show_id","published_at");--> statement-breakpoint
CREATE INDEX "episodes_canonical_idx" ON "episodes" USING btree ("canonical_key");--> statement-breakpoint
CREATE UNIQUE INDEX "guest_aliases_alias_idx" ON "guest_aliases" USING btree ("alias");--> statement-breakpoint
CREATE INDEX "ingestion_log_created_idx" ON "ingestion_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "jobs_status_run_after_idx" ON "jobs" USING btree ("status","run_after");--> statement-breakpoint
CREATE INDEX "login_attempts_key_idx" ON "login_attempts" USING btree ("key_hash","at");--> statement-breakpoint
CREATE INDEX "shows_active_to_idx" ON "shows" USING btree ("active_to");--> statement-breakpoint
CREATE UNIQUE INDEX "sponsor_aliases_alias_idx" ON "sponsor_aliases" USING btree ("alias");--> statement-breakpoint
CREATE UNIQUE INDEX "topic_aliases_alias_idx" ON "topic_aliases" USING btree ("alias");--> statement-breakpoint
CREATE INDEX "view_snapshots_episode_idx" ON "view_snapshots" USING btree ("episode_id","captured_at");