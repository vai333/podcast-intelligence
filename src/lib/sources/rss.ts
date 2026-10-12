// RESERVED EXTENSION POINT (spec section 12). Not implemented and not used in v1.
//
// The idea: for shows that have `shows.rss_url`, a future version can fetch the RSS feed and compare
// the audio enclosure with the public stream to detect dynamically inserted ads. That needs audio
// download and transcription, which are out of scope for v1 (see README "Known limitations").
//
// Keep this file as the single place to add it. Do not add Apple Podcasts or Podcast Index code.

export interface RssEpisode {
  guid: string;
  title: string;
  publishedAt: Date;
  enclosureUrl: string;
  durationSeconds: number | null;
}

export interface RssSource {
  /** Fetch the feed and return its episodes. Not implemented in v1. */
  fetchEpisodes(rssUrl: string): Promise<RssEpisode[]>;
}

export const rssSource: RssSource | null = null;
