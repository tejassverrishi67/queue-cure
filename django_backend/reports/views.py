import csv
from datetime import timedelta
from django.utils import timezone
from django.http import HttpResponse, JsonResponse
from django.views.decorators.http import require_http_methods
from analytics.models import Patient, EmergencyRequest

def compile_report_data(start_date):
    patients = Patient.objects.filter(created_at__gte=start_date)
    emergencies = EmergencyRequest.objects.filter(created_at__gte=start_date)
    
    total_patients = patients.count()
    waiting = patients.filter(status="waiting").count()
    called = patients.filter(status="called").count()
    
    total_em = emergencies.count()
    approved = emergencies.filter(status="approved").count()
    rejected = emergencies.filter(status="rejected").count()
    
    reviewed = approved + rejected
    approval_rate = round((approved / reviewed) * 100, 1) if reviewed > 0 else 0.0
    
    called_with_dates = patients.filter(status="called", called_at__isnull=False)
    if called_with_dates.exists():
        total_wait = sum((p.called_at - p.created_at).total_seconds() for p in called_with_dates)
        avg_wait_min = round(total_wait / (60 * called_with_dates.count()), 1)
        longest_wait = max((p.called_at - p.created_at).total_seconds() for p in called_with_dates)
        longest_wait_min = round(longest_wait / 60, 1)
    else:
        avg_wait_min = 0.0
        longest_wait_min = 0.0
        
    # Calculate peak registration hours
    registrations_by_hour = [0] * 24
    for p in patients:
        registrations_by_hour[p.created_at.hour] += 1
    max_reg = max(registrations_by_hour)
    peak_hour = registrations_by_hour.index(max_reg) if max_reg > 0 else None
    peak_hour_str = f"{peak_hour:02d}:00" if peak_hour is not None else "N/A"
    
    return {
        "report_generated_at": timezone.now().isoformat(),
        "total_patients": total_patients,
        "waiting_patients": waiting,
        "called_patients": called,
        "emergency_requests": total_em,
        "approved_emergencies": approved,
        "rejected_emergencies": rejected,
        "approval_rate_percent": approval_rate,
        "average_wait_time_minutes": avg_wait_min,
        "longest_wait_time_minutes": longest_wait_min,
        "peak_registration_hour": peak_hour_str
    }

def format_response(data, filename_prefix, format_type):
    if format_type == "csv":
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename={filename_prefix}_report.csv'
        writer = csv.writer(response)
        writer.writerow(["Metric Name", "Metric Value"])
        for k, v in data.items():
            writer.writerow([k.replace('_', ' ').title(), v])
        return response
    else:
        # Default to JSON format
        return JsonResponse(data)

@require_http_methods(["GET"])
def daily_report(request):
    format_type = request.GET.get("format", "json").lower()
    start_date = timezone.now() - timedelta(days=1)
    data = compile_report_data(start_date)
    data["report_scope"] = "Daily (Last 24 Hours)"
    return format_response(data, "daily", format_type)

@require_http_methods(["GET"])
def weekly_report(request):
    format_type = request.GET.get("format", "json").lower()
    start_date = timezone.now() - timedelta(weeks=1)
    data = compile_report_data(start_date)
    data["report_scope"] = "Weekly (Last 7 Days)"
    return format_response(data, "weekly", format_type)

@require_http_methods(["GET"])
def monthly_report(request):
    format_type = request.GET.get("format", "json").lower()
    start_date = timezone.now() - timedelta(days=30)
    data = compile_report_data(start_date)
    data["report_scope"] = "Monthly (Last 30 Days)"
    return format_response(data, "monthly", format_type)
