from django.db import models

class Patient(models.Model):
    mongodb_id = models.CharField(max_length=24, unique=True)
    name = models.CharField(max_length=100)
    token_number = models.CharField(max_length=20)
    created_at = models.DateTimeField()
    called_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=20, default="waiting")
    is_emergency = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.token_number} - {self.name}"

class QueueSettings(models.Model):
    config_id = models.IntegerField(unique=True, default=1)
    current_token = models.CharField(max_length=20, null=True, blank=True)
    last_token_index = models.IntegerField(default=0)
    average_consultation_time = models.IntegerField(default=5)

    def __str__(self):
        return f"Config {self.config_id} (Current: {self.current_token})"

class EmergencyRequest(models.Model):
    mongodb_id = models.CharField(max_length=24, unique=True)
    token_number = models.CharField(max_length=20)
    reason = models.CharField(max_length=250)
    status = models.CharField(max_length=20, default="pending")
    created_at = models.DateTimeField()
    reviewed_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.token_number} - {self.status}"

class AdminUser(models.Model):
    username = models.CharField(max_length=100, unique=True)
    password = models.CharField(max_length=100) # Seeding plaintext from migration

    def __str__(self):
        return self.username
