import logging
import os
import threading

from apps.intelligence.models import PlatformSettings
from apps.intelligence.services.line_recommendation_push_service import LineRecommendationPushService
from apps.line_bot.services.store_recommendation_push_service import StoreRecommendationPushService

logger = logging.getLogger(__name__)

_scheduler_lock = threading.Lock()
_scheduler_thread = None
_stop_event = threading.Event()


def _get_interval_seconds():
    raw = os.getenv('RECOMMENDATION_SCHEDULER_INTERVAL_SECONDS', '60')
    try:
        value = int(raw)
    except ValueError:
        value = 60
    return max(10, value)


def _run_scheduler_loop():
    interval_seconds = _get_interval_seconds()
    logger.info('[RecommendationScheduler] started, interval=%ss', interval_seconds)

    while not _stop_event.is_set():
        try:
            settings = PlatformSettings.get_settings()
            if (
                settings.is_line_bot_enabled
                and settings.is_personalized_recommendation_enabled
                and settings.has_line_bot_config()
            ):
                service = LineRecommendationPushService()
                summary = service.run_automated_personalized_recommendation(force=False)
                logger.info(
                    '[RecommendationScheduler] cycle done: recipient=%s success=%s failure=%s skipped=%s',
                    summary.get('recipient_count', 0),
                    summary.get('success_count', 0),
                    summary.get('failure_count', 0),
                    summary.get('skipped_count', 0),
                )

            if settings.is_line_bot_enabled:
                store_service = StoreRecommendationPushService()
                store_summary = store_service.run_auto_cycle(force=False)
                logger.info(
                    '[StoreRecommendationScheduler] cycle done: stores=%s recipient=%s success=%s failure=%s skipped=%s',
                    store_summary.get('stores_count', 0),
                    store_summary.get('recipient_count', 0),
                    store_summary.get('success_count', 0),
                    store_summary.get('failure_count', 0),
                    store_summary.get('skipped_count', 0),
                )
        except Exception as exc:
            logger.warning('[RecommendationScheduler] cycle failed: %s', exc)

        if _stop_event.wait(interval_seconds):
            break

    logger.info('[RecommendationScheduler] stopped')


def start_recommendation_scheduler():
    global _scheduler_thread

    with _scheduler_lock:
        if _scheduler_thread and _scheduler_thread.is_alive():
            return

        _stop_event.clear()
        _scheduler_thread = threading.Thread(
            target=_run_scheduler_loop,
            name='recommendation-scheduler',
            daemon=True,
        )
        _scheduler_thread.start()


def stop_recommendation_scheduler():
    _stop_event.set()
