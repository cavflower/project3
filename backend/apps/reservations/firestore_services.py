import logging
import threading

import firebase_admin
from django.conf import settings
from django.db import transaction
from firebase_admin import credentials, firestore, initialize_app

logger = logging.getLogger(__name__)


def _get_firestore_client():
    if not firebase_admin._apps:
        cred = credentials.Certificate(settings.BASE_DIR / 'serviceAccountKey.json')
        initialize_app(cred)
    return firestore.client()


def _build_reservation_payload(reservation):
    return {
        'id': reservation.id,
        'reservation_id': str(reservation.id),
        'reservation_number': reservation.reservation_number,
        'store_id': reservation.store_id,
        'store_id_text': str(reservation.store_id),
        'user_id': reservation.user_id,
        'customer_name': reservation.customer_name,
        'customer_phone': reservation.customer_phone,
        'customer_email': reservation.customer_email,
        'reservation_date': reservation.reservation_date.isoformat() if reservation.reservation_date else '',
        'time_slot': reservation.time_slot,
        'party_size': reservation.party_size,
        'children_count': reservation.children_count,
        'table_label': reservation.table_label,
        'merchant_note': reservation.merchant_note,
        'status': reservation.status,
        'updated_at': firestore.SERVER_TIMESTAMP,
    }


def sync_reservation_to_firestore(reservation):
    reservation_id = reservation.id

    def _task():
        try:
            db = _get_firestore_client()
            db.collection('reservations').document(str(reservation_id)).set(
                _build_reservation_payload(reservation),
                merge=True,
            )
        except Exception:
            logger.exception('Failed to sync reservation %s to Firestore', reservation_id)

    transaction.on_commit(lambda: threading.Thread(target=_task, daemon=True).start())


def delete_reservation_from_firestore(reservation_id):
    def _task():
        try:
            db = _get_firestore_client()
            db.collection('reservations').document(str(reservation_id)).delete()
        except Exception:
            logger.exception('Failed to delete reservation %s from Firestore', reservation_id)

    transaction.on_commit(lambda: threading.Thread(target=_task, daemon=True).start())
