import logging
import time

from django.conf import settings
from django.db import connections


class QueryDebugMiddleware:
    """Development-only SQL observer: adds query metrics headers and logs slow SQL."""

    def __init__(self, get_response):
        self.get_response = get_response
        self.logger = logging.getLogger('performance.sql')

    def __call__(self, request):
        if not getattr(settings, 'ENABLE_QUERY_DEBUG', False):
            return self.get_response(request)

        connection = connections['default']
        slow_threshold_ms = float(getattr(settings, 'SQL_SLOW_QUERY_THRESHOLD_MS', 120))
        log_slow_sql_text = bool(getattr(settings, 'LOG_SLOW_SQL_TEXT', True))
        max_logged_slow = int(getattr(settings, 'MAX_LOGGED_SLOW_QUERIES', 8))

        previous_force_debug = connection.force_debug_cursor
        connection.force_debug_cursor = True

        start_index = len(connection.queries)
        request_started_at = time.perf_counter()
        response = None

        try:
            response = self.get_response(request)
            return response
        finally:
            request_elapsed_ms = (time.perf_counter() - request_started_at) * 1000
            captured_queries = connection.queries[start_index:]
            connection.force_debug_cursor = previous_force_debug

            query_count = len(captured_queries)
            sql_time_ms = 0.0
            slow_queries = []

            for query in captured_queries:
                try:
                    elapsed_ms = float(query.get('time', 0)) * 1000
                except (TypeError, ValueError):
                    elapsed_ms = 0.0

                sql_time_ms += elapsed_ms
                if elapsed_ms >= slow_threshold_ms:
                    slow_queries.append((elapsed_ms, query.get('sql', '')))

            slow_query_count = len(slow_queries)

            if response is not None:
                response['X-Query-Count'] = str(query_count)
                response['X-Query-Time-Ms'] = f'{sql_time_ms:.2f}'
                response['X-Slow-Query-Count'] = str(slow_query_count)
                response['X-Request-Time-Ms'] = f'{request_elapsed_ms:.2f}'

            self.logger.info(
                '%s %s -> %s | queries=%s sql_time=%.2fms request_time=%.2fms slow=%s',
                request.method,
                request.get_full_path(),
                getattr(response, 'status_code', 'NA'),
                query_count,
                sql_time_ms,
                request_elapsed_ms,
                slow_query_count,
            )

            if slow_query_count:
                sorted_slow = sorted(slow_queries, key=lambda row: row[0], reverse=True)
                for index, (elapsed_ms, sql) in enumerate(sorted_slow[:max_logged_slow], start=1):
                    if log_slow_sql_text:
                        sql_compact = ' '.join(str(sql).split())
                        sql_preview = (sql_compact[:500] + '...') if len(sql_compact) > 500 else sql_compact
                        self.logger.warning(
                            'slow_sql[%s/%s] %.2fms %s',
                            index,
                            slow_query_count,
                            elapsed_ms,
                            sql_preview,
                        )
                    else:
                        self.logger.warning(
                            'slow_sql[%s/%s] %.2fms',
                            index,
                            slow_query_count,
                            elapsed_ms,
                        )
