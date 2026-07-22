import { SKIPPED } from '@datadog/js-core/assembly';
import { EventSource } from '../../event';
import type { FormatHooks } from '../../assembly';
import type { ViewReplayStats } from './ReplayCollection';

/**
 * Registers a RUM hook that injects session replay stats into renderer view
 * events. Assembly triggers this hook like any other context hook, keeping
 * the replay-specific logic out of Assembly itself.
 */
export function registerReplayContext(
  hooks: FormatHooks,
  getViewReplayStats: (viewId: string) => ViewReplayStats | undefined
): void {
  hooks.registerRum(({ source, eventType, rendererViewId }) => {
    if (source !== EventSource.RENDERER || eventType !== 'view' || !rendererViewId) {
      return SKIPPED;
    }

    const stats = getViewReplayStats(rendererViewId);
    if (!stats) {
      // The main process is authoritative for replay: it does the sampling and the upload.
      // The renderer's Browser SDK may still have stamped session.has_replay on the view event
      // (it advertises the 'records' capability), so when we have no segment for this view —
      // session sampled out for replay, or nothing flushed yet — explicitly clear the flag.
      // Otherwise the uploaded RUM view claims a replay exists that Electron never sent.
      return {
        session: { has_replay: false },
      };
    }

    return {
      session: { has_replay: true },
      _dd: {
        replay_stats: {
          segments_count: stats.segments_count,
          segments_total_raw_size: stats.segments_total_raw_size,
        },
      },
    };
  });
}
