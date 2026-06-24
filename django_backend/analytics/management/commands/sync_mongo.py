from django.core.management.base import BaseCommand
from analytics.sync import sync_mongodb_to_sqlite

class Command(BaseCommand):
    help = "Synchronizes real-time MongoDB collections to the SQLite cache."

    def handle(self, *args, **options):
        self.stdout.write("[Sync Command] Connecting to MongoDB...")
        try:
            sync_mongodb_to_sqlite()
            self.stdout.write(self.style.SUCCESS("[Sync Command] Database sync completed successfully."))
        except Exception as e:
            self.stderr.write(self.style.ERROR(f"[Sync Command] Synchronization failed: {e}"))
