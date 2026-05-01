from datetime import date

from django.test import TestCase

from apps.reservations.models import Reservation
from apps.reservations.serializers import MerchantReservationUpdateSerializer
from apps.stores.models import Store
from apps.users.models import Merchant, User


class MerchantReservationTableValidationTests(TestCase):
    def setUp(self):
        merchant_user = User.objects.create_user(
            email='merchant@example.com',
            password='password',
            firebase_uid='merchant-test-uid',
            username='Merchant',
            user_type='merchant',
        )
        merchant = Merchant.objects.create(
            user=merchant_user,
            company_account='12345678',
            plan='basic',
        )
        self.store = Store.objects.create(
            merchant=merchant,
            name='Test Store',
            cuisine_type='other',
            address='Test Address',
            phone='0212345678',
            dine_in_layout=[
                {
                    'id': 'floor-1',
                    'name': '1F',
                    'tables': [
                        {'id': 'table-a1', 'label': 'A1', 'seats': 4},
                    ],
                }
            ],
        )
        self.reservation_date = date(2026, 5, 10)
        self.time_slot = '18:00-20:00'

    def create_reservation(self, status, table_label='', number_suffix='1'):
        return Reservation.objects.create(
            reservation_number=f'R20260510{number_suffix}',
            store=self.store,
            customer_name=f'Guest {number_suffix}',
            customer_phone=f'09123456{number_suffix.zfill(2)}',
            reservation_date=self.reservation_date,
            time_slot=self.time_slot,
            party_size=2,
            children_count=0,
            status=status,
            table_label=table_label,
        )

    def assert_table_label_is_valid(self, status):
        existing = self.create_reservation(status=status, table_label='A1', number_suffix='1')
        target = self.create_reservation(status='pending', table_label='', number_suffix='2')

        serializer = MerchantReservationUpdateSerializer(
            target,
            data={'status': 'confirmed', 'table_label': 'A1'},
            partial=True,
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertEqual(existing.table_label, 'A1')

    def test_cancelled_reservation_table_can_be_selected_again(self):
        self.assert_table_label_is_valid('cancelled')

    def test_completed_reservation_table_can_be_selected_again(self):
        self.assert_table_label_is_valid('completed')

    def test_pending_or_confirmed_reservation_table_cannot_be_selected_again(self):
        for status in ['pending', 'confirmed']:
            with self.subTest(status=status):
                Reservation.objects.all().delete()
                self.create_reservation(status=status, table_label='A1', number_suffix='1')
                target = self.create_reservation(status='pending', table_label='', number_suffix='2')

                serializer = MerchantReservationUpdateSerializer(
                    target,
                    data={'status': 'confirmed', 'table_label': 'A1'},
                    partial=True,
                )

                self.assertFalse(serializer.is_valid())
                self.assertIn('table_label', serializer.errors)
