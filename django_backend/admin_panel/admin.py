import csv
import json
from datetime import datetime, date
from django.contrib import admin
from django.http import HttpResponse
from analytics.models import Patient, QueueSettings, EmergencyRequest, AdminUser

# Custom Export Actions
def export_as_csv(modeladmin, request, queryset):
    opts = modeladmin.model._meta
    response = HttpResponse(content_type='text/csv')
    response['Content-Disposition'] = f'attachment; filename={opts.verbose_name_plural}.csv'
    writer = csv.writer(response)
    
    fields = [field.name for field in opts.fields]
    writer.writerow(fields)
    for obj in queryset:
        row = []
        for field in fields:
            val = getattr(obj, field)
            if isinstance(val, (datetime, date)):
                val = val.isoformat()
            row.append(val)
        writer.writerow(row)
    return response
export_as_csv.short_description = "Export selected to CSV"

def export_as_json(modeladmin, request, queryset):
    opts = modeladmin.model._meta
    response = HttpResponse(content_type='application/json')
    response['Content-Disposition'] = f'attachment; filename={opts.verbose_name_plural}.json'
    
    fields = [field.name for field in opts.fields]
    data = []
    for obj in queryset:
        obj_data = {}
        for field in fields:
            val = getattr(obj, field)
            if isinstance(val, (datetime, date)):
                val = val.isoformat()
            obj_data[field] = val
        data.append(obj_data)
        
    response.write(json.dumps(data, indent=2))
    return response
export_as_json.short_description = "Export selected to JSON"


# Read-Only Admin Base Class to protect Queue State
class ReadOnlyAdmin(admin.ModelAdmin):
    actions = [export_as_csv, export_as_json]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(Patient)
class PatientAdmin(ReadOnlyAdmin):
    list_display = ('token_number', 'name', 'status', 'is_emergency', 'created_at', 'called_at')
    list_filter = ('status', 'is_emergency')
    search_fields = ('name', 'token_number')
    ordering = ('created_at',)


@admin.register(QueueSettings)
class QueueSettingsAdmin(ReadOnlyAdmin):
    list_display = ('config_id', 'current_token', 'last_token_index', 'average_consultation_time')


@admin.register(EmergencyRequest)
class EmergencyRequestAdmin(ReadOnlyAdmin):
    list_display = ('token_number', 'reason', 'status', 'created_at', 'reviewed_at')
    list_filter = ('status',)
    search_fields = ('token_number', 'reason')
    ordering = ('created_at',)


@admin.register(AdminUser)
class AdminUserAdmin(ReadOnlyAdmin):
    list_display = ('username',)
    search_fields = ('username',)
