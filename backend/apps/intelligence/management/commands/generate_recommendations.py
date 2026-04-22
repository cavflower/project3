from django.core.management.base import BaseCommand, CommandError

from apps.intelligence.services.line_recommendation_push_service import LineRecommendationPushService


class Command(BaseCommand):
	help = '執行 LINE 個人化推薦推播（快速備案或完整版自動推播）'

	def add_arguments(self, parser):
		parser.add_argument(
			'--fallback-only',
			action='store_true',
			help='只執行快速備案（熱門店家推播）',
		)
		parser.add_argument(
			'--intro-message',
			type=str,
			default='以下是本週熱門店家推薦，AI 功能異常時可先使用此備案。',
			help='快速備案推播的介紹文案',
		)
		parser.add_argument(
			'--force',
			action='store_true',
			help='忽略最小間隔與每週上限，強制執行完整版流程',
		)

	def handle(self, *args, **options):
		service = LineRecommendationPushService()

		try:
			if options['fallback_only']:
				summary = service.send_quick_fallback_popular_recommendation(
					intro_message=options['intro_message']
				)
				self.stdout.write(self.style.SUCCESS('已執行快速備案推播'))
			else:
				summary = service.run_automated_personalized_recommendation(
					force=options['force']
				)
				self.stdout.write(self.style.SUCCESS('已執行完整版自動推薦推播流程'))

			self.stdout.write(
				'mode={mode}, recipient={recipient_count}, success={success_count}, failure={failure_count}, skipped={skipped_count}'.format(
					**summary
				)
			)
		except ValueError as exc:
			raise CommandError(str(exc)) from exc
